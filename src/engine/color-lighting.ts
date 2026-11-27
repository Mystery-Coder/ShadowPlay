/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure colour utilities for the RGB Multi-Light Studio.
 *
 * Colour-science notes:
 * - `StudioLight.color` is a CSS/sRGB hex value. sRGB is a gamma-encoded display
 *   space, so its channels are NOT proportional to physical light power.
 * - Contributions are converted to linear-light RGB before being multiplied by
 *   intensity and summed. This approximates additive illumination; summing the
 *   original sRGB bytes would produce incorrect hues and washed-out blends.
 * - The sum is normalized by its largest channel so the returned display colour
 *   has usable brightness while preserving the relative linear RGB proportions.
 *   The unnormalized sum is retained in `rawLinearRgb` for callers that care
 *   about absolute magnitude.
 * - The result is re-encoded to sRGB only for the final display hex value.
 *
 * This is a theoretical colour calculation only. It does not exactly reproduce
 * the rendered Three.js scene, which also depends on material properties,
 * shadow maps, ambient/environment lighting, tone mapping and exposure.
 */

import type { StudioLight } from '../types';

/** Linear-light or sRGB channels, each in the inclusive range 0…1. */
export interface RgbChannels {
  r: number;
  g: number;
  b: number;
}

/** Structured result returned by {@link getBlockedLightColour}. */
export interface BlockedLightColourResult {
  /** Lowercase `#rrggbb` sRGB display colour encoded from `srgbRgb`. */
  hex: string;
  /** Normalized linear channels; the largest channel is 1, or all are 0 for black. */
  linearRgb: RgbChannels;
  /** sRGB-encoded channels used to produce `hex`. */
  srgbRgb: RgbChannels;
  /** Unnormalized linear-light sum, including each contributor's intensity. */
  rawLinearRgb: RgbChannels;
  /** IDs of enabled, unblocked lights with a valid colour and positive intensity. */
  contributingLightIds: string[];
  /** Blocked IDs that were requested, de-duplicated in input order. */
  blockedLightIds: string[];
  /** Approximate human-readable description of `srgbRgb`. */
  description: string;
}

const BLACK: RgbChannels = { r: 0, g: 0, b: 0 };
const HEX_COLOUR_PATTERN = /^#?([\da-f]{3}|[\da-f]{6})$/i;
const SRGB_LINEAR_THRESHOLD = 0.04045;
const LINEAR_SRGB_THRESHOLD = 0.0031308;

/** Clamp a numeric channel to 0…1; non-finite values become 0. */
export function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/** Parse `#rgb` or `#rrggbb` into normalized sRGB channels. Invalid input returns null. */
export function hexToSrgbChannels(hex: string): RgbChannels | null {
  if (typeof hex !== 'string') return null;

  const match = HEX_COLOUR_PATTERN.exec(hex.trim());
  if (!match) return null;

  let digits = match[1];
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((character) => character + character)
      .join('');
  }

  const value = Number.parseInt(digits, 16);
  if (!Number.isFinite(value)) return null;

  return {
    r: ((value >> 16) & 0xff) / 255,
    g: ((value >> 8) & 0xff) / 255,
    b: (value & 0xff) / 255,
  };
}

/** Convert normalized sRGB channels to lowercase `#rrggbb`. */
export function srgbChannelsToHex(channels: RgbChannels): string {
  const toHexByte = (channel: number): string => {
    const byte = Math.round(clampChannel(channel) * 255);
    return byte.toString(16).padStart(2, '0');
  };

  return `#${toHexByte(channels?.r ?? 0)}${toHexByte(channels?.g ?? 0)}${toHexByte(channels?.b ?? 0)}`;
}

/**
 * Apply the sRGB electro-optical transfer function to one channel.
 * Converts display-encoded sRGB to linear light.
 */
export function srgbChannelToLinear(channel: number): number {
  const value = clampChannel(channel);
  return value <= SRGB_LINEAR_THRESHOLD
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

/**
 * Apply the inverse sRGB transfer function to one channel.
 * Converts linear light back to display-encoded sRGB.
 */
export function linearChannelToSrgb(channel: number): number {
  const value = clampChannel(channel);
  return value <= LINEAR_SRGB_THRESHOLD
    ? value * 12.92
    : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

/** Convert all three sRGB channels to linear-light RGB. */
export function srgbToLinearChannels(channels: RgbChannels): RgbChannels {
  return {
    r: srgbChannelToLinear(channels?.r ?? 0),
    g: srgbChannelToLinear(channels?.g ?? 0),
    b: srgbChannelToLinear(channels?.b ?? 0),
  };
}

/** Convert all three linear-light channels to display-encoded sRGB. */
export function linearToSrgbChannels(channels: RgbChannels): RgbChannels {
  return {
    r: linearChannelToSrgb(channels?.r ?? 0),
    g: linearChannelToSrgb(channels?.g ?? 0),
    b: linearChannelToSrgb(channels?.b ?? 0),
  };
}

/** Convenience conversion from a hex colour to linear-light RGB. Invalid hex returns null. */
export function hexToLinearChannels(hex: string): RgbChannels | null {
  const srgb = hexToSrgbChannels(hex);
  return srgb ? srgbToLinearChannels(srgb) : null;
}

/** Convenience conversion from linear-light RGB to a display hex colour. */
export function linearChannelsToHex(channels: RgbChannels): string {
  return srgbChannelsToHex(linearToSrgbChannels(channels));
}

/**
 * Scale linear channels by a single shared factor so the largest becomes 1.
 * Because every channel is scaled equally, chromaticity (relative proportions)
 * is preserved. An all-zero or invalid result remains black.
 */
export function normalizeLinearChannels(channels: RgbChannels): RgbChannels {
  const r = Math.max(0, Number.isFinite(channels?.r) ? channels.r : 0);
  const g = Math.max(0, Number.isFinite(channels?.g) ? channels.g : 0);
  const b = Math.max(0, Number.isFinite(channels?.b) ? channels.b : 0);
  const largest = Math.max(r, g, b);

  if (largest <= 0) return { ...BLACK };
  return { r: r / largest, g: g / largest, b: b / largest };
}

/** Map an sRGB hue angle to a simple, general colour name. */
function hueToName(hue: number): string {
  if (hue < 15 || hue >= 345) return 'red';
  if (hue < 45) return 'orange';
  if (hue < 75) return 'yellow';
  if (hue < 165) return 'green';
  if (hue < 195) return 'cyan';
  if (hue < 255) return 'blue';
  if (hue < 285) return 'violet';
  return 'magenta';
}

/** Calculate an HSV hue angle in degrees from sRGB channels. */
function srgbHueDegrees(channels: RgbChannels): number {
  const r = clampChannel(channels.r);
  const g = clampChannel(channels.g);
  const b = clampChannel(channels.b);
  const largest = Math.max(r, g, b);
  const smallest = Math.min(r, g, b);
  const delta = largest - smallest;

  if (delta <= 0) return 0;

  let hue: number;
  if (largest === r) hue = ((g - b) / delta) % 6;
  else if (largest === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

/**
 * Produce an approximate human-readable label for a display colour.
 * This naming is informational and is not used in the colour calculation.
 */
export function describeSrgbColour(channels: RgbChannels): string {
  const r = clampChannel(channels?.r ?? 0);
  const g = clampChannel(channels?.g ?? 0);
  const b = clampChannel(channels?.b ?? 0);
  const largest = Math.max(r, g, b);
  const smallest = Math.min(r, g, b);

  if (largest <= 0.02) return 'black';

  const delta = largest - smallest;
  if (delta <= 0.08) {
    if (largest >= 0.85) return 'white';
    if (largest >= 0.45) return 'grey';
    return 'dark grey';
  }

  const lightness = (largest + smallest) / 2;
  const prefix = lightness < 0.28 ? 'dark ' : lightness > 0.78 ? 'light ' : '';
  return `${prefix}${hueToName(srgbHueDegrees({ r, g, b }))}`;
}

/** Build a consistent black result for empty or fully blocked light sets. */
function createBlackResult(
  blockedLightIds: string[],
  contributingLightIds: string[] = []
): BlockedLightColourResult {
  return {
    hex: '#000000',
    linearRgb: { ...BLACK },
    srgbRgb: { ...BLACK },
    rawLinearRgb: { ...BLACK },
    contributingLightIds,
    blockedLightIds,
    description: 'black',
  };
}

/**
 * Calculate the theoretical displayed colour when the given light IDs are
 * blocked.
 *
 * Only lights that are explicitly enabled, not blocked, have a valid hex
 * colour and have finite positive intensity contribute. Invalid hex colours,
 * zero/negative intensity and duplicate blocked IDs are handled safely.
 *
 * The calculation is generic: it never inspects light names or IDs to infer
 * colour roles. It is additive linear-light math, not a simulation of the
 * rendered Three.js scene.
 */
export function getBlockedLightColour(
  lights: StudioLight[],
  blockedLightIds: Iterable<string> = []
): BlockedLightColourResult {
  const blocked = new Set<string>();
  if (blockedLightIds) {
    for (const id of blockedLightIds) {
      if (typeof id === 'string') blocked.add(id);
    }
  }

  const normalizedBlockedIds = Array.from(blocked);

  if (!Array.isArray(lights) || lights.length === 0) {
    return createBlackResult(normalizedBlockedIds);
  }

  const rawLinearRgb: RgbChannels = { r: 0, g: 0, b: 0 };
  const contributingLightIds: string[] = [];

  for (const light of lights) {
    if (!light || light.enabled !== true) continue;
    if (blocked.has(light.id)) continue;

    const intensity =
      Number.isFinite(light.intensity) && light.intensity > 0 ? light.intensity : 0;
    if (intensity === 0) continue;

    // Convert the light's display colour to linear light before applying power.
    const linearColour = hexToLinearChannels(light.color);
    if (!linearColour) continue;

    const contribution: RgbChannels = {
      r: linearColour.r * intensity,
      g: linearColour.g * intensity,
      b: linearColour.b * intensity,
    };

    // Skip malformed/extreme values that would poison the additive result.
    if (
      !Number.isFinite(contribution.r) ||
      !Number.isFinite(contribution.g) ||
      !Number.isFinite(contribution.b)
    ) {
      continue;
    }
    if (contribution.r <= 0 && contribution.g <= 0 && contribution.b <= 0) {
      continue;
    }

    rawLinearRgb.r += contribution.r;
    rawLinearRgb.g += contribution.g;
    rawLinearRgb.b += contribution.b;
    contributingLightIds.push(light.id);
  }

  if (
    !Number.isFinite(rawLinearRgb.r) ||
    !Number.isFinite(rawLinearRgb.g) ||
    !Number.isFinite(rawLinearRgb.b) ||
    Math.max(rawLinearRgb.r, rawLinearRgb.g, rawLinearRgb.b) <= 0
  ) {
    return createBlackResult(normalizedBlockedIds, contributingLightIds);
  }

  const linearRgb = normalizeLinearChannels(rawLinearRgb);
  const srgbRgb = linearToSrgbChannels(linearRgb);

  return {
    hex: srgbChannelsToHex(srgbRgb),
    linearRgb,
    srgbRgb,
    rawLinearRgb,
    contributingLightIds,
    blockedLightIds: normalizedBlockedIds,
    description: describeSrgbColour(srgbRgb),
  };
}
