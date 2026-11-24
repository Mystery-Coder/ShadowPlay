/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PuzzleLevel } from '../types';

export const PUZZLE_LEVELS: PuzzleLevel[] = [
  {
    id: 1,
    title: 'The Origami Rabbit',
    difficulty: 'Beginner',
    description: 'Arrange and rotate the objects so the shadow on the screen forms the silhouette of a rabbit with upright ears!',
    hint: 'Rotate the two slender rods so they stick upwards side-by-side like rabbit ears behind the round body.',
    targetThreshold: 78,
    solutionNote: 'A classic shadow puppet silhouette formed by combining a low sphere body with two upright tilted ears.',
    initialObjects: [
      {
        id: 'rabbit-body',
        name: 'Rabbit Body',
        shape: 'sphere',
        position: [0, 0.5, 0],
        rotation: [0, 0, 0],
        scale: [1.2, 1.0, 1.0],
        color: '#94a3b8',
      },
      {
        id: 'rabbit-ear-1',
        name: 'Left Ear Rod',
        shape: 'rod',
        position: [-0.6, 0.4, 0.5],
        rotation: [45, 20, 0],
        scale: [0.8, 0.8, 0.8],
        color: '#cbd5e1',
      },
      {
        id: 'rabbit-ear-2',
        name: 'Right Ear Rod',
        shape: 'rod',
        position: [0.6, 0.3, -0.4],
        rotation: [-30, 45, 10],
        scale: [0.8, 0.8, 0.8],
        color: '#cbd5e1',
      },
    ],
    initialLights: [
      {
        id: 'light-main',
        name: 'Key Light',
        type: 'spot',
        position: [0, 2.8, -5.5],
        targetPosition: [0, 2.0, 6.0],
        color: '#ffffff',
        intensity: 2.8,
        distance: 25,
        angle: 0.7,
        penumbra: 0.15,
        enabled: true,
        castShadow: true,
      },
    ],
  },
  {
    id: 2,
    title: 'The Utah Teapot',
    difficulty: 'Intermediate',
    description: 'Orient the 3D model so its projected shadow reveals the iconic teapot profile with handle on the left and spout on the right.',
    hint: 'Rotate the teapot so its spout extends to the right and handle curves outward to the left, perpendicular to the light beam.',
    targetThreshold: 80,
    solutionNote: 'Martin Newell designed the famous Utah Teapot in 1975 at the University of Utah, a foundational computer graphics benchmark.',
    initialObjects: [
      {
        id: 'teapot-hero',
        name: 'Teapot Model',
        shape: 'teapot',
        position: [0.2, 0.8, 0],
        rotation: [45, 90, 30],
        scale: [1.4, 1.4, 1.4],
        color: '#f59e0b',
      },
    ],
    initialLights: [
      {
        id: 'light-main',
        name: 'Key Light',
        type: 'spot',
        position: [0, 2.5, -5.5],
        targetPosition: [0, 2.0, 6.0],
        color: '#ffffff',
        intensity: 2.8,
        distance: 25,
        angle: 0.7,
        penumbra: 0.15,
        enabled: true,
        castShadow: true,
      },
    ],
  },
  {
    id: 3,
    title: 'Eagle in Flight',
    difficulty: 'Intermediate',
    description: 'Sculpt the shadow of a majestic bird soaring with outspread wings against the backdrop.',
    hint: 'Pitch the bird slightly forward or level with the light beam so the wings project their full span across the wall.',
    targetThreshold: 78,
    solutionNote: 'Demonstrates projection foreshortening: when wings tilt toward the light vector, their projected shadow area changes dramatically.',
    initialObjects: [
      {
        id: 'bird-hero',
        name: 'Soaring Eagle',
        shape: 'bird',
        position: [-0.1, 1.1, 0.2],
        rotation: [70, -40, 25],
        scale: [1.6, 1.6, 1.6],
        color: '#38bdf8',
      },
    ],
    initialLights: [
      {
        id: 'light-main',
        name: 'Key Light',
        type: 'spot',
        position: [0, 2.6, -5.5],
        targetPosition: [0, 2.0, 6.0],
        color: '#ffffff',
        intensity: 2.8,
        distance: 25,
        angle: 0.7,
        penumbra: 0.15,
        enabled: true,
        castShadow: true,
      },
    ],
  },
  {
    id: 4,
    title: 'The Antique Skeleton Key',
    difficulty: 'Advanced',
    description: 'Align the antique key to project its full ornamental profile with head, stem, and notched bit teeth.',
    hint: 'Rotate the key flat to the projection screen. If tilted in depth, the round bow becomes an ellipse and teeth vanish!',
    targetThreshold: 82,
    solutionNote: 'Shows how orthographic silhouettes preserve parallel features while oblique angles cause affine distortion.',
    initialObjects: [
      {
        id: 'key-hero',
        name: 'Antique Key',
        shape: 'key',
        position: [0.1, 0.9, -0.3],
        rotation: [-60, 45, 120],
        scale: [1.5, 1.5, 1.5],
        color: '#eab308',
      },
    ],
    initialLights: [
      {
        id: 'light-main',
        name: 'Key Light',
        type: 'spot',
        position: [0, 2.5, -5.5],
        targetPosition: [0, 2.0, 6.0],
        color: '#ffffff',
        intensity: 2.8,
        distance: 25,
        angle: 0.7,
        penumbra: 0.15,
        enabled: true,
        castShadow: true,
      },
    ],
  },
  {
    id: 5,
    title: 'The Throne of Shadows',
    difficulty: 'Master',
    description: 'Cast the stately silhouette of an ornate high-backed chair onto the screen by combining seat and backrest components.',
    hint: 'Align the chair so you see the profile of the seat, 4 vertical legs, and tall upright backrest.',
    targetThreshold: 80,
    solutionNote: 'Multi-part projection where negative space (the gaps between spindles and legs) is as important as the solid shadow.',
    initialObjects: [
      {
        id: 'chair-hero',
        name: 'Royal Throne',
        shape: 'chair',
        position: [-0.2, 0.7, 0.4],
        rotation: [30, -75, 15],
        scale: [1.3, 1.3, 1.3],
        color: '#a855f7',
      },
    ],
    initialLights: [
      {
        id: 'light-main',
        name: 'Key Light',
        type: 'spot',
        position: [0, 2.5, -5.5],
        targetPosition: [0, 2.0, 6.0],
        color: '#ffffff',
        intensity: 2.8,
        distance: 25,
        angle: 0.7,
        penumbra: 0.15,
        enabled: true,
        castShadow: true,
      },
    ],
  },
];

/**
 * Draws the ground-truth target silhouette on a 2D canvas of size W x H.
 * Generates clean binary silhouette mask.
 */
export function drawTargetSilhouette(
  ctx: CanvasRenderingContext2D,
  levelId: number,
  width: number,
  height: number
) {
  ctx.clearRect(0, 0, width, height);

  // Background is white/transparent, silhouette is black/dark fill
  ctx.fillStyle = '#000000';
  const cx = width / 2;
  const cy = height / 2;

  switch (levelId) {
    case 1: {
      // Rabbit: Body oval + head + 2 upright ears + small tail
      ctx.beginPath();
      // Body
      ctx.ellipse(cx - 5, cy + 28, 40, 32, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.beginPath();
      ctx.ellipse(cx + 24, cy - 2, 22, 20, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Nose bump
      ctx.beginPath();
      ctx.arc(cx + 42, cy - 2, 8, 0, Math.PI * 2);
      ctx.fill();

      // Left Ear
      ctx.beginPath();
      ctx.ellipse(cx + 18, cy - 42, 10, 34, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Right Ear
      ctx.beginPath();
      ctx.ellipse(cx + 34, cy - 44, 9, 32, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Tail
      ctx.beginPath();
      ctx.arc(cx - 44, cy + 26, 12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 2: {
      // Teapot: Body + Spout (right) + Handle (left) + Lid + Knob
      ctx.beginPath();
      // Body
      ctx.ellipse(cx, cy + 12, 48, 38, 0, 0, Math.PI * 2);
      ctx.fill();

      // Base
      ctx.fillRect(cx - 30, cy + 44, 60, 10);

      // Lid
      ctx.beginPath();
      ctx.ellipse(cx, cy - 22, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Knob
      ctx.beginPath();
      ctx.arc(cx, cy - 36, 8, 0, Math.PI * 2);
      ctx.fill();

      // Spout (right)
      ctx.beginPath();
      ctx.moveTo(cx + 35, cy + 20);
      ctx.quadraticCurveTo(cx + 70, cy + 10, cx + 75, cy - 15);
      ctx.lineTo(cx + 66, cy - 18);
      ctx.quadraticCurveTo(cx + 56, cy - 2, cx + 32, cy - 2);
      ctx.closePath();
      ctx.fill();

      // Handle (left) - outer arc then inner arc cutout
      ctx.beginPath();
      ctx.arc(cx - 45, cy + 10, 28, Math.PI * 0.45, Math.PI * 1.55, false);
      ctx.arc(cx - 45, cy + 10, 16, Math.PI * 1.55, Math.PI * 0.45, true);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 3: {
      // Eagle/Bird in flight: Wing span + body + beak + tail
      ctx.beginPath();
      // Left Wing
      ctx.moveTo(cx - 8, cy - 4);
      ctx.bezierCurveTo(cx - 40, cy - 45, cx - 75, cy - 40, cx - 85, cy - 18);
      ctx.bezierCurveTo(cx - 65, cy - 5, cx - 35, cy + 8, cx - 6, cy + 14);
      ctx.closePath();
      ctx.fill();

      // Right Wing
      ctx.beginPath();
      ctx.moveTo(cx + 8, cy - 4);
      ctx.bezierCurveTo(cx + 40, cy - 45, cx + 75, cy - 40, cx + 85, cy - 18);
      ctx.bezierCurveTo(cx + 65, cy - 5, cx + 35, cy + 8, cx + 6, cy + 14);
      ctx.closePath();
      ctx.fill();

      // Torso / Body
      ctx.beginPath();
      ctx.ellipse(cx, cy + 5, 14, 28, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head & Beak
      ctx.beginPath();
      ctx.arc(cx, cy - 24, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 28);
      ctx.lineTo(cx + 4, cy - 28);
      ctx.lineTo(cx, cy - 40);
      ctx.closePath();
      ctx.fill();

      // Tail fan
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 28);
      ctx.lineTo(cx - 24, cy + 55);
      ctx.lineTo(cx + 24, cy + 55);
      ctx.lineTo(cx + 8, cy + 28);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 4: {
      // Key: Ornate circular ring bow at top, long stem, 2 bit notches at bottom
      ctx.beginPath();
      // Outer bow
      ctx.arc(cx, cy - 42, 28, 0, Math.PI * 2);
      ctx.fill();

      // Inner cutout
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy - 42, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Shaft
      ctx.fillRect(cx - 6, cy - 16, 12, 70);

      // Collar
      ctx.fillRect(cx - 10, cy - 16, 20, 6);

      // Bit teeth on right
      ctx.fillRect(cx + 6, cy + 28, 22, 10);
      ctx.fillRect(cx + 6, cy + 42, 28, 12);
      break;
    }

    case 5: {
      // Throne / Chair: High back with finials, seat slab, 4 legs, cross rails
      // Backrest
      ctx.fillRect(cx - 28, cy - 60, 56, 12); // top rail
      ctx.fillRect(cx - 28, cy - 60, 8, 70); // left post
      ctx.fillRect(cx + 20, cy - 60, 8, 70); // right post
      ctx.fillRect(cx - 8, cy - 50, 16, 60); // center ornate splat

      // Seat
      ctx.fillRect(cx - 36, cy + 10, 72, 12);

      // Legs
      ctx.fillRect(cx - 32, cy + 22, 8, 42); // front-left
      ctx.fillRect(cx + 24, cy + 22, 8, 42); // front-right
      ctx.fillRect(cx - 24, cy + 22, 6, 38); // back-left
      ctx.fillRect(cx + 18, cy + 22, 6, 38); // back-right

      // Stretcher / cross rung
      ctx.fillRect(cx - 30, cy + 44, 60, 5);
      break;
    }
  }
}
