/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnamorphicPreset } from '../types';

export const ANAMORPHIC_PRESETS: AnamorphicPreset[] = [
  {
    id: 'secret-heart',
    name: 'The Secret Heart',
    description: 'A chaotic cloud of 8 floating cubes and rods scattered across depth that mysteriously merges into a glowing heart when viewed from the precise peep-hole!',
    sweetSpot: {
      position: [0, 1.8, 6.2],
      lookAt: [0, 1.6, 0],
      fov: 42,
    },
    revealColor: '#f43f5e',
    objects: [
      // Left lobe top curve
      {
        id: 'h-1',
        name: 'Left Lobe Apex',
        shape: 'cube',
        position: [-0.62, 2.15, -1.2],
        rotation: [12, -8, 25],
        scale: [0.65, 0.45, 0.45],
        color: '#fb7185',
      },
      // Left lobe outer curve
      {
        id: 'h-2',
        name: 'Left Lobe Flank',
        shape: 'rod',
        position: [-1.22, 1.72, 0.8],
        rotation: [45, 10, -35],
        scale: [0.55, 0.65, 0.55],
        color: '#f43f5e',
      },
      // Right lobe top curve
      {
        id: 'h-3',
        name: 'Right Lobe Apex',
        shape: 'cube',
        position: [0.62, 2.15, -0.6],
        rotation: [-10, 15, -25],
        scale: [0.65, 0.45, 0.45],
        color: '#fb7185',
      },
      // Right lobe outer curve
      {
        id: 'h-4',
        name: 'Right Lobe Flank',
        shape: 'rod',
        position: [1.22, 1.72, 1.4],
        rotation: [-35, 12, 35],
        scale: [0.55, 0.65, 0.55],
        color: '#f43f5e',
      },
      // Left bottom taper
      {
        id: 'h-5',
        name: 'Left Lower Beam',
        shape: 'rod',
        position: [-0.75, 1.05, -1.8],
        rotation: [-20, 15, -55],
        scale: [0.5, 0.85, 0.5],
        color: '#e11d48',
      },
      // Right bottom taper
      {
        id: 'h-6',
        name: 'Right Lower Beam',
        shape: 'rod',
        position: [0.75, 1.05, 0.2],
        rotation: [15, -20, 55],
        scale: [0.5, 0.85, 0.5],
        color: '#e11d48',
      },
      // Bottom apex point
      {
        id: 'h-7',
        name: 'Heart Tip Node',
        shape: 'sphere',
        position: [0.0, 0.55, 2.2],
        rotation: [0, 0, 45],
        scale: [0.5, 0.5, 0.5],
        color: '#be123c',
      },
      // Center cleave notch
      {
        id: 'h-8',
        name: 'Center Cleft Block',
        shape: 'cube',
        position: [0.0, 1.82, -2.5],
        rotation: [45, 45, 0],
        scale: [0.45, 0.45, 0.45],
        color: '#fda4af',
      },
    ],
  },
  {
    id: 'impossible-star',
    name: 'The 5-Point Star',
    description: 'Five slender angular rods hovering in a spatial spiral that collapse into a crisp five-pointed star only from one vantage point.',
    sweetSpot: {
      position: [1.8, 2.1, 5.8],
      lookAt: [0, 1.6, 0],
      fov: 40,
    },
    revealColor: '#eab308',
    objects: [
      {
        id: 's-1',
        name: 'Top Vertex Ray',
        shape: 'rod',
        position: [-0.3, 2.35, -1.5],
        rotation: [15, 20, 18],
        scale: [0.5, 0.9, 0.5],
        color: '#fde047',
      },
      {
        id: 's-2',
        name: 'Right Upper Point',
        shape: 'rod',
        position: [0.95, 1.8, 0.8],
        rotation: [-18, 10, -54],
        scale: [0.5, 0.85, 0.5],
        color: '#eab308',
      },
      {
        id: 's-3',
        name: 'Right Lower Point',
        shape: 'rod',
        position: [0.65, 0.85, -2.2],
        rotation: [30, -15, 18],
        scale: [0.5, 0.85, 0.5],
        color: '#ca8a04',
      },
      {
        id: 's-4',
        name: 'Left Lower Point',
        shape: 'rod',
        position: [-0.75, 0.95, 1.4],
        rotation: [-25, 15, -18],
        scale: [0.5, 0.85, 0.5],
        color: '#ca8a04',
      },
      {
        id: 's-5',
        name: 'Left Upper Point',
        shape: 'rod',
        position: [-1.05, 1.75, -0.6],
        rotation: [12, -18, 54],
        scale: [0.5, 0.85, 0.5],
        color: '#eab308',
      },
    ],
  },
  {
    id: 'rv-monogram',
    name: "RV Monogram (Team 1RV23)",
    description: 'A tribute to the CGVR seventh-semester team: separate 3D blocks that converge into the iconic "RV" emblem.',
    sweetSpot: {
      position: [0.0, 1.6, 6.0],
      lookAt: [0, 1.5, 0],
      fov: 42,
    },
    revealColor: '#38bdf8',
    objects: [
      // 'R' vertical stem
      {
        id: 'rv-1',
        name: 'R Stem',
        shape: 'rod',
        position: [-1.4, 1.5, -1.8],
        rotation: [0, 0, 0],
        scale: [0.55, 1.1, 0.55],
        color: '#38bdf8',
      },
      // 'R' upper loop
      {
        id: 'rv-2',
        name: 'R Loop',
        shape: 'ring',
        position: [-0.95, 2.05, 0.5],
        rotation: [0, 0, 0],
        scale: [0.65, 0.65, 0.65],
        color: '#0284c7',
      },
      // 'R' leg
      {
        id: 'rv-3',
        name: 'R Leg',
        shape: 'rod',
        position: [-0.85, 1.0, 1.8],
        rotation: [0, 0, -38],
        scale: [0.5, 0.75, 0.5],
        color: '#0369a1',
      },
      // 'V' left diagonal
      {
        id: 'rv-4',
        name: 'V Left Diagonal',
        shape: 'rod',
        position: [0.75, 1.5, -1.2],
        rotation: [0, 0, -22],
        scale: [0.5, 1.05, 0.5],
        color: '#38bdf8',
      },
      // 'V' right diagonal
      {
        id: 'rv-5',
        name: 'V Right Diagonal',
        shape: 'rod',
        position: [1.45, 1.5, 1.2],
        rotation: [0, 0, 22],
        scale: [0.5, 1.05, 0.5],
        color: '#0284c7',
      },
    ],
  },
];
