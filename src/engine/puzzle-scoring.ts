/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IoUResult,
  PuzzleLevel,
  PuzzleScoreResult,
  ScoreState,
  ShapeValidationResult,
  SilhouetteBBox,
  SilhouetteMetrics,
} from '../types';

export interface MaskExtractionOptions {
  /** Pixels with alpha at or below this value are ignored. */
  alphaThreshold?: number;
  /** Pixels darker than this luminance are considered part of a silhouette. */
  luminanceThreshold?: number;
}

const DEFAULT_ALPHA_THRESHOLD = 24;
const DEFAULT_LUMINANCE_THRESHOLD = 120;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pixelLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isRgbaBuffer(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): boolean {
  return pixels.length >= width * height * 4;
}

function extractDarkMask(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: MaskExtractionOptions = {}
): Uint8Array {
  const alphaThreshold = options.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  const luminanceThreshold = options.luminanceThreshold ?? DEFAULT_LUMINANCE_THRESHOLD;
  const total = width * height;
  const mask = new Uint8Array(total);

  if (isRgbaBuffer(pixels, width, height)) {
    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      if (pixels[idx + 3] <= alphaThreshold) continue;
      const luminance = pixelLuminance(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
      if (luminance < luminanceThreshold) mask[i] = 1;
    }
    return mask;
  }

  // Single-channel masks (used by tests and optional external callers).
  for (let i = 0; i < total; i++) {
    if (pixels[i] > luminanceThreshold) mask[i] = 1;
  }
  return mask;
}

/**
 * Converts the live RGBA capture of the projection wall into a binary shadow
 * mask. The studio engine already outputs a white background with black
 * projected-shadow pixels, so the same luminance test works for both the live
 * capture and the target silhouette.
 */
export function extractShadowMask(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: MaskExtractionOptions = {}
): Uint8Array {
  return extractDarkMask(pixels, width, height, options);
}

/** Converts the target silhouette buffer into a binary mask. */
export function extractTargetMask(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: MaskExtractionOptions = {}
): Uint8Array {
  return extractDarkMask(pixels, width, height, options);
}

function computeBBox(mask: Uint8Array, width: number, height: number): SilhouetteBBox | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const boxWidth = maxX - minX + 1;
  const boxHeight = maxY - minY + 1;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: boxWidth,
    height: boxHeight,
    aspect: boxHeight > 0 ? boxWidth / boxHeight : 0,
  };
}

function computeStructureScore(
  currentMask: Uint8Array,
  targetMask: Uint8Array,
  width: number,
  height: number,
  gridSize: number
): number {
  const cells = gridSize * gridSize;
  const currentCells = new Float64Array(cells);
  const targetCells = new Float64Array(cells);
  const cellWidth = width / gridSize;
  const cellHeight = height / gridSize;

  for (let y = 0; y < height; y++) {
    const cy = Math.min(gridSize - 1, Math.floor(y / cellHeight));
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const cx = Math.min(gridSize - 1, Math.floor(x / cellWidth));
      const cell = cy * gridSize + cx;
      if (currentMask[row + x]) currentCells[cell]++;
      if (targetMask[row + x]) targetCells[cell]++;
    }
  }

  let dot = 0;
  let currentMagnitude = 0;
  let targetMagnitude = 0;
  for (let i = 0; i < cells; i++) {
    dot += currentCells[i] * targetCells[i];
    currentMagnitude += currentCells[i] * currentCells[i];
    targetMagnitude += targetCells[i] * targetCells[i];
  }

  const denominator = Math.sqrt(currentMagnitude * targetMagnitude);
  return denominator > 0 ? clamp01(dot / denominator) : 0;
}

function computeAspectError(
  current: SilhouetteBBox | null,
  target: SilhouetteBBox | null
): number {
  if (!current || !target) return 1;
  const largest = Math.max(current.aspect, target.aspect);
  if (largest <= 0) return 0;
  return clamp01(Math.abs(current.aspect - target.aspect) / largest);
}

/**
 * Compares two binary masks. This is deliberately dependency-free so it can be
 * unit tested without a WebGL context.
 */
export function analyzeBinaryMasks(
  currentMask: Uint8Array,
  targetMask: Uint8Array,
  width: number,
  height: number,
  structureGridSize: number = 8
): SilhouetteMetrics {
  const total = width * height;
  let intersectionCount = 0;
  let unionCount = 0;
  let currentCount = 0;
  let targetCount = 0;
  let currentSumX = 0;
  let currentSumY = 0;
  let targetSumX = 0;
  let targetSumY = 0;

  for (let i = 0; i < total; i++) {
    const isCurrent = currentMask[i] !== 0;
    const isTarget = targetMask[i] !== 0;

    if (isCurrent && isTarget) intersectionCount++;
    if (isCurrent || isTarget) unionCount++;
    if (isCurrent) {
      currentCount++;
      currentSumX += i % width;
      currentSumY += Math.floor(i / width);
    }
    if (isTarget) {
      targetCount++;
      targetSumX += i % width;
      targetSumY += Math.floor(i / width);
    }
  }

  const currentCentroid: [number, number] | null =
    currentCount > 0 ? [currentSumX / currentCount, currentSumY / currentCount] : null;
  const targetCentroid: [number, number] | null =
    targetCount > 0 ? [targetSumX / targetCount, targetSumY / targetCount] : null;

  let centroidDistance = 1;
  if (currentCentroid && targetCentroid) {
    const dx = currentCentroid[0] - targetCentroid[0];
    const dy = currentCentroid[1] - targetCentroid[1];
    const diagonal = Math.hypot(width, height);
    centroidDistance = diagonal > 0 ? clamp01(Math.hypot(dx, dy) / diagonal) : 1;
  }

  const currentBBox = computeBBox(currentMask, width, height);
  const targetBBox = computeBBox(targetMask, width, height);

  const precision = currentCount > 0 ? intersectionCount / currentCount : 0;
  const recall = targetCount > 0 ? intersectionCount / targetCount : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const iou = unionCount > 0 ? (intersectionCount / unionCount) * 100 : 0;
  const coverage = targetCount > 0 ? currentCount / targetCount : 0;

  return {
    width,
    height,
    intersectionCount,
    unionCount,
    currentCount,
    targetCount,
    iou,
    precision,
    recall,
    f1,
    coverage,
    centroidDistance,
    aspectError: computeAspectError(currentBBox, targetBBox),
    structureScore: computeStructureScore(
      currentMask,
      targetMask,
      width,
      height,
      structureGridSize
    ),
  };
}

/**
 * Full pipeline used by the app: live wall capture + target buffer -> metrics.
 */
export function analyzeShadowMasks(
  currentPixels: Uint8ClampedArray | Uint8Array,
  targetPixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: MaskExtractionOptions = {}
): SilhouetteMetrics {
  const currentMask = extractShadowMask(currentPixels, width, height, options);
  const targetMask = extractTargetMask(targetPixels, width, height, options);
  return analyzeBinaryMasks(currentMask, targetMask, width, height);
}

/**
 * Combines the geometric IoU with balance (precision/recall), area, centroid,
 * aspect-ratio and structural checks. An invalid silhouette can never pass,
 * even if it happens to cover most of the target area.
 */
export function computePuzzleScore(
  metrics: SilhouetteMetrics,
  level: Pick<PuzzleLevel, 'targetThreshold'>,
  validation: ShapeValidationResult
): PuzzleScoreResult {
  const iouScore = clamp01(metrics.iou / 100) * 100;
  const f1Score = clamp01(metrics.f1) * 100;
  const coverageScore =
    metrics.coverage > 0 ? clamp01(Math.min(metrics.coverage, 1 / metrics.coverage)) * 100 : 0;
  const centroidScore = clamp01(1 - metrics.centroidDistance / 0.4) * 100;
  const aspectScore = clamp01(1 - metrics.aspectError / 0.65) * 100;
  const structureScore = clamp01(metrics.structureScore) * 100;

  let score =
    iouScore * 0.42 +
    f1Score * 0.18 +
    coverageScore * 0.12 +
    centroidScore * 0.1 +
    aspectScore * 0.06 +
    structureScore * 0.12;

  // Hard gate: a dark blob with the wrong shape cannot produce a false win.
  if (!validation.valid) {
    score = Math.min(score, Math.max(0, level.targetThreshold - 0.1));
  }

  score = round1(clamp01(score / 100) * 100);
  const passed = validation.valid && score >= level.targetThreshold;
  const state = getScoreState(score, level.targetThreshold, metrics, validation);

  return {
    score,
    rawIoU: round1(metrics.iou),
    state,
    passed,
    validation,
    metrics,
  };
}

export function getScoreState(
  score: number,
  threshold: number,
  metrics: Pick<SilhouetteMetrics, 'currentCount'>,
  validation?: ShapeValidationResult
): ScoreState {
  if (!metrics || metrics.currentCount === 0) return 'empty';
  if (validation && !validation.valid) return 'invalid';
  if (score >= threshold) return 'solved';
  if (threshold - score <= 8) return 'near-solve';
  if (score >= threshold * 0.55) return 'close';
  return 'forming';
}

/** Builds the legacy IoUResult shape consumed by the GPU diagnostic modal. */
export function toIoUResult(
  result: PuzzleScoreResult,
  method: IoUResult['method'],
  computeTimeMs: number
): IoUResult {
  return {
    score: result.score,
    intersectionCount: result.metrics.intersectionCount,
    unionCount: result.metrics.unionCount,
    currentCount: result.metrics.currentCount,
    targetCount: result.metrics.targetCount,
    method,
    computeTimeMs,
    rawIou: result.rawIoU,
  };
}
