/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Configuration for the RGB Multi-Light Studio presets.
 *
 * Design decisions:
 * - The three original RGB light IDs (`light-red`, `light-green`, `light-blue`)
 *   and their positions are retained for every preset so preset changes do not
 *   change fixture identity or shadow geometry.
 * - All slots use equal intensity. This keeps additive colour ratios driven by
 *   the configured colours rather than by uneven light power.
 * - Every preset has three enabled shadow-casting spotlights so users can
 *   compare colour palettes under the same spatial arrangement.
 *
 * This module is data/factory only. It does not touch React, Three.js or the
 * running application; integration is handled in a later step.
 */

import type { StudioLight } from '../types';

/** Supported Multi-Light Studio preset identifiers. */
export type LightPresetId = 'rgb' | 'cmy' | 'sunset' | 'mono';

/** Public, immutable configuration for one lighting preset. */
export interface LightPresetDefinition {
  readonly id: LightPresetId;
  readonly label: string;
  readonly description: string;
  /** Colours assigned to the three fixed light slots, in slot order. */
  readonly colors: readonly [string, string, string];
  /** Display names assigned to the three fixed light slots, in slot order. */
  readonly lightNames: readonly [string, string, string];
}

/** Registry of all supported lighting palettes. */
export const LIGHT_PRESETS: Readonly<Record<LightPresetId, LightPresetDefinition>> = Object.freeze({
  rgb: Object.freeze({
    id: 'rgb',
    label: 'RGB Triad',
    description: 'Pure additive red, green and blue spotlights.',
    colors: Object.freeze(['#ff0000', '#00ff00', '#0000ff'] as const),
    lightNames: Object.freeze(['Red Spotlight', 'Green Spotlight', 'Blue Spotlight'] as const),
  }),
  cmy: Object.freeze({
    id: 'cmy',
    label: 'CMY Contrast',
    description: 'Complementary cyan, magenta and yellow spotlights.',
    colors: Object.freeze(['#00ffff', '#ff00ff', '#ffff00'] as const),
    lightNames: Object.freeze([
      'Cyan Spotlight',
      'Magenta Spotlight',
      'Yellow Spotlight',
    ] as const),
  }),
  sunset: Object.freeze({
    id: 'sunset',
    label: 'Sunset Warm',
    description: 'Coordinated deep red, orange and golden yellow spotlights.',
    colors: Object.freeze(['#b91c1c', '#f97316', '#fbbf24'] as const),
    lightNames: Object.freeze([
      'Deep Red Spotlight',
      'Orange Spotlight',
      'Golden Yellow Spotlight',
    ] as const),
  }),
  mono: Object.freeze({
    id: 'mono',
    label: 'Neutral Studio',
    description: 'Three neutral white spotlights for achromatic shadow comparison.',
    colors: Object.freeze(['#ffffff', '#ffffff', '#ffffff'] as const),
    lightNames: Object.freeze([
      'Neutral Key Spotlight',
      'Neutral Fill Spotlight',
      'Neutral Rim Spotlight',
    ] as const),
  }),
});

/** Fixed spatial/lighting properties shared by every preset slot. */
interface LightSlotTemplate {
  readonly id: string;
  readonly type: StudioLight['type'];
  readonly position: readonly [number, number, number];
  readonly targetPosition: readonly [number, number, number];
  readonly intensity: number;
  readonly distance: number;
  readonly angle: number;
  readonly penumbra: number;
}

/**
 * The original RGB rig geometry. IDs and positions are reused exactly so all
 * presets remain spatially comparable.
 */
const LIGHT_SLOTS: readonly LightSlotTemplate[] = [
  {
    id: 'light-red',
    type: 'spot',
    position: [-1.8, 2.6, -5.2],
    targetPosition: [0, 2.0, 6.0],
    intensity: 2.8,
    distance: 25,
    angle: 0.75,
    penumbra: 0.25,
  },
  {
    id: 'light-green',
    type: 'spot',
    position: [0.0, 3.2, -5.5],
    targetPosition: [0, 2.0, 6.0],
    intensity: 2.8,
    distance: 25,
    angle: 0.75,
    penumbra: 0.25,
  },
  {
    id: 'light-blue',
    type: 'spot',
    position: [1.8, 2.6, -5.2],
    targetPosition: [0, 2.0, 6.0],
    intensity: 2.8,
    distance: 25,
    angle: 0.75,
    penumbra: 0.25,
  },
];

/** Create a fresh mutable tuple; never pass a shared template array to callers. */
function clonePosition(position: readonly [number, number, number]): [number, number, number] {
  return [position[0], position[1], position[2]];
}

/** Build a completely fresh `StudioLight[]` for the requested preset. */
function buildPresetLights(preset: LightPresetId): StudioLight[] {
  // The fallback keeps callers safe if an unknown value arrives from JSON/UI code.
  const definition = LIGHT_PRESETS[preset] ?? LIGHT_PRESETS.rgb;

  return LIGHT_SLOTS.map((slot, index) => ({
    id: slot.id,
    name: definition.lightNames[index],
    type: slot.type,
    position: clonePosition(slot.position),
    targetPosition: clonePosition(slot.targetPosition),
    color: definition.colors[index],
    intensity: slot.intensity,
    distance: slot.distance,
    angle: slot.angle,
    penumbra: slot.penumbra,
    enabled: true,
    castShadow: true,
  }));
}

/**
 * Return a fresh three-light rig for a preset.
 *
 * Every invocation creates new light objects and new position/target arrays, so
 * callers may freely mutate the result without affecting the registry or any
 * previously returned preset.
 */
export function applyLightPreset(preset: LightPresetId): StudioLight[] {
  return buildPresetLights(preset);
}
