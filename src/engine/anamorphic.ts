/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from "three";
import {
	AnamorphicPreset,
	AnamorphicSweetSpot,
	AnamorphicTolerance,
	ShapeType,
	StudioObject,
} from "../types";

const DEG2RAD = Math.PI / 180;

/** Default error window shared by every preset. */
const DEFAULT_TOLERANCE: AnamorphicTolerance = {
	position: 0.42,
	angleDeg: 4.5,
	fov: 3.5,
};

/**
 * Base model height (local Y extent) for each primitive, used to convert a
 * desired on-screen size into a uniform object scale.
 */
const SHAPE_BASE_HEIGHT: Partial<Record<ShapeType, number>> = {
	cube: 1,
	sphere: 1.2,
	cylinder: 1.2,
	rod: 2,
	ring: 1.1,
	cone: 1.2,
	teapot: 1.3,
	bird: 0.8,
	chair: 1,
	key: 1,
	arch: 1.4,
	spiral: 1.6,
};

interface Point2D {
	x: number;
	y: number;
}

interface PartSpec {
	x: number;
	y: number;
	depth: number;
	size: number;
	shape: ShapeType;
	yaw: number;
	name: string;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

function sweetSpot(
	position: [number, number, number],
	lookAt: [number, number, number],
	fov: number,
	tolerance: AnamorphicTolerance = DEFAULT_TOLERANCE,
): AnamorphicSweetSpot {
	return { position, lookAt, fov, tolerance };
}

// --- 2D point generators (target space: 0..100, y up) ---

function linePoints(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	count: number,
	skipFirst = false,
): Point2D[] {
	const points: Point2D[] = [];
	const start = skipFirst ? 1 : 0;
	for (let i = start; i < count; i++) {
		const t = count <= 1 ? 0 : i / (count - 1);
		points.push({
			x: x1 + (x2 - x1) * t,
			y: y1 + (y2 - y1) * t,
		});
	}
	return points;
}

function arcPoints(
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	startDeg: number,
	endDeg: number,
	count: number,
): Point2D[] {
	const points: Point2D[] = [];
	const steps = Math.max(2, count);
	for (let i = 0; i < steps; i++) {
		const t = i / (steps - 1);
		const angle = (startDeg + (endDeg - startDeg) * t) * DEG2RAD;
		points.push({
			x: cx + rx * Math.cos(angle),
			y: cy + ry * Math.sin(angle),
		});
	}
	return points;
}

function ellipsePoints(
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	count: number,
): Point2D[] {
	const points: Point2D[] = [];
	for (let i = 0; i < count; i++) {
		const angle = (i / count) * Math.PI * 2;
		points.push({
			x: cx + rx * Math.cos(angle),
			y: cy + ry * Math.sin(angle),
		});
	}
	return points;
}

function circlePoints(cx: number, cy: number, radius: number, count: number) {
	return ellipsePoints(cx, cy, radius, radius, count);
}

function polylinePoints(vertices: Point2D[], perSegment: number): Point2D[] {
	const points: Point2D[] = [];
	for (let segment = 0; segment < vertices.length - 1; segment++) {
		const from = vertices[segment];
		const to = vertices[segment + 1];
		for (let i = 0; i < perSegment; i++) {
			const t = i / perSegment;
			points.push({
				x: from.x + (to.x - from.x) * t,
				y: from.y + (to.y - from.y) * t,
			});
		}
	}
	points.push(vertices[vertices.length - 1]);
	return points;
}

function starVertices(
	cx: number,
	cy: number,
	outerRadius: number,
	innerRadius: number,
	pointCount = 5,
): Point2D[] {
	const vertices: Point2D[] = [];
	for (let i = 0; i < pointCount * 2; i++) {
		const radius = i % 2 === 0 ? outerRadius : innerRadius;
		const angle = (90 + (i * 180) / pointCount) * DEG2RAD;
		vertices.push({
			x: cx + radius * Math.cos(angle),
			y: cy + radius * Math.sin(angle),
		});
	}
	return vertices;
}

/**
 * Turns target-space points into bead specs. Depth jitter gives the cloud real
 * 3D parallax while the size compensates so the projected footprint stays put.
 */
function beads(
	points: Point2D[],
	shapes: ShapeType | ShapeType[],
	size: number,
	baseDepth: number,
	prefix: string,
): PartSpec[] {
	const palette = Array.isArray(shapes) ? shapes : [shapes];
	return points.map((point, index) => ({
		x: point.x,
		y: point.y,
		depth: baseDepth + (((index * 7) % 5) - 2) * 0.14,
		size: size * (0.92 + ((index * 5) % 3) * 0.03),
		shape: palette[index % palette.length],
		yaw: (index * 37) % 180,
		name: `${prefix} ${index + 1}`,
	}));
}

/**
 * Projects every bead from the sweet-spot camera along its line of sight, so
 * the union of all beads reads as the target silhouette from that exact pose.
 */
function buildObjects(
	presetId: string,
	spot: AnamorphicSweetSpot,
	parts: PartSpec[],
	color: string,
): StudioObject[] {
	const origin = new THREE.Vector3(...spot.position);
	const lookAt = new THREE.Vector3(...spot.lookAt);
	const forward = lookAt.clone().sub(origin).normalize();
	const worldUp = new THREE.Vector3(0, 1, 0);
	const right = new THREE.Vector3()
		.crossVectors(forward, worldUp)
		.normalize();
	const up = new THREE.Vector3().crossVectors(right, forward).normalize();
	const halfHeight = Math.tan((spot.fov * DEG2RAD) / 2);

	return parts.map((part, index) => {
		const nx = part.x / 50 - 1;
		const ny = part.y / 50 - 1;

		// Not normalised: keeping the forward component at 1 means `depth` is the
		// true camera-space Z used by the perspective divide.
		const direction = forward
			.clone()
			.addScaledVector(right, nx * halfHeight)
			.addScaledVector(up, ny * halfHeight);

		const center = origin.clone().addScaledVector(direction, part.depth);
		const worldHeight = part.size * 2 * part.depth * halfHeight;
		const baseHeight = SHAPE_BASE_HEIGHT[part.shape] ?? 1;
		const scale = worldHeight / baseHeight;

		// Models are authored with their base at local Y=0, so lift the group by
		// half the projected height to centre it on the target point.
		const position: [number, number, number] = [
			round3(center.x),
			round3(center.y - worldHeight / 2),
			round3(center.z),
		];

		return {
			id: `${presetId}-${index}`,
			name: part.name,
			shape: part.shape,
			position,
			rotation: [0, part.yaw, 0] as [number, number, number],
			scale: [round3(scale), round3(scale), round3(scale)] as [
				number,
				number,
				number,
			],
			color,
		};
	});
}

/** Renders the bead cloud as an SVG silhouette (same points the 3D parts use). */
function buildTargetImage(parts: PartSpec[], color: string): string {
	const circles = parts
		.map(
			(part) =>
				`<circle cx="${part.x.toFixed(2)}" cy="${(100 - part.y).toFixed(
					2,
				)}" r="${(part.size * 50).toFixed(2)}" fill="${color}"/>`,
		)
		.join("");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${circles}</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function makePreset(
	id: string,
	name: string,
	description: string,
	spot: AnamorphicSweetSpot,
	revealColor: string,
	parts: PartSpec[],
): AnamorphicPreset {
	return {
		id,
		name,
		description,
		sweetSpot: spot,
		revealColor,
		targetImage: buildTargetImage(parts, revealColor),
		objects: buildObjects(id, spot, parts, revealColor),
	};
}

// --- Target definitions ---

function heartParts(): PartSpec[] {
	const outline: Point2D[] = [
		...arcPoints(36, 68, 19, 19, 15, 200, 11),
		...linePoints(18.6, 61, 50, 17, 7),
		...linePoints(50, 17, 81.4, 61, 7),
		...arcPoints(64, 68, 19, 19, -20, 165, 11),
	];
	return beads(
		outline,
		["cube", "cube", "sphere"],
		0.13,
		3.0,
		"Heart Fragment",
	);
}

function starParts(): PartSpec[] {
	const vertices = starVertices(50, 52, 42, 17);
	return beads(
		polylinePoints([...vertices, vertices[0]], 3),
		["cone", "cone", "cube"],
		0.16,
		3.0,
		"Star Vertex",
	);
}

function smileyParts(): PartSpec[] {
	const head = circlePoints(50, 52, 40, 26);
	const eyes: Point2D[] = [
		{ x: 36, y: 64 },
		{ x: 64, y: 64 },
	];
	const mouth = arcPoints(50, 48, 25, 25, 205, 335, 12);
	return [
		...beads(head, "sphere", 0.11, 3.0, "Face Outline"),
		...beads(eyes, "cube", 0.13, 2.9, "Eye"),
		...beads(mouth, "cylinder", 0.11, 3.1, "Smile"),
	];
}

function butterflyParts(): PartSpec[] {
	const upperLeft = ellipsePoints(34, 66, 22, 26, 18);
	const upperRight = ellipsePoints(66, 66, 22, 26, 18);
	const lowerLeft = ellipsePoints(37, 40, 15, 18, 12);
	const lowerRight = ellipsePoints(63, 40, 15, 18, 12);
	const body = linePoints(50, 20, 50, 84, 8);
	const antennae = [
		...linePoints(50, 84, 41, 96, 3),
		...linePoints(50, 84, 59, 96, 3, true),
	];
	return [
		...beads(upperLeft, ["teapot", "sphere"], 0.1, 3.0, "Left Forewing"),
		...beads(upperRight, ["teapot", "sphere"], 0.1, 3.1, "Right Forewing"),
		...beads(lowerLeft, ["cone", "sphere"], 0.1, 2.9, "Left Hindwing"),
		...beads(lowerRight, ["cone", "sphere"], 0.1, 3.2, "Right Hindwing"),
		...beads(body, "cylinder", 0.12, 3.0, "Body"),
		...beads(antennae, "sphere", 0.09, 3.0, "Antenna"),
	];
}

function treeParts(): PartSpec[] {
	const top = polylinePoints(
		[
			{ x: 50, y: 94 },
			{ x: 39, y: 74 },
			{ x: 61, y: 74 },
			{ x: 50, y: 94 },
		],
		2,
	);
	const middle = polylinePoints(
		[
			{ x: 50, y: 80 },
			{ x: 33, y: 56 },
			{ x: 67, y: 56 },
			{ x: 50, y: 80 },
		],
		2,
	);
	const bottom = polylinePoints(
		[
			{ x: 50, y: 62 },
			{ x: 25, y: 30 },
			{ x: 75, y: 30 },
			{ x: 50, y: 62 },
		],
		3,
	);
	const trunk = [
		...linePoints(46, 30, 46, 14, 4),
		...linePoints(54, 30, 54, 14, 4),
		...linePoints(43, 14, 57, 14, 3),
	];
	return [
		...beads(top, "cone", 0.12, 3.1, "Canopy Top"),
		...beads(middle, "cone", 0.12, 2.9, "Canopy Middle"),
		...beads(bottom, "cone", 0.12, 3.0, "Canopy Base"),
		...beads(trunk, "cylinder", 0.11, 3.0, "Trunk"),
	];
}

function arrowParts(): PartSpec[] {
	const outline = polylinePoints(
		[
			{ x: 50, y: 94 },
			{ x: 72, y: 70 },
			{ x: 58, y: 70 },
			{ x: 58, y: 18 },
			{ x: 42, y: 18 },
			{ x: 42, y: 70 },
			{ x: 28, y: 70 },
			{ x: 50, y: 94 },
		],
		2,
	);
	return beads(outline, ["cube", "cube", "cone"], 0.13, 3.0, "Arrow Edge");
}

function letterSParts(): PartSpec[] {
	const chain: Point2D[] = [
		{ x: 70, y: 88 },
		{ x: 58, y: 93 },
		{ x: 44, y: 91 },
		{ x: 35, y: 84 },
		{ x: 34, y: 74 },
		{ x: 40, y: 67 },
		{ x: 52, y: 63 },
		{ x: 62, y: 57 },
		{ x: 67, y: 48 },
		{ x: 66, y: 38 },
		{ x: 58, y: 30 },
		{ x: 45, y: 27 },
		{ x: 33, y: 31 },
	];
	return beads(
		polylinePoints(chain, 2),
		["cylinder", "sphere"],
		0.13,
		3.0,
		"S Curve",
	);
}

function rvParts(): PartSpec[] {
	const rStem = linePoints(30, 20, 30, 84, 6);
	const rBowl = arcPoints(30, 70, 16, 14, 90, -90, 8);
	const rLeg = linePoints(40, 62, 52, 32, 4);
	const vLeft = linePoints(58, 84, 70, 22, 5);
	const vRight = linePoints(70, 22, 82, 84, 5, true);
	return [
		...beads(rStem, "cube", 0.13, 3.0, "R Stem"),
		...beads(rBowl, ["ring", "cube"], 0.13, 3.1, "R Bowl"),
		...beads(rLeg, "cube", 0.12, 2.9, "R Leg"),
		...beads(vLeft, "cube", 0.13, 3.0, "V Left"),
		...beads(vRight, "cube", 0.13, 3.1, "V Right"),
	];
}

function faceParts(): PartSpec[] {
	const head = circlePoints(50, 52, 40, 26);
	const eyes: Point2D[] = [
		{ x: 37, y: 64 },
		{ x: 63, y: 64 },
	];
	const brows = [
		...linePoints(31, 72, 43, 74, 3),
		...linePoints(57, 74, 69, 72, 3, true),
	];
	const nose = [
		...linePoints(50, 62, 50, 48, 3),
		...linePoints(50, 48, 56, 44, 2, true),
	];
	const mouth = arcPoints(50, 40, 18, 18, 210, 330, 10);
	return [
		...beads(head, "sphere", 0.11, 3.0, "Head Outline"),
		...beads(eyes, "sphere", 0.11, 2.9, "Eye"),
		...beads(brows, "cube", 0.1, 3.1, "Brow"),
		...beads(nose, "cone", 0.1, 3.0, "Nose"),
		...beads(mouth, "cylinder", 0.1, 3.0, "Mouth"),
	];
}

function rabbitParts(): PartSpec[] {
	const leftEar = ellipsePoints(38, 80, 8, 24, 12);
	const rightEar = ellipsePoints(62, 80, 8, 24, 12);
	const head = circlePoints(50, 50, 24, 16);
	const body = ellipsePoints(50, 24, 22, 16, 16);
	const tail = circlePoints(72, 20, 5, 6);
	const snout = linePoints(50, 44, 64, 40, 3);
	return [
		...beads(leftEar, "cylinder", 0.11, 3.0, "Left Ear"),
		...beads(rightEar, "cylinder", 0.11, 3.1, "Right Ear"),
		...beads(head, "sphere", 0.12, 3.0, "Head"),
		...beads(body, "sphere", 0.12, 2.9, "Body"),
		...beads(tail, "sphere", 0.1, 3.0, "Tail"),
		...beads(snout, "cone", 0.1, 3.0, "Snout"),
	];
}

export const ANAMORPHIC_PRESETS: AnamorphicPreset[] = [
	makePreset(
		"impossible-star",
		"The 5-Point Star",
		"Thirty floating nodes arranged along five hidden sight-lines. From the sweet spot they trace a crisp star; anywhere else they are a random constellation.",
		sweetSpot([0, 1.85, 5.4], [0, 1.72, 0], 46),
		"#eab308",
		starParts(),
	),
	makePreset(
		"smiley-signal",
		"The Smiley Signal",
		"A cheerful face assembled from a ring of orbiting beads, two eye nodes and a curved smile. Find the vantage point where the geometry smiles back.",
		sweetSpot([0, 1.85, 5.3], [0, 1.72, 0], 46),
		"#facc15",
		smileyParts(),
	),
	makePreset(
		"butterfly-drift",
		"The Butterfly Drift",
		"Four wings and a slender body scattered through depth. Only the sweet-spot projection folds them into a symmetrical butterfly.",
		sweetSpot([0, 1.85, 5.3], [0, 1.72, 0], 47),
		"#a78bfa",
		butterflyParts(),
	),
	makePreset(
		"phantom-tree",
		"The Phantom Tree",
		"Three canopy tiers and a blocky trunk hide in a loose 3D cluster. Align the camera and a full tree appears against the studio.",
		sweetSpot([0, 1.8, 5.4], [0, 1.7, 0], 47),
		"#34d399",
		treeParts(),
	),
	makePreset(
		"vector-arrow",
		"The Vector Arrow",
		"A directional illusion: a dozen fragments that resolve into a bold upward arrow from exactly one viewpoint.",
		sweetSpot([0, 1.85, 5.3], [0, 1.72, 0], 46),
		"#22d3ee",
		arrowParts(),
	),
	makePreset(
		"letter-s",
		"The Letter S",
		"A flowing S-curve built from a chain of fragments at mixed depths. The curve is invisible until the projection lines up.",
		sweetSpot([0, 1.85, 5.3], [0, 1.72, 0], 46),
		"#fb923c",
		letterSParts(),
	),
	makePreset(
		"rv-monogram",
		"RV Monogram (Team 1RV23)",
		"A tribute to the CGVR seventh-semester team: separate 3D blocks that converge into the iconic RV emblem.",
		sweetSpot([0, 1.85, 5.3], [0, 1.72, 0], 46),
		"#38bdf8",
		rvParts(),
	),
	makePreset(
		"human-face",
		"The Human Face",
		"Eyes, brows, nose and mouth float at different depths. From the sweet spot they stack into a portrait; from anywhere else they scatter.",
		sweetSpot([0, 1.85, 5.4], [0, 1.72, 0], 46),
		"#fda4af",
		faceParts(),
	),
	makePreset(
		"shadow-rabbit",
		"The Shadow Rabbit",
		"A hand-shadow style rabbit: two long ears, a round head and a compact body, all suspended in a chaotic point cloud.",
		sweetSpot([0, 1.8, 5.3], [0, 1.7, 0], 47),
		"#c084fc",
		rabbitParts(),
	),
];
