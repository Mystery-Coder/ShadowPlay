/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PuzzleLevel, ShapeType, StudioLight, StudioObject } from '../types';

export type Vec2 = [number, number];

interface PrimitiveBase {
  /** Cut-outs are erased from previously drawn geometry. */
  cutout?: boolean;
}

export interface EllipsePrimitive extends PrimitiveBase {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation?: number;
}

export interface CirclePrimitive extends PrimitiveBase {
  type: 'circle';
  cx: number;
  cy: number;
  r: number;
}

export interface RectPrimitive extends PrimitiveBase {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface PolygonPrimitive extends PrimitiveBase {
  type: 'polygon';
  points: Vec2[];
}

export interface PathPrimitive extends PrimitiveBase {
  type: 'path';
  d: string;
  fillRule?: 'nonzero' | 'evenodd';
}

export interface LinePrimitive extends PrimitiveBase {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export type SilhouettePrimitive =
  | EllipsePrimitive
  | CirclePrimitive
  | RectPrimitive
  | PolygonPrimitive
  | PathPrimitive
  | LinePrimitive;

export interface TargetSilhouette {
  viewBox: [number, number, number, number];
  primitives: SilhouettePrimitive[];
}

export interface SolutionFootprint {
  object: StudioObject;
  primitives: SilhouettePrimitive[];
}

export interface PuzzleLevelDefinition extends PuzzleLevel {
  targetSilhouette: TargetSilhouette;
  /** The exact arrangement that produces the target shadow. */
  solutionObjects: StudioObject[];
  solutionLights: StudioLight[];
}

type PuzzleDefinitionInput = Omit<
  PuzzleLevelDefinition,
  'targetImage' | 'targetSilhouette' | 'initialObjects' | 'initialLights' | 'solutionObjects' | 'solutionLights'
>;

/** Base hue per object type; individual objects get slightly shifted tones. */
const SHAPE_HUES: Record<ShapeType, number> = {
  cube: 200,
  sphere: 330,
  cylinder: 265,
  rod: 40,
  ring: 150,
  cone: 355,
  teapot: 30,
  bird: 190,
  chair: 285,
  key: 50,
  arch: 215,
  spiral: 25,
};

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (value: number) => Math.round(value * 255).toString(16).padStart(2, '0');
  return `#${hex(channel(0))}${hex(channel(8))}${hex(channel(4))}`;
}

/**
 * Every object instance gets its own vivid colour, while objects of the same
 * shape stay in the same colour family.
 */
function objectColor(shape: ShapeType, index: number): string {
  const hue = SHAPE_HUES[shape] + (index % 5) * 9;
  const saturation = 72 + (index % 3) * 6;
  const lightness = 52 + (index % 4) * 5;
  return hslToHex(hue, saturation, lightness);
}

const VIEW_BOX: [number, number, number, number] = [0, 0, 100, 100];
const CANVAS_SIZE = 100;
const WALL_WIDTH = 7;
const WALL_HEIGHT = 4.8;
const LIGHT_POSITION: [number, number, number] = [0, 2.8, -5.5];
const WALL_Z = 6;

/** Local height of each procedural model's geometric centre, measured from its pivot. */
const SHAPE_CENTRE_Y: Record<ShapeType, number> = {
  cube: 0.5,
  sphere: 0.6,
  cylinder: 0.6,
  rod: 1.0,
  ring: 0.75,
  cone: 0.7,
  teapot: 0.7,
  bird: 0.6,
  chair: 0.75,
  key: 1.0,
  arch: 0.75,
  spiral: 0.8,
};

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function projectionScale(z: number): number {
  return (WALL_Z - LIGHT_POSITION[2]) / (z - LIGHT_POSITION[2]);
}

/** Maps a world point onto the square target canvas (top-left origin). */
function canvasPoint(x: number, y: number, z: number): Vec2 {
  const k = projectionScale(z);
  const wallX = LIGHT_POSITION[0] + (x - LIGHT_POSITION[0]) * k;
  const wallY = LIGHT_POSITION[1] + (y - LIGHT_POSITION[1]) * k;
  return [
    ((wallX + WALL_WIDTH / 2) / WALL_WIDTH) * CANVAS_SIZE,
    ((WALL_HEIGHT - wallY) / WALL_HEIGHT) * CANVAS_SIZE,
  ];
}

function worldCentre(object: StudioObject): [number, number, number] {
  const localY = SHAPE_CENTRE_Y[object.shape] * object.scale[1];
  const radians = degToRad(object.rotation[2]);
  return [
    object.position[0] - localY * Math.sin(radians),
    object.position[1] + localY * Math.cos(radians),
    object.position[2],
  ];
}

function createKeyLight(overrides: Partial<StudioLight> = {}): StudioLight {
  return {
    id: 'light-main',
    name: 'Key Light',
    type: 'spot',
    position: [...LIGHT_POSITION] as [number, number, number],
    targetPosition: [0, 2.0, 6.0],
    color: '#ffffff',
    intensity: 4.0,
    distance: 25,
    angle: 0.7,
    penumbra: 0.1,
    enabled: true,
    castShadow: true,
    ...overrides,
  };
}

interface SolutionSpec {
  id: string;
  name: string;
  shape: ShapeType;
  /** Desired canvas centre of the object's projected mass. */
  cx: number;
  cy: number;
  scale: [number, number, number];
  rotation?: number;
}

/**
 * Converts a desired silhouette-centre into the world transform that projects
 * there. Every puzzle is therefore guaranteed to be solvable with its objects.
 */
function buildSolutionObject(spec: SolutionSpec): StudioObject {
  const k = projectionScale(0);
  const wallX = (spec.cx / CANVAS_SIZE) * WALL_WIDTH - WALL_WIDTH / 2;
  const wallY = WALL_HEIGHT * (1 - spec.cy / CANVAS_SIZE);
  const centreX = wallX / k;
  const centreY = LIGHT_POSITION[1] + (wallY - LIGHT_POSITION[1]) / k;

  const rotationZ = spec.rotation ?? 0;
  const radians = degToRad(rotationZ);
  const localY = SHAPE_CENTRE_Y[spec.shape] * spec.scale[1];

  return {
    id: spec.id,
    name: spec.name,
    shape: spec.shape,
    position: [
      round2(centreX + localY * Math.sin(radians)),
      round2(centreY - localY * Math.cos(radians)),
      0,
    ],
    rotation: [0, 0, rotationZ],
    scale: [...spec.scale] as [number, number, number],
    color: '#cbd5e1',
  };
}

function scrambleSolution(objects: StudioObject[], seed: number): StudioObject[] {
  return objects.map((object, index) => {
    const angle = ((index + seed) % 5) * 0.73;
    return {
      ...object,
      position: [
        round2(object.position[0] + Math.sin(angle) * 0.6),
        round2(Math.max(0.4, object.position[1] - 0.75)),
        round2(object.position[2] + Math.cos(angle) * 0.45),
      ],
      rotation: [
        0,
        (object.rotation[1] + 25) % 360,
        (object.rotation[2] + (index % 2 === 0 ? 35 : -35) + 360) % 360,
      ],
      scale: [
        round2(object.scale[0] * 0.85),
        round2(object.scale[1] * 0.85),
        round2(object.scale[2] * 0.85),
      ],
    };
  });
}

/** Approximate 2D footprint of a 3D model under the level's spotlight. */
function footprintFor(object: StudioObject): SilhouettePrimitive[] {
  const [wx, wy, wz] = worldCentre(object);
  const [cx, cy] = canvasPoint(wx, wy, wz);
  const k = projectionScale(wz);
  const sx = (k * CANVAS_SIZE) / WALL_WIDTH;
  const sy = (k * CANVAS_SIZE) / WALL_HEIGHT;
  const radians = degToRad(object.rotation[2]);
  const [scaleX, scaleY] = object.scale;

  const rectRotation = Math.atan2(-Math.sin(radians) * sy, -Math.cos(radians) * sx);
  const lineDirection: Vec2 = [Math.sin(radians) * sx, -Math.cos(radians) * sy];

  switch (object.shape) {
    case 'sphere':
      return [
        {
          type: 'ellipse',
          cx,
          cy,
          rx: round2(0.6 * scaleX * sx),
          ry: round2(0.6 * scaleY * sy),
        },
      ];

    case 'cube': {
      const width = scaleX * sx;
      const height = scaleY * sy;
      return [
        {
          type: 'rect',
          x: round2(cx - width / 2),
          y: round2(cy - height / 2),
          width: round2(width),
          height: round2(height),
          rotation: rectRotation,
        },
      ];
    }

    case 'cylinder': {
      const width = 1.0 * scaleX * sx;
      const height = 1.2 * scaleY * sy;
      return [
        {
          type: 'rect',
          x: round2(cx - width / 2),
          y: round2(cy - height / 2),
          width: round2(width),
          height: round2(height),
          rotation: rectRotation,
        },
      ];
    }

    case 'rod': {
      const half = scaleY;
      return [
        {
          type: 'line',
          x1: round2(cx - half * lineDirection[0]),
          y1: round2(cy - half * lineDirection[1]),
          x2: round2(cx + half * lineDirection[0]),
          y2: round2(cy + half * lineDirection[1]),
          width: round2(Math.max(2, 0.24 * scaleX * sx)),
        },
      ];
    }

    case 'ring':
      return [
        {
          type: 'ellipse',
          cx: round2(cx),
          cy: round2(cy),
          rx: round2(0.81 * scaleX * sx),
          ry: round2(0.81 * scaleY * sy),
        },
        {
          type: 'ellipse',
          cx: round2(cx),
          cy: round2(cy),
          rx: round2(0.49 * scaleX * sx),
          ry: round2(0.49 * scaleY * sy),
          cutout: true,
        },
      ];

    case 'cone': {
      const apexLocal = 0.7 * scaleY;
      const apexX = cx - apexLocal * Math.sin(radians) * sx;
      const apexY = cy - apexLocal * Math.cos(radians) * sy;
      const baseX = cx + apexLocal * Math.sin(radians) * sx;
      const baseY = cy + apexLocal * Math.cos(radians) * sy;
      const halfBaseX = Math.cos(radians) * 0.6 * scaleX * sx;
      const halfBaseY = Math.sin(radians) * 0.6 * scaleX * sy;
      return [
        {
          type: 'polygon',
          points: [
            [round2(apexX), round2(apexY)],
            [round2(baseX + halfBaseX), round2(baseY + halfBaseY)],
            [round2(baseX - halfBaseX), round2(baseY - halfBaseY)],
          ],
        },
      ];
    }

    case 'teapot':
      return [
        {
          type: 'ellipse',
          cx: round2(cx),
          cy: round2(cy),
          rx: round2(0.8 * scaleX * sx),
          ry: round2(0.65 * scaleY * sy),
        },
        {
          type: 'rect',
          x: round2(cx + 0.45 * scaleX * sx),
          y: round2(cy - 0.25 * scaleY * sy),
          width: round2(0.7 * scaleX * sx),
          height: round2(0.3 * scaleY * sy),
        },
        {
          type: 'ellipse',
          cx: round2(cx - 0.85 * scaleX * sx),
          cy: round2(cy),
          rx: round2(0.32 * scaleX * sx),
          ry: round2(0.42 * scaleY * sy),
        },
      ];

    case 'bird': {
      const wingX = -Math.cos(radians) * sx;
      const wingY = -Math.sin(radians) * sy;
      const span = 1.1 * scaleX;
      return [
        {
          type: 'ellipse',
          cx: round2(cx),
          cy: round2(cy),
          rx: round2(0.28 * scaleX * sx),
          ry: round2(0.65 * scaleY * sy),
        },
        {
          type: 'polygon',
          points: [
            [round2(cx + wingX * span * 0.1), round2(cy + wingY * span * 0.1)],
            [round2(cx + wingX * span), round2(cy + wingY * span - 0.25 * scaleY * sy)],
            [round2(cx + wingX * span * 0.35), round2(cy + wingY * span * 0.35 + 0.3 * scaleY * sy)],
          ],
        },
        {
          type: 'polygon',
          points: [
            [round2(cx - wingX * span * 0.1), round2(cy - wingY * span * 0.1)],
            [round2(cx - wingX * span), round2(cy - wingY * span - 0.25 * scaleY * sy)],
            [round2(cx - wingX * span * 0.35), round2(cy - wingY * span * 0.35 + 0.3 * scaleY * sy)],
          ],
        },
      ];
    }

    case 'chair': {
      const width = 0.9 * scaleX * sx;
      const height = 1.5 * scaleY * sy;
      return [
        {
          type: 'rect',
          x: round2(cx - width / 2),
          y: round2(cy - height / 2),
          width: round2(width),
          height: round2(height),
        },
      ];
    }

    case 'key': {
      const radius = 0.4 * scaleX * sx;
      return [
        { type: 'circle', cx: round2(cx), cy: round2(cy - 0.55 * scaleY * sy), r: round2(radius) },
        {
          type: 'circle',
          cx: round2(cx),
          cy: round2(cy - 0.55 * scaleY * sy),
          r: round2(radius * 0.45),
          cutout: true,
        },
        {
          type: 'line',
          x1: round2(cx),
          y1: round2(cy - 0.3 * scaleY * sy),
          x2: round2(cx),
          y2: round2(cy + 0.65 * scaleY * sy),
          width: round2(Math.max(2, 0.16 * scaleX * sx)),
        },
      ];
    }

    default:
      return [
        {
          type: 'ellipse',
          cx: round2(cx),
          cy: round2(cy),
          rx: round2(0.6 * scaleX * sx),
          ry: round2(0.6 * scaleY * sy),
        },
      ];
  }
}

function primitiveToSvg(primitive: SilhouettePrimitive, fill: string, stroke?: string): string {
  const rotationToSvg = (rotation?: number) => (rotation ? (rotation * 180) / Math.PI : 0);
  const strokeAttribute = stroke ? ` stroke="${stroke}" stroke-width="0.8"` : '';

  switch (primitive.type) {
    case 'ellipse': {
      const rotation = rotationToSvg(primitive.rotation);
      const transform = rotation
        ? ` transform="rotate(${rotation} ${primitive.cx} ${primitive.cy})"`
        : '';
      return `<ellipse cx="${primitive.cx}" cy="${primitive.cy}" rx="${primitive.rx}" ry="${primitive.ry}"${transform} fill="${fill}"${strokeAttribute}/>`;
    }
    case 'circle':
      return `<circle cx="${primitive.cx}" cy="${primitive.cy}" r="${primitive.r}" fill="${fill}"${strokeAttribute}/>`;
    case 'rect': {
      const rotation = rotationToSvg(primitive.rotation);
      const cx = primitive.x + primitive.width / 2;
      const cy = primitive.y + primitive.height / 2;
      const transform = rotation ? ` transform="rotate(${rotation} ${cx} ${cy})"` : '';
      return `<rect x="${primitive.x}" y="${primitive.y}" width="${primitive.width}" height="${primitive.height}"${transform} fill="${fill}"${strokeAttribute}/>`;
    }
    case 'polygon':
      return `<polygon points="${primitive.points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="${fill}"${strokeAttribute}/>`;
    case 'path':
      return `<path d="${primitive.d}" fill="${fill}" fill-rule="${primitive.fillRule ?? 'nonzero'}"${strokeAttribute}/>`;
    case 'line':
      return `<line x1="${primitive.x1}" y1="${primitive.y1}" x2="${primitive.x2}" y2="${primitive.y2}" stroke="${stroke ?? fill}" stroke-width="${primitive.width}" stroke-linecap="round"/>`;
  }
}

function buildTargetSvg(silhouette: TargetSilhouette): string {
  const [x, y, width, height] = silhouette.viewBox;
  const maskContent = silhouette.primitives
    .map((primitive) => primitiveToSvg(primitive, primitive.cutout ? '#000000' : '#ffffff'))
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}"><defs><mask id="silhouette" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${width}" height="${height}"><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#000000"/>${maskContent}</mask></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#000000" mask="url(#silhouette)"/></svg>`;
}

function buildSolutionDiagramSvg(footprints: SolutionFootprint[]): string {
  // Each object gets its own mask so cut-outs (ring holes, key bow) stay open
  // even when another object overlaps them.
  const defs = footprints
    .map(({ primitives }, index) => {
      const maskContent = primitives
        .map((primitive) => primitiveToSvg(primitive, primitive.cutout ? '#000000' : '#ffffff'))
        .join('');
      return `<mask id="footprint-${index}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect x="0" y="0" width="100" height="100" fill="#000000"/>${maskContent}</mask>`;
    })
    .join('');

  const shapes = footprints
    .map(
      ({ object }, index) =>
        `<rect x="0" y="0" width="100" height="100" fill="${object.color}" mask="url(#footprint-${index})"/>`
    )
    .join('');

  const outlines = footprints
    .flatMap(({ object, primitives }, index) =>
      primitives.map((primitive) =>
        primitiveToSvg(primitive, 'none', '#0f172a').replace(
          '/>',
          ` data-shape="${object.shape}" data-label="${index + 1}"/>`
        )
      )
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs>${defs}</defs><rect x="0" y="0" width="100" height="100" fill="#ffffff"/>${shapes}${outlines}</svg>`;
}

function buildTargetImage(silhouette: TargetSilhouette): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildTargetSvg(silhouette))}`;
}

function drawPrimitive(ctx: CanvasRenderingContext2D, primitive: SilhouettePrimitive): void {
  ctx.beginPath();

  switch (primitive.type) {
    case 'ellipse':
      ctx.ellipse(
        primitive.cx,
        primitive.cy,
        primitive.rx,
        primitive.ry,
        primitive.rotation ?? 0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      break;

    case 'circle':
      ctx.arc(primitive.cx, primitive.cy, primitive.r, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'rect': {
      if (primitive.rotation) {
        const cx = primitive.x + primitive.width / 2;
        const cy = primitive.y + primitive.height / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(primitive.rotation);
        ctx.rect(-primitive.width / 2, -primitive.height / 2, primitive.width, primitive.height);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.rect(primitive.x, primitive.y, primitive.width, primitive.height);
        ctx.fill();
      }
      break;
    }

    case 'polygon': {
      const [first, ...rest] = primitive.points;
      if (!first) break;
      ctx.moveTo(first[0], first[1]);
      for (const [x, y] of rest) ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'path': {
      const path = new Path2D(primitive.d);
      ctx.fill(path, primitive.fillRule ?? 'nonzero');
      break;
    }

    case 'line':
      ctx.lineWidth = primitive.width;
      ctx.lineCap = 'round';
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.moveTo(primitive.x1, primitive.y1);
      ctx.lineTo(primitive.x2, primitive.y2);
      ctx.stroke();
      break;
  }
}

function rodMidpoint(
  centreX: number,
  centreY: number,
  rotation: number,
  scaleY: number
): Vec2 {
  const radians = degToRad(rotation);
  const sx = projectionScale(0) * (CANVAS_SIZE / WALL_WIDTH);
  const sy = projectionScale(0) * (CANVAS_SIZE / WALL_HEIGHT);
  const dx = Math.sin(radians) * sx;
  const dy = -Math.cos(radians) * sy;
  const length = Math.hypot(dx, dy) || 1;
  const offset = (scaleY * Math.hypot(dx, dy)) / 2;
  return [round2(centreX + (dx / length) * offset), round2(centreY + (dy / length) * offset)];
}

function starSpecs(): SolutionSpec[] {
  const rotations = [0, 72, 144, 216, 288];
  const spokes = rotations.map((rotation, index) => {
    const [cx, cy] = rodMidpoint(50, 50, rotation, 0.42);
    return {
      id: `star-rod-${index + 1}`,
      name: `Star Point ${index + 1}`,
      shape: 'rod' as ShapeType,
      cx,
      cy,
      scale: [0.9, 0.42, 0.9] as [number, number, number],
      rotation,
    };
  });
  return [
    ...spokes,
    {
      id: 'star-hub',
      name: 'Star Hub',
      shape: 'cube',
      cx: 50,
      cy: 50,
      scale: [0.55, 0.4, 0.55],
    },
  ];
}

function compassSpecs(): SolutionSpec[] {
  const specs: SolutionSpec[] = [
    {
      id: 'compass-outer-ring',
      name: 'Outer Ring',
      shape: 'ring',
      cx: 50,
      cy: 50,
      scale: [1.5, 1.25, 1],
    },
    {
      id: 'compass-inner-ring',
      name: 'Inner Ring',
      shape: 'ring',
      cx: 50,
      cy: 50,
      scale: [0.85, 0.7, 1],
    },
    {
      id: 'compass-core',
      name: 'Central Gem',
      shape: 'sphere',
      cx: 50,
      cy: 50,
      scale: [0.5, 0.5, 1],
    },
  ];

  for (let index = 0; index < 8; index++) {
    const rotation = index * 45;
    const [cx, cy] = rodMidpoint(50, 50, rotation, 0.6);
    specs.push({
      id: `compass-spoke-${index + 1}`,
      name: `Spoke ${index + 1}`,
      shape: 'rod',
      cx,
      cy,
      scale: [0.3, 0.6, 0.3],
      rotation,
    });
  }

  const radiusX = 36;
  const radiusY = 44;
  for (const [index, rotation] of [0, 90, 180, 270].entries()) {
    const radians = degToRad(rotation);
    specs.push({
      id: `compass-pointer-${index + 1}`,
      name: `Pointer ${index + 1}`,
      shape: 'cone',
      cx: round2(50 - Math.sin(radians) * radiusX * 0.65),
      cy: round2(50 - Math.cos(radians) * radiusY * 0.65),
      scale: [0.35, 0.5, 1],
      rotation,
    });
  }

  for (const [index, rotation] of [45, 135, 225, 315].entries()) {
    const radians = degToRad(rotation);
    specs.push({
      id: `compass-jewel-${index + 1}`,
      name: `Jewel ${index + 1}`,
      shape: 'sphere',
      cx: round2(50 - Math.sin(radians) * radiusX * 0.45),
      cy: round2(50 - Math.cos(radians) * radiusY * 0.45),
      scale: [0.3, 0.3, 1],
    });
  }

  return specs;
}

interface LevelInput extends PuzzleDefinitionInput {
  solution: SolutionSpec[];
}

const LEVEL_INPUTS: LevelInput[] = [
  {
    id: 1,
    title: 'The Utah Teapot',
    difficulty: 'Beginner',
    description:
      'Orient the 3D model so its projected shadow reveals the iconic teapot profile with handle on the left and spout on the right.',
    hint: 'Rotate the teapot so its spout extends to the right and handle curves outward to the left, perpendicular to the light beam.',
    hints: [
      'Rotate the teapot so its spout extends to the right and handle curves outward to the left, perpendicular to the light beam.',
      'Turn the teapot until its side profile faces the wall. A flat-on view preserves both the spout and the handle.',
      'If the handle disappears, you are looking through the teapot rather than at its side.',
    ],
    targetThreshold: 76,
    allowedShapes: ['teapot', 'sphere', 'cylinder', 'cone', 'ring'],
    solutionNote:
      'A single teapot model supplies the whole silhouette. Its side profile supplies the round body, the lid, the spout and the handle.',
    solution: [
      {
        id: 'teapot-hero',
        name: 'Teapot Model',
        shape: 'teapot',
        cx: 50,
        cy: 52,
        scale: [1.3, 1.3, 1.3],
      },
    ],
  },
  {
    id: 2,
    title: 'Eagle in Flight',
    difficulty: 'Beginner',
    description:
      'Sculpt the shadow of a majestic bird soaring with outspread wings against the backdrop.',
    hint: 'Pitch the bird slightly forward or level with the light beam so the wings project their full span across the wall.',
    hints: [
      'Pitch the bird slightly forward or level with the light beam so the wings project their full span across the wall.',
      'The wings should be parallel to the wall. Edge-on wings collapse into a thin line.',
      'Raise the bird until its body sits near the middle of the screen and its tail points down.',
    ],
    targetThreshold: 74,
    allowedShapes: ['bird', 'sphere', 'cone', 'rod', 'cube'],
    solutionNote:
      'The bird model alone forms the eagle. Keeping its wings broadside to the spotlight preserves the full wingspan in shadow.',
    solution: [
      {
        id: 'bird-hero',
        name: 'Soaring Eagle',
        shape: 'bird',
        cx: 50,
        cy: 46,
        scale: [1.0, 0.8, 1.0],
      },
    ],
  },
  {
    id: 3,
    title: 'The Throne of Shadows',
    difficulty: 'Beginner',
    description:
      'Cast the stately silhouette of an ornate high-backed chair onto the screen by combining seat and backrest components.',
    hint: 'Align the chair so you see the profile of the seat, 4 vertical legs, and tall upright backrest.',
    hints: [
      'Align the chair so you see the profile of the seat, 4 vertical legs, and tall upright backrest.',
      'The gaps between the legs and spindles are part of the puzzle. Do not fill them in with extra objects.',
      'Face the chair sideways to the wall so the backrest and seat overlap into one clean profile.',
    ],
    targetThreshold: 76,
    allowedShapes: ['chair', 'cube', 'rod', 'cylinder', 'sphere'],
    solutionNote:
      'The chair model is the entire sculpture. Its legs, seat and backrest already contain the negative space in the target.',
    solution: [
      {
        id: 'chair-hero',
        name: 'Royal Throne',
        shape: 'chair',
        cx: 50,
        cy: 50,
        scale: [1.4, 1.2, 1.4],
      },
    ],
  },
  {
    id: 4,
    title: 'The Origami Rabbit',
    difficulty: 'Beginner',
    description:
      'Arrange and rotate the objects so the shadow on the screen forms the silhouette of a rabbit with upright ears!',
    hint: 'Rotate the two slender rods so they stick upwards side-by-side like rabbit ears behind the round body.',
    hints: [
      'Rotate the two slender rods so they stick upwards side-by-side like rabbit ears behind the round body.',
      'Keep the round body low and wide, then move the two rods close together above its head.',
      'The ears should be almost vertical. A small tilt outward makes the rabbit read more clearly.',
    ],
    targetThreshold: 76,
    allowedShapes: ['sphere', 'rod', 'cylinder', 'ring'],
    solutionNote:
      'A classic shadow-puppet silhouette: one low sphere becomes the whole body and head, while two tilted rods become the ears.',
    solution: [
      {
        id: 'rabbit-body',
        name: 'Rabbit Body',
        shape: 'sphere',
        cx: 48,
        cy: 64,
        scale: [1.5, 1.0, 1],
      },
      {
        id: 'rabbit-ear-left',
        name: 'Left Ear Rod',
        shape: 'rod',
        cx: 40,
        cy: 28,
        scale: [1.0, 0.4, 1.0],
        rotation: 8,
      },
      {
        id: 'rabbit-ear-right',
        name: 'Right Ear Rod',
        shape: 'rod',
        cx: 58,
        cy: 28,
        scale: [1.0, 0.4, 1.0],
        rotation: -8,
      },
    ],
  },
  {
    id: 5,
    title: 'The Antique Skeleton Key',
    difficulty: 'Beginner',
    description:
      'Align the antique key to project its full ornamental profile with head, stem, and notched bit teeth.',
    hint: 'Rotate the key flat to the projection screen. If tilted in depth, the round bow becomes an ellipse and teeth vanish!',
    hints: [
      'Rotate the key flat to the projection screen. If tilted in depth, the round bow becomes an ellipse and teeth vanish!',
      'The bow should look like a ring, the shaft should be vertical, and the teeth should point to the right.',
      'Lift or lower the key until the bow and the teeth both fit inside the target silhouette.',
    ],
    targetThreshold: 76,
    allowedShapes: ['key', 'rod', 'cylinder', 'cube'],
    solutionNote:
      'A single key model supplies the ring-shaped bow, long shaft and bit teeth when its profile is parallel to the wall.',
    solution: [
      {
        id: 'key-hero',
        name: 'Antique Key',
        shape: 'key',
        cx: 50,
        cy: 50,
        scale: [1.2, 1.2, 1.2],
      },
    ],
  },
  {
    id: 6,
    title: 'The Little House',
    difficulty: 'Intermediate',
    description:
      'Build a house silhouette with a rectangular body, a pitched roof, and a chimney on top.',
    hint: 'Widen the cube into the house body, then set the cone on top to form the roof.',
    hints: [
      'Widen the cube into the house body, then set the cone on top to form the roof.',
      'The chimney needs to rise above the roof line; keep it narrow so it reads as a chimney and not a second roof.',
      'Centre the door and windows by leaving the body silhouette solid. Extra objects will only blur the outline.',
    ],
    targetThreshold: 74,
    allowedShapes: ['cube', 'cone', 'cylinder', 'rod'],
    solutionNote:
      'The house is exactly three objects: a wide cube for the body, a wide cone for the pitched roof, and a narrow cube for the chimney.',
    solution: [
      {
        id: 'house-body',
        name: 'House Body',
        shape: 'cube',
        cx: 50,
        cy: 64,
        scale: [1.8, 1.4, 0.8],
      },
      {
        id: 'house-roof',
        name: 'Roof Cone',
        shape: 'cone',
        cx: 50,
        cy: 36,
        scale: [1.8, 1.0, 0.8],
      },
      {
        id: 'house-chimney',
        name: 'Chimney',
        shape: 'cube',
        cx: 70,
        cy: 24,
        scale: [0.35, 0.7, 0.35],
      },
    ],
  },
  {
    id: 7,
    title: 'The River Fish',
    difficulty: 'Intermediate',
    description:
      'Shape a fish silhouette with a rounded body, a forked tail, a dorsal fin, and a pectoral fin.',
    hint: 'Lay the body horizontally, attach the tail cone at the rear, and raise the dorsal fin above the back.',
    hints: [
      'Lay the body horizontally, attach the tail cone at the rear, and raise the dorsal fin above the back.',
      'The tail is the widest part of the silhouette. Rotate its cone so it points sideways.',
      'The pectoral fin should overlap the body slightly; a detached fin looks like debris.',
    ],
    targetThreshold: 72,
    allowedShapes: ['sphere', 'cone', 'rod', 'cylinder', 'cube'],
    solutionNote:
      'Four objects make the fish: an elongated sphere body, a sideways cone tail and two smaller cones for the fins.',
    solution: [
      {
        id: 'fish-body',
        name: 'Fish Body',
        shape: 'sphere',
        cx: 56,
        cy: 50,
        scale: [1.6, 0.8, 0.7],
      },
      {
        id: 'fish-tail',
        name: 'Tail Cone',
        shape: 'cone',
        cx: 24,
        cy: 50,
        scale: [0.65, 0.65, 0.65],
        rotation: 90,
      },
      {
        id: 'fish-dorsal',
        name: 'Dorsal Fin',
        shape: 'cone',
        cx: 52,
        cy: 30,
        scale: [0.5, 0.5, 0.5],
      },
      {
        id: 'fish-pectoral',
        name: 'Pectoral Fin',
        shape: 'cone',
        cx: 58,
        cy: 64,
        scale: [0.45, 0.45, 0.45],
        rotation: 120,
      },
    ],
  },
  {
    id: 8,
    title: 'The Sitting Cat',
    difficulty: 'Intermediate',
    description:
      'Build a seated cat silhouette: round body, round head, two pointed ears, and a curling tail.',
    hint: 'Stack the round body under the smaller head, then point the two cones upward like ears.',
    hints: [
      'Stack the round body under the smaller head, then point the two cones upward like ears.',
      'The ears are small triangles, so keep the cones close to the head and tilt them outward slightly.',
      'Curve the tail rod around the base of the body instead of hiding it behind the cat.',
    ],
    targetThreshold: 72,
    allowedShapes: ['sphere', 'cone', 'rod', 'cylinder'],
    solutionNote:
      'The cat is assembled from five objects: one large body sphere, a smaller head sphere, two cone ears and one thin tail rod.',
    solution: [
      {
        id: 'cat-body',
        name: 'Cat Body',
        shape: 'sphere',
        cx: 44,
        cy: 66,
        scale: [1.4, 1.1, 1],
      },
      {
        id: 'cat-head',
        name: 'Cat Head',
        shape: 'sphere',
        cx: 53,
        cy: 40,
        scale: [0.9, 0.9, 0.9],
      },
      {
        id: 'cat-ear-left',
        name: 'Left Ear Cone',
        shape: 'cone',
        cx: 45,
        cy: 22,
        scale: [0.45, 0.45, 0.45],
        rotation: 12,
      },
      {
        id: 'cat-ear-right',
        name: 'Right Ear Cone',
        shape: 'cone',
        cx: 61,
        cy: 22,
        scale: [0.45, 0.45, 0.45],
        rotation: -12,
      },
      {
        id: 'cat-tail',
        name: 'Tail Rod',
        shape: 'rod',
        cx: 21,
        cy: 64,
        scale: [1.0, 0.35, 1],
        rotation: 60,
      },
    ],
  },
  {
    id: 9,
    title: 'The Old Oak',
    difficulty: 'Intermediate',
    description:
      'Grow a tree silhouette from a trunk and a cluster of round canopies, with branches reaching outward.',
    hint: 'Stand the cylinder upright for the trunk, then cluster the spheres above it to form the crown.',
    hints: [
      'Stand the cylinder upright for the trunk, then cluster the spheres above it to form the crown.',
      'Overlap the canopy spheres so they read as one leafy mass rather than separate balls.',
      'Add the rod branches only where the crown has empty gaps. Too many branches make the tree look like a bush.',
    ],
    targetThreshold: 72,
    allowedShapes: ['cylinder', 'sphere', 'cone', 'rod'],
    solutionNote:
      'A narrow upright cylinder anchors the tree and three overlapping spheres form the crown. The rod is a small side branch.',
    solution: [
      {
        id: 'tree-trunk',
        name: 'Tree Trunk',
        shape: 'cylinder',
        cx: 50,
        cy: 68,
        scale: [0.7, 1.2, 0.7],
      },
      {
        id: 'tree-canopy-left',
        name: 'Left Canopy',
        shape: 'sphere',
        cx: 34,
        cy: 42,
        scale: [0.9, 0.9, 0.9],
      },
      {
        id: 'tree-canopy-top',
        name: 'Top Canopy',
        shape: 'sphere',
        cx: 50,
        cy: 30,
        scale: [1.1, 1.1, 1.1],
      },
      {
        id: 'tree-canopy-right',
        name: 'Right Canopy',
        shape: 'sphere',
        cx: 66,
        cy: 42,
        scale: [0.9, 0.9, 0.9],
      },
      {
        id: 'tree-branch',
        name: 'Branch Rod',
        shape: 'rod',
        cx: 66,
        cy: 57,
        scale: [0.8, 0.25, 0.8],
        rotation: 45,
      },
    ],
  },
  {
    id: 10,
    title: 'The Human Profile',
    difficulty: 'Intermediate',
    description:
      'Compose a side-profile bust: head, nose, neck, and shoulders facing to the right.',
    hint: 'Turn the head to face right, use a cone for the nose, and widen the shoulders below the neck.',
    hints: [
      'Turn the head to face right, use a cone for the nose, and widen the shoulders below the neck.',
      'The nose must stick out from the face; a cone rotated sideways gives the cleanest profile.',
      'Leave a small gap under the chin so the neck reads separately from the jaw.',
    ],
    targetThreshold: 74,
    allowedShapes: ['sphere', 'cone', 'cylinder', 'cube', 'rod'],
    solutionNote:
      'Four objects make the bust: a sphere head, a sideways cone nose, a cylinder neck and a wide cube for the shoulders.',
    solution: [
      {
        id: 'human-head',
        name: 'Profile Head',
        shape: 'sphere',
        cx: 45,
        cy: 30,
        scale: [1.0, 1.0, 1.0],
      },
      {
        id: 'human-nose',
        name: 'Nose Cone',
        shape: 'cone',
        cx: 66,
        cy: 32,
        scale: [0.5, 0.35, 0.5],
        rotation: -90,
      },
      {
        id: 'human-neck',
        name: 'Neck Cylinder',
        shape: 'cylinder',
        cx: 45,
        cy: 52,
        scale: [0.6, 0.7, 0.6],
      },
      {
        id: 'human-shoulders',
        name: 'Shoulder Block',
        shape: 'cube',
        cx: 50,
        cy: 76,
        scale: [1.8, 0.6, 0.8],
      },
    ],
  },
  {
    id: 11,
    title: 'The Butterfly',
    difficulty: 'Advanced',
    description:
      'Create a butterfly silhouette with four wings, a narrow body, and two antennae.',
    hint: 'Spread the four wing shapes symmetrically around the body and tilt the antennae outward.',
    hints: [
      'Spread the four wing shapes symmetrically around the body and tilt the antennae outward.',
      'The upper wings are larger than the lower wings. Match that size difference.',
      'Keep the body thin. If the wings merge into one blob, move them farther apart.',
    ],
    targetThreshold: 74,
    allowedShapes: ['sphere', 'rod', 'ring', 'cone', 'cylinder'],
    solutionNote:
      'Seven objects build the butterfly: one thin rod body, four flattened sphere wings and two short antenna rods.',
    solution: [
      {
        id: 'butterfly-body',
        name: 'Butterfly Body',
        shape: 'rod',
        cx: 50,
        cy: 50,
        scale: [1.0, 0.35, 1],
      },
      {
        id: 'butterfly-wing-upper-left',
        name: 'Upper Left Wing',
        shape: 'sphere',
        cx: 32,
        cy: 38,
        scale: [1.0, 0.55, 0.5],
        rotation: -20,
      },
      {
        id: 'butterfly-wing-upper-right',
        name: 'Upper Right Wing',
        shape: 'sphere',
        cx: 68,
        cy: 38,
        scale: [1.0, 0.55, 0.5],
        rotation: 20,
      },
      {
        id: 'butterfly-wing-lower-left',
        name: 'Lower Left Wing',
        shape: 'sphere',
        cx: 34,
        cy: 62,
        scale: [0.8, 0.45, 0.5],
        rotation: 20,
      },
      {
        id: 'butterfly-wing-lower-right',
        name: 'Lower Right Wing',
        shape: 'sphere',
        cx: 66,
        cy: 62,
        scale: [0.8, 0.45, 0.5],
        rotation: -20,
      },
      {
        id: 'butterfly-antenna-left',
        name: 'Left Antenna',
        shape: 'rod',
        cx: 45,
        cy: 28,
        scale: [0.8, 0.18, 0.8],
        rotation: -35,
      },
      {
        id: 'butterfly-antenna-right',
        name: 'Right Antenna',
        shape: 'rod',
        cx: 55,
        cy: 28,
        scale: [0.8, 0.18, 0.8],
        rotation: 35,
      },
    ],
  },
  {
    id: 12,
    title: 'The Moon Rocket',
    difficulty: 'Advanced',
    description:
      'Assemble a rocket silhouette: pointed nose, tall body, side fins, and a flared engine nozzle.',
    hint: 'Stack the cylinder body under the nose cone, then flare the side cones outward as fins.',
    hints: [
      'Stack the cylinder body under the nose cone, then flare the side cones outward as fins.',
      'The nose cone must sit exactly on top of the body. A gap breaks the rocket outline.',
      'The fins are widest at the bottom. Rotate them so they spread away from the body.',
    ],
    targetThreshold: 76,
    allowedShapes: ['cylinder', 'cone', 'cube', 'rod'],
    solutionNote:
      'Five stacked primitives form the rocket: a cylinder body, one nose cone, two angled fin cones and a short nozzle cylinder.',
    solution: [
      {
        id: 'rocket-body',
        name: 'Rocket Body',
        shape: 'cylinder',
        cx: 50,
        cy: 55,
        scale: [0.8, 1.4, 0.8],
      },
      {
        id: 'rocket-nose',
        name: 'Nose Cone',
        shape: 'cone',
        cx: 50,
        cy: 22,
        scale: [0.8, 0.7, 0.8],
      },
      {
        id: 'rocket-fin-left',
        name: 'Left Fin',
        shape: 'cone',
        cx: 34,
        cy: 78,
        scale: [0.5, 0.5, 0.5],
        rotation: 35,
      },
      {
        id: 'rocket-fin-right',
        name: 'Right Fin',
        shape: 'cone',
        cx: 66,
        cy: 78,
        scale: [0.5, 0.5, 0.5],
        rotation: -35,
      },
      {
        id: 'rocket-nozzle',
        name: 'Engine Nozzle',
        shape: 'cylinder',
        cx: 50,
        cy: 88,
        scale: [0.6, 0.25, 0.6],
      },
    ],
  },
  {
    id: 13,
    title: 'The Bicycle',
    difficulty: 'Master',
    description:
      'Build a bicycle silhouette with two ring wheels, a diamond frame, a seat, and handlebars.',
    hint: 'Place the two rings as wheels, then connect them with thin rods to form the frame triangle.',
    hints: [
      'Place the two rings as wheels, then connect them with thin rods to form the frame triangle.',
      'The wheels need clear holes. Do not put thick geometry through the centre of both rings.',
      'The seat and handlebars sit above the frame; keep them small so the wheels remain the dominant shapes.',
    ],
    targetThreshold: 76,
    allowedShapes: ['ring', 'rod', 'cylinder', 'cube', 'sphere'],
    solutionNote:
      'Two ring wheels supply the open circles; four thin rods form the frame, with a small cube seat and one rod handlebar.',
    solution: [
      {
        id: 'bike-wheel-rear',
        name: 'Rear Wheel',
        shape: 'ring',
        cx: 24,
        cy: 68,
        scale: [0.9, 0.9, 0.9],
      },
      {
        id: 'bike-wheel-front',
        name: 'Front Wheel',
        shape: 'ring',
        cx: 76,
        cy: 68,
        scale: [0.9, 0.9, 0.9],
      },
      {
        id: 'bike-frame-top',
        name: 'Top Frame Rod',
        shape: 'rod',
        cx: 50,
        cy: 57,
        scale: [0.8, 0.35, 0.8],
        rotation: 90,
      },
      {
        id: 'bike-frame-left',
        name: 'Left Frame Rod',
        shape: 'rod',
        cx: 37,
        cy: 61,
        scale: [0.8, 0.35, 0.8],
        rotation: 45,
      },
      {
        id: 'bike-frame-right',
        name: 'Right Frame Rod',
        shape: 'rod',
        cx: 63,
        cy: 61,
        scale: [0.8, 0.35, 0.8],
        rotation: -45,
      },
      {
        id: 'bike-seat',
        name: 'Seat',
        shape: 'cube',
        cx: 43,
        cy: 47,
        scale: [0.5, 0.15, 0.3],
      },
      {
        id: 'bike-handlebar',
        name: 'Handlebar',
        shape: 'rod',
        cx: 70,
        cy: 47,
        scale: [0.8, 0.25, 0.8],
        rotation: 70,
      },
    ],
  },
  {
    id: 14,
    title: 'The Guiding Star',
    difficulty: 'Master',
    description:
      'Build a five-pointed star from multiple rods and a central hub, then project it as one clean symbol.',
    hint: 'Radiate five rods from a central point and use the cube to hide the messy intersection at the hub.',
    hints: [
      'Radiate five rods from a central point and use the cube to hide the messy intersection at the hub.',
      'Each star point is a pair of rod ends meeting at a sharp angle. Aim for equal-length points.',
      'Rotate the whole assembly until one point aims straight up. Symmetry is what makes the star read.',
    ],
    targetThreshold: 76,
    allowedShapes: ['rod', 'cube', 'cone', 'sphere'],
    solutionNote:
      'Five rods radiate from a shared centre and a small cube covers the hub. The union of the thin rods becomes one star symbol.',
    solution: starSpecs(),
  },
  {
    id: 15,
    title: 'The Celestial Compass',
    difficulty: 'Master',
    description:
      'Assemble a celestial compass: nested rings, eight radial spokes, four pointer cones and orbiting jewels that cast one intricate symbol.',
    hint: 'Start with the two concentric rings, add eight spokes through the centre, then place the four cones and four jewels around the rim.',
    hints: [
      'Start with the two concentric rings, then add eight spokes radiating from the shared centre.',
      'The four cones sit at the tips of the inner cross; keep their points aimed outward.',
      'Finish with four small spheres on the diagonals and make the whole outline symmetrical.',
    ],
    targetThreshold: 78,
    allowedShapes: ['ring', 'rod', 'cone', 'sphere'],
    solutionNote:
      'Two nested rings frame eight thin spokes. Four cones point outward at the cardinal directions and four small spheres mark the diagonals, forming a single compass rose silhouette.',
    solution: compassSpecs(),
  },
];

const PAR_SECONDS: Record<PuzzleLevel['difficulty'], number> = {
  Beginner: 120,
  Intermediate: 180,
  Advanced: 240,
  Master: 300,
};

export const PUZZLE_LEVELS: PuzzleLevelDefinition[] = LEVEL_INPUTS.map((input, index) => {
  const solutionLights = [createKeyLight()];
  const solutionObjects = input.solution.map((spec, objectIndex) => ({
    ...buildSolutionObject(spec),
    color: objectColor(spec.shape, objectIndex),
  }));
  const targetSilhouette: TargetSilhouette = {
    viewBox: VIEW_BOX,
    primitives: solutionObjects.flatMap(footprintFor),
  };

  return {
    ...input,
    solutionLights,
    solutionObjects,
    targetSilhouette,
    targetImage: buildTargetImage(targetSilhouette),
    initialObjects: scrambleSolution(solutionObjects, index + 1),
    initialLights: [createKeyLight()],
    timerSeconds: input.timerSeconds ?? PAR_SECONDS[input.difficulty],
  };
});

export function getPuzzleLevel(levelId: number): PuzzleLevelDefinition | undefined {
  return PUZZLE_LEVELS.find((level) => level.id === levelId);
}

/** Labelled 2D diagram showing exactly which object forms which part of the shadow. */
export function getSolutionDiagramImage(levelId: number): string | null {
  const level = getPuzzleLevel(levelId);
  if (!level) return null;
  const footprints: SolutionFootprint[] = level.solutionObjects.map((object) => ({
    object,
    primitives: footprintFor(object),
  }));
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildSolutionDiagramSvg(footprints))}`;
}

/**
 * Draws the ground-truth target silhouette on a 2D canvas of size width x height.
 */
export function drawTargetSilhouette(
  ctx: CanvasRenderingContext2D,
  levelId: number,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  const level = getPuzzleLevel(levelId);
  if (!level) {
    ctx.restore();
    return;
  }

  const [vx, vy, vw, vh] = level.targetSilhouette.viewBox;
  ctx.scale(width / vw, height / vh);
  ctx.translate(-vx, -vy);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';

  for (const primitive of level.targetSilhouette.primitives) {
    ctx.globalCompositeOperation = primitive.cutout ? 'destination-out' : 'source-over';
    drawPrimitive(ctx, primitive);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

export function cloneObjects(objects: StudioObject[]): StudioObject[] {
  return objects.map((object) => ({
    ...object,
    position: [...object.position] as [number, number, number],
    rotation: [...object.rotation] as [number, number, number],
    scale: [...object.scale] as [number, number, number],
  }));
}

export function cloneLights(lights: StudioLight[]): StudioLight[] {
  return lights.map((light) => ({
    ...light,
    position: [...light.position] as [number, number, number],
    targetPosition: [...light.targetPosition] as [number, number, number],
  }));
}