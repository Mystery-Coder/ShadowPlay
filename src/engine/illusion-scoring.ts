/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	AnamorphicTolerance,
	AnamorphicViewMetrics,
	StudioObject,
} from "../types";

/** Weight of each camera term in the blended alignment score. */
export const ANAMORPHIC_ACCURACY_WEIGHTS = {
	position: 0.35,
	angle: 0.45,
	fov: 0.2,
} as const;

/** Object integrity below this value blocks a "solved" verdict. */
export const ANAMORPHIC_MIN_INTEGRITY = 90;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Maps an error to 0..100. Zero error is perfect, the tolerance boundary is
 * 50%, and twice the tolerance is 0% — so "inside tolerance" always reads as a
 * confident, above-half score instead of dropping to zero at the boundary.
 */
function accuracyFromError(error: number, tolerance: number): number {
	if (!Number.isFinite(error) || error <= 0) return 100;
	if (!Number.isFinite(tolerance) || tolerance <= 0) return 0;
	return Math.round(clamp01(1 - error / (tolerance * 2)) * 100);
}

export function computeAnamorphicViewMetrics(
	positionError: number,
	angleErrorDeg: number,
	fovError: number,
	tolerance: AnamorphicTolerance,
): AnamorphicViewMetrics {
	const positionAccuracy = accuracyFromError(
		positionError,
		tolerance.position,
	);
	const angleAccuracy = accuracyFromError(angleErrorDeg, tolerance.angleDeg);
	const fovAccuracy = accuracyFromError(fovError, tolerance.fov);

	const accuracy = Math.round(
		positionAccuracy * ANAMORPHIC_ACCURACY_WEIGHTS.position +
			angleAccuracy * ANAMORPHIC_ACCURACY_WEIGHTS.angle +
			fovAccuracy * ANAMORPHIC_ACCURACY_WEIGHTS.fov,
	);

	const withinTolerance =
		positionError <= tolerance.position + 1e-4 &&
		angleErrorDeg <= tolerance.angleDeg + 1e-4 &&
		fovError <= tolerance.fov + 1e-4;

	return {
		positionError,
		angleErrorDeg,
		fovError,
		positionAccuracy,
		angleAccuracy,
		fovAccuracy,
		accuracy,
		withinTolerance,
	};
}

/**
 * Compares the live scene against the preset's authored arrangement.
 * Objects are matched by id; missing objects count as fully broken. Position
 * drift and non-uniform scale drift both reduce the per-object score.
 */
export function computeObjectIntegrity(
	current: StudioObject[],
	reference: StudioObject[],
): number {
	if (reference.length === 0) return 100;

	const byId = new Map(current.map((object) => [object.id, object]));
	let total = 0;

	for (const target of reference) {
		const live = byId.get(target.id);
		if (!live) continue;

		const dx = live.position[0] - target.position[0];
		const dy = live.position[1] - target.position[1];
		const dz = live.position[2] - target.position[2];
		const positionError = Math.sqrt(dx * dx + dy * dy + dz * dz);

		let scaleError = 0;
		for (let axis = 0; axis < 3; axis++) {
			const base = Math.max(1e-4, Math.abs(target.scale[axis]));
			scaleError +=
				Math.abs(live.scale[axis] - target.scale[axis]) / base;
		}
		scaleError /= 3;

		total +=
			clamp01(1 - positionError / 1.25) *
			clamp01(1 - scaleError / 0.8);
	}

	return Math.round((total / reference.length) * 100);
}

export interface IllusionScoreResult {
	/** Final 0..100 score after the integrity multiplier. */
	score: number;
	/** True only when the camera is inside tolerance and objects are intact. */
	passed: boolean;
	integrity: number;
}

export function finalizeIllusionScore(
	view: AnamorphicViewMetrics | null,
	integrity: number,
): IllusionScoreResult {
	if (!view) return { score: 0, passed: false, integrity };

	const multiplier = 0.7 + 0.3 * (integrity / 100);
	return {
		score: Math.round(view.accuracy * multiplier),
		passed: view.withinTolerance && integrity >= ANAMORPHIC_MIN_INTEGRITY,
		integrity,
	};
}
