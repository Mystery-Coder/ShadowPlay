/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PuzzleLevel,
  ShapeValidationIssue,
  ShapeValidationResult,
  SilhouetteMetrics,
} from '../types';

export interface ShapeValidationThresholds {
  minPrecision: number;
  minRecall: number;
  minStructure: number;
  maxCentroidDistance: number;
  maxAspectError: number;
  minCoverage: number;
  maxCoverage: number;
  /** A silhouette covering more than this fraction of the screen is a dark blob. */
  maxScreenCoverage: number;
}

export const DEFAULT_VALIDATION_THRESHOLDS: ShapeValidationThresholds = {
  minPrecision: 0.55,
  minRecall: 0.55,
  minStructure: 0.45,
  maxCentroidDistance: 0.22,
  maxAspectError: 0.45,
  minCoverage: 0.5,
  maxCoverage: 2.0,
  maxScreenCoverage: 0.85,
};

type ValidationOverrides = Partial<
  Pick<
    PuzzleLevel,
    | 'minPrecision'
    | 'minRecall'
    | 'minStructure'
    | 'maxCentroidDistance'
    | 'maxAspectError'
    | 'minCoverage'
    | 'maxCoverage'
  >
>;

export function getValidationThresholds(
  level?: ValidationOverrides
): ShapeValidationThresholds {
  return {
    minPrecision: level?.minPrecision ?? DEFAULT_VALIDATION_THRESHOLDS.minPrecision,
    minRecall: level?.minRecall ?? DEFAULT_VALIDATION_THRESHOLDS.minRecall,
    minStructure: level?.minStructure ?? DEFAULT_VALIDATION_THRESHOLDS.minStructure,
    maxCentroidDistance:
      level?.maxCentroidDistance ?? DEFAULT_VALIDATION_THRESHOLDS.maxCentroidDistance,
    maxAspectError: level?.maxAspectError ?? DEFAULT_VALIDATION_THRESHOLDS.maxAspectError,
    minCoverage: level?.minCoverage ?? DEFAULT_VALIDATION_THRESHOLDS.minCoverage,
    maxCoverage: level?.maxCoverage ?? DEFAULT_VALIDATION_THRESHOLDS.maxCoverage,
    maxScreenCoverage: DEFAULT_VALIDATION_THRESHOLDS.maxScreenCoverage,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function issue(
  code: string,
  message: string,
  severity: ShapeValidationIssue['severity']
): ShapeValidationIssue {
  return { code, message, severity };
}

function validationQualityScore(
  metrics: SilhouetteMetrics,
  thresholds: ShapeValidationThresholds
): number {
  const precisionRatio =
    thresholds.minPrecision > 0
      ? clamp01(metrics.precision / thresholds.minPrecision)
      : 1;
  const recallRatio =
    thresholds.minRecall > 0 ? clamp01(metrics.recall / thresholds.minRecall) : 1;
  const structureRatio =
    thresholds.minStructure > 0
      ? clamp01(metrics.structureScore / thresholds.minStructure)
      : 1;
  const centroidRatio =
    thresholds.maxCentroidDistance > 0
      ? clamp01(1 - metrics.centroidDistance / thresholds.maxCentroidDistance)
      : 1;
  const aspectRatio =
    thresholds.maxAspectError > 0
      ? clamp01(1 - metrics.aspectError / thresholds.maxAspectError)
      : 1;
  const coverageRatio =
    metrics.coverage <= 0
      ? 0
      : clamp01(
          Math.min(
            metrics.coverage / thresholds.minCoverage,
            thresholds.maxCoverage / metrics.coverage
          )
        );

  const score =
    precisionRatio * 0.2 +
    recallRatio * 0.2 +
    structureRatio * 0.24 +
    centroidRatio * 0.14 +
    aspectRatio * 0.1 +
    coverageRatio * 0.12;

  return Math.round(clamp01(score) * 1000) / 10;
}

/**
 * Validates that the projected shadow is an actual silhouette match rather
 * than simply a dark area on the wall.
 */
export function validateShadowShape(
  metrics: SilhouetteMetrics,
  level?: ValidationOverrides
): ShapeValidationResult {
  const thresholds = getValidationThresholds(level);
  const issues: ShapeValidationIssue[] = [];
  const totalPixels = metrics.width * metrics.height;
  const screenCoverage = totalPixels > 0 ? metrics.currentCount / totalPixels : 0;

  if (metrics.currentCount === 0) {
    issues.push(
      issue(
        'no-shadow',
        'No projected shadow detected. Move a shape into the spotlight beam.',
        'error'
      )
    );
  } else {
    if (screenCoverage > thresholds.maxScreenCoverage) {
      issues.push(
        issue(
          'screen-covered',
          'Almost the whole screen is dark. That is a light/blocking problem, not a silhouette match.',
          'error'
        )
      );
    }

    if (metrics.coverage < thresholds.minCoverage) {
      issues.push(
        issue(
          'too-little-shadow',
          'The shadow is much smaller than the target silhouette. Scale the shapes up or combine more objects.',
          'error'
        )
      );
    } else if (metrics.coverage > thresholds.maxCoverage) {
      issues.push(
        issue(
          'too-much-shadow',
          'The shadow spills far outside the target silhouette. Remove or shrink excess geometry.',
          'error'
        )
      );
    }

    if (metrics.precision < thresholds.minPrecision) {
      issues.push(
        issue(
          'low-precision',
          'Too much shadow falls in empty areas around the target. Tighten the silhouette.',
          'error'
        )
      );
    } else if (metrics.precision < thresholds.minPrecision + 0.08) {
      issues.push(
        issue(
          'precision-edge',
          'The outer edge of the silhouette is getting noisy. A small adjustment should help.',
          'warning'
        )
      );
    }

    if (metrics.recall < thresholds.minRecall) {
      issues.push(
        issue(
          'low-recall',
          'Large parts of the target silhouette are still missing.',
          'error'
        )
      );
    } else if (metrics.recall < thresholds.minRecall + 0.08) {
      issues.push(
        issue(
          'recall-edge',
          'A few target regions are still uncovered.',
          'warning'
        )
      );
    }

    if (metrics.centroidDistance > thresholds.maxCentroidDistance) {
      issues.push(
        issue(
          'off-centre',
          "The silhouette is off-centre. Move it toward the target's centre.",
          'error'
        )
      );
    } else if (metrics.centroidDistance > thresholds.maxCentroidDistance * 0.8) {
      issues.push(
        issue(
          'centroid-edge',
          'The silhouette is drifting toward the edge of the target.',
          'warning'
        )
      );
    }

    if (metrics.aspectError > thresholds.maxAspectError) {
      issues.push(
        issue(
          'aspect-mismatch',
          "The silhouette's proportions are wrong: it is too wide or too tall.",
          'error'
        )
      );
    }

    if (metrics.structureScore < thresholds.minStructure) {
      issues.push(
        issue(
          'structure-mismatch',
          'The shadow is the wrong shape even where it overlaps. Rotate or rearrange the objects.',
          'error'
        )
      );
    }
  }

  return {
    valid: !issues.some((entry) => entry.severity === 'error'),
    score: validationQualityScore(metrics, thresholds),
    issues,
  };
}

/** First actionable message for the HUD. */
export function getPrimaryValidationMessage(
  result: ShapeValidationResult
): ShapeValidationIssue | null {
  return (
    result.issues.find((entry) => entry.severity === 'error') ??
    result.issues.find((entry) => entry.severity === 'warning') ??
    null
  );
}
