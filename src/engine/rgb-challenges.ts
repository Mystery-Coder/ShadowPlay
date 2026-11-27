/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * RGB-specific learning challenges for the Multi-Light Studio.
 *
 * This module is intentionally separate from `puzzles.ts`: the existing
 * silhouette puzzles score geometry with binary IoU, while these challenges
 * teach additive colour using `getBlockedLightColour()` from `color-lighting.ts`.
 *
 * Colour answers are derived from the actually supplied `StudioLight[]`. The
 * result is a theoretical direct-light prediction, not a pixel-perfect model of
 * the Three.js wall: it does not include per-pixel occlusion, spotlight
 * geometry, material response, ambient/environment fill, soft penumbra or ACES
 * tone mapping.
 */

import type { StudioLight } from '../types';
import type { BlockedLightColourResult } from './color-lighting';
import { getBlockedLightColour } from './color-lighting';

/** Stable identifiers for the built-in RGB challenges. */
export type RgbChallengeId =
  | 'rgb-mix'
  | 'block-red'
  | 'block-two'
  | 'coloured-shadows';

/** Difficulty levels used by the RGB challenge cards. */
export type RgbChallengeDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

/** Visual/debug status of one light in a challenge. */
export type RgbLightStatusKind = 'contributing' | 'blocked' | 'disabled';

/**
 * A multiple-choice option.
 *
 * For colour options, `blockedLightIds` describes the light combination whose
 * theoretical colour this option represents. The option's correct/incorrect
 * state is derived at runtime by comparing that colour with the challenge's
 * expected colour. For conceptual options, supply a static `label` and mark the
 * challenge with `correctOptionId`.
 */
export interface RgbAnswerOption {
  readonly id: string;
  readonly label?: string;
  readonly blockedLightIds?: readonly string[];
}

/** Complete definition of one RGB challenge. */
export interface RgbChallenge {
  readonly id: RgbChallengeId;
  readonly title: string;
  readonly difficulty: RgbChallengeDifficulty;
  readonly prompt: string;
  readonly hint: string;
  readonly explanation: string;
  /** Light IDs blocked in this challenge's learning simulation. */
  readonly blockedLightIds: readonly string[];
  readonly answerOptions: readonly RgbAnswerOption[];
  /** Used only for conceptual questions whose correct answer is not a colour. */
  readonly correctOptionId?: string;
}

/** Answer option after its theoretical colour has been resolved. */
export interface ResolvedRgbAnswerOption {
  readonly id: string;
  readonly label: string;
  readonly blockedLightIds: readonly string[];
  /** Null for purely conceptual options. */
  readonly colour: BlockedLightColourResult | null;
  readonly isCorrect: boolean;
}

/** Per-light display state for the challenge's indicator list. */
export interface RgbLightStatus {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly intensity: number;
  readonly state: RgbLightStatusKind;
}

/** Everything the UI needs for one challenge against one light rig. */
export interface RgbChallengeResolution {
  readonly challenge: RgbChallenge;
  /** Theoretical colour with the challenge's lights blocked. */
  readonly expectedColour: BlockedLightColourResult;
  readonly options: readonly ResolvedRgbAnswerOption[];
  readonly correctOptionIds: readonly string[];
  readonly lightStatuses: readonly RgbLightStatus[];
  /** Challenge light IDs that are not present in the supplied rig. */
  readonly missingBlockedLightIds: readonly string[];
  readonly blockedLightIds: readonly string[];
}

/** Result of validating a selected answer. */
export interface RgbAnswerValidation {
  readonly isCorrect: boolean;
  readonly selectedOptionId: string;
  readonly selectedOption: ResolvedRgbAnswerOption | null;
  readonly correctOptionIds: readonly string[];
  readonly expectedColour: BlockedLightColourResult;
  readonly feedback: string;
}

const ids = (...values: string[]): readonly string[] => Object.freeze(values);

/**
 * Built-in challenge catalogue.
 *
 * Slot IDs match the stable IDs used by `multi-light-presets.ts`. The
 * definitions never store a precomputed answer colour; correct colour answers
 * are resolved from the lights supplied at runtime.
 */
export const RGB_CHALLENGES: readonly RgbChallenge[] = Object.freeze([
  Object.freeze({
    id: 'rgb-mix',
    title: 'Predict the RGB Mix',
    difficulty: 'Beginner',
    prompt:
      'No lights are blocked by this challenge. Predict the theoretical colour from the lights that are currently enabled; only enabled, unblocked lights contribute.',
    hint: 'Add light in linear RGB space. For an equal pure RGB rig with all three enabled, the mix tends toward white.',
    explanation:
      'This challenge blocks no light IDs. Only enabled, unblocked lights with valid colours and positive intensity contribute; disabled lights are skipped. For an equal pure RGB rig with all three enabled, the primaries sum toward white in linear light before display encoding.',
    blockedLightIds: ids(),
    answerOptions: Object.freeze([
      Object.freeze({ id: 'all-lights', blockedLightIds: ids() }),
      Object.freeze({ id: 'without-red', blockedLightIds: ids('light-red') }),
      Object.freeze({ id: 'without-green', blockedLightIds: ids('light-green') }),
      Object.freeze({ id: 'without-blue', blockedLightIds: ids('light-blue') }),
    ]),
  }),
  Object.freeze({
    id: 'block-red',
    title: 'Block the Red Slot',
    difficulty: 'Intermediate',
    prompt:
      'In this learning simulation the red slot is blocked. Which colour remains from the unblocked contributions?',
    hint: 'Removing red leaves the sum of the green and blue slots.',
    explanation:
      'Blocking one light removes only its direct contribution. The remaining lights still add together, so green + blue produces a cyan-like complement for an equal pure RGB rig.',
    blockedLightIds: ids('light-red'),
    answerOptions: Object.freeze([
      Object.freeze({ id: 'red-blocked', blockedLightIds: ids('light-red') }),
      Object.freeze({ id: 'green-blocked', blockedLightIds: ids('light-green') }),
      Object.freeze({ id: 'blue-blocked', blockedLightIds: ids('light-blue') }),
      Object.freeze({ id: 'all-lights', blockedLightIds: ids() }),
    ]),
  }),
  Object.freeze({
    id: 'block-two',
    title: 'Only One Light Remains',
    difficulty: 'Intermediate',
    prompt:
      'The green and blue slots are blocked, leaving only one enabled light. What colour is predicted?',
    hint: 'Check which light ID is still present in the contributor list.',
    explanation:
      'When two lights are blocked, the remaining surface colour is the colour of the single unblocked contributor. The exact hex comes from that light’s current colour and intensity, not from its name.',
    blockedLightIds: ids('light-green', 'light-blue'),
    answerOptions: Object.freeze([
      Object.freeze({
        id: 'only-red',
        blockedLightIds: ids('light-green', 'light-blue'),
      }),
      Object.freeze({
        id: 'only-green',
        blockedLightIds: ids('light-red', 'light-blue'),
      }),
      Object.freeze({
        id: 'only-blue',
        blockedLightIds: ids('light-red', 'light-green'),
      }),
      Object.freeze({
        id: 'none',
        blockedLightIds: ids('light-red', 'light-green', 'light-blue'),
      }),
    ]),
  }),
  Object.freeze({
    id: 'coloured-shadows',
    title: 'Why Shadows Differ',
    difficulty: 'Advanced',
    prompt:
      'Why can two regions of the same wall appear different colours during a three-light setup?',
    hint: 'Think per pixel: an object can block different lights in different regions.',
    explanation:
      'Each wall region receives the sum of whichever lights are not blocked for that region. One patch may lose red and look cyan-like, another may lose green and look magenta-like, while a fully blocked patch has no direct-light contribution. This challenge simulates blocking by ID; it does not modify Three.js shadow maps.',
    blockedLightIds: ids('light-red'),
    answerOptions: Object.freeze([
      Object.freeze({
        id: 'per-pixel-subsets',
        label:
          'Different regions lose different subsets of light, so each shows the sum of the lights that still reach it.',
      }),
      Object.freeze({
        id: 'uniform-lights',
        label: 'Every wall pixel receives exactly the same three lights, so colour cannot vary.',
      }),
      Object.freeze({
        id: 'ambient-only',
        label: 'Ambient light alone creates the different colours.',
      }),
      Object.freeze({
        id: 'always-black',
        label: 'Every shadow is pure black regardless of which lights remain.',
      }),
    ]),
    correctOptionId: 'per-pixel-subsets',
  }),
]);

/** Find a built-in challenge by stable ID. */
export function getRgbChallengeById(id: RgbChallengeId): RgbChallenge | null {
  return RGB_CHALLENGES.find((challenge) => challenge.id === id) ?? null;
}

/** Normalize blocked IDs: de-duplicate and ignore non-strings defensively. */
function normalizeBlockedIds(values: readonly string[] | undefined): string[] {
  if (!values) return [];
  const result = new Set<string>();
  for (const value of values) {
    if (typeof value === 'string') result.add(value);
  }
  return Array.from(result);
}

/** Capitalize the first letter of a friendly colour description. */
export function formatRgbColourLabel(result: BlockedLightColourResult): string {
  if (result.contributingLightIds.length === 0) return 'No contributing lights';
  const text = result.description || 'Mixed colour';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Human-readable expected colour for a contributor-backed result. */
function describeExpectedColour(result: BlockedLightColourResult): string {
  if (result.contributingLightIds.length === 0) return 'no contributing lights';
  return `${result.hex} (${formatRgbColourLabel(result).toLowerCase()})`;
}

/** Build the contributing/blocked/disabled state for each supplied light. */
export function getRgbLightStatuses(
  challenge: RgbChallenge,
  lights: StudioLight[],
  expectedColour?: BlockedLightColourResult
): RgbLightStatus[] {
  const blocked = new Set(normalizeBlockedIds(challenge.blockedLightIds));
  const result = expectedColour ?? getBlockedLightColour(lights, challenge.blockedLightIds);
  const contributors = new Set(result.contributingLightIds);

  if (!Array.isArray(lights)) return [];

  return lights.map((light, index) => {
    if (!light) {
      return {
        id: `missing-${index}`,
        name: 'Missing light',
        color: '#000000',
        intensity: 0,
        state: 'disabled' as const,
      };
    }

    let state: RgbLightStatusKind = 'disabled';
    if (light.enabled === true && blocked.has(light.id)) {
      state = 'blocked';
    } else if (contributors.has(light.id)) {
      state = 'contributing';
    }

    return {
      id: light.id,
      name: light.name,
      color: light.color,
      intensity: light.intensity,
      state,
    };
  });
}

/**
 * Resolve a challenge against a concrete light rig.
 *
 * Colour options are evaluated by calling `getBlockedLightColour()` for their
 * own blocked sets and comparing the resulting hex with the challenge's
 * expected hex. More than one option can be correct when different blocked
 * sets produce the same normalized colour (for example, a monochrome rig).
 */
export function resolveRgbChallenge(
  challenge: RgbChallenge,
  lights: StudioLight[]
): RgbChallengeResolution {
  const blockedLightIds = normalizeBlockedIds(challenge.blockedLightIds);
  const expectedColour = getBlockedLightColour(lights, blockedLightIds);
  const expectedHex = expectedColour.hex.toLowerCase();

  const options: ResolvedRgbAnswerOption[] = challenge.answerOptions.map((option) => {
    const optionBlockedIds = normalizeBlockedIds(option.blockedLightIds);
    const hasDerivedColour = Boolean(option.blockedLightIds);
    const optionColour = hasDerivedColour
      ? getBlockedLightColour(lights, optionBlockedIds)
      : null;

    // Conceptual answers are validated only by option ID. Colour answers are
    // validated only by the derived hex, so the two modes never cross-match.
    const isCorrect = challenge.correctOptionId
      ? option.id === challenge.correctOptionId
      : optionColour?.hex.toLowerCase() === expectedHex;

    return {
      id: option.id,
      label: option.label ?? (optionColour ? formatRgbColourLabel(optionColour) : option.id),
      blockedLightIds: optionBlockedIds,
      colour: optionColour,
      isCorrect,
    };
  });

  const presentIds = new Set(
    (Array.isArray(lights) ? lights : [])
      .filter((light): light is StudioLight => Boolean(light))
      .map((light) => light.id)
  );
  const missingBlockedLightIds = blockedLightIds.filter((id) => !presentIds.has(id));

  return {
    challenge,
    expectedColour,
    options,
    correctOptionIds: options.filter((option) => option.isCorrect).map((option) => option.id),
    lightStatuses: getRgbLightStatuses(challenge, lights, expectedColour),
    missingBlockedLightIds,
    blockedLightIds,
  };
}

/** Validate a selected option using an already-resolved challenge. */
export function validateResolvedRgbAnswer(
  resolution: RgbChallengeResolution,
  selectedOptionId: string
): RgbAnswerValidation {
  const selectedOption =
    resolution.options.find((option) => option.id === selectedOptionId) ?? null;
  const isCorrect = resolution.correctOptionIds.includes(selectedOptionId);
  const isConceptual = Boolean(resolution.challenge.correctOptionId);
  const hasContributors = resolution.expectedColour.contributingLightIds.length > 0;

  const expectedConcept = resolution.correctOptionIds
    .map((id) => resolution.options.find((option) => option.id === id)?.label)
    .filter((label): label is string => Boolean(label))
    .join(' / ');

  let feedback: string;
  if (isConceptual) {
    feedback = isCorrect
      ? 'Correct. That is the conceptual answer.'
      : `Not quite. The conceptual answer is: ${expectedConcept || 'the conceptual answer'}.`;
  } else if (!hasContributors) {
    // Avoid describing "no contributing lights" as if it were a hex colour.
    feedback = isCorrect
      ? 'Correct. No lights contribute to the theoretical prediction.'
      : 'Not quite. No lights contribute to the theoretical prediction.';
  } else {
    const expectedColour = describeExpectedColour(resolution.expectedColour);
    feedback = isCorrect
      ? `Correct. The theoretical colour is ${expectedColour}.`
      : `Not quite. The expected theoretical colour is ${expectedColour}.`;
  }

  return {
    isCorrect,
    selectedOptionId,
    selectedOption,
    correctOptionIds: [...resolution.correctOptionIds],
    expectedColour: resolution.expectedColour,
    feedback,
  };
}

/** Convenience validator for callers that have not resolved the challenge yet. */
export function validateRgbAnswer(
  challenge: RgbChallenge,
  lights: StudioLight[],
  selectedOptionId: string
): RgbAnswerValidation {
  return validateResolvedRgbAnswer(resolveRgbChallenge(challenge, lights), selectedOptionId);
}
