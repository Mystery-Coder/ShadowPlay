/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StudioLight } from '../types';
import { hexToSrgbChannels, srgbChannelsToHex } from '../engine/color-lighting';
import {
  RGB_CHALLENGES,
  formatRgbColourLabel,
  resolveRgbChallenge,
  validateResolvedRgbAnswer,
} from '../engine/rgb-challenges';
import type { RgbChallenge, RgbLightStatusKind } from '../engine/rgb-challenges';
import {
  Lightbulb,
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface RgbChallengeOverlayProps {
  lights: StudioLight[];
  /** When supplied, the parent owns the active challenge. */
  currentChallenge?: RgbChallenge;
  /** Optional custom catalogue; defaults to the built-in four challenges. */
  challenges?: readonly RgbChallenge[];
  onChallengeChange?: (challenge: RgbChallenge, index: number) => void;
  onClose?: () => void;
}

function statusLabel(state: RgbLightStatusKind): string {
  if (state === 'contributing') return 'Contributing';
  if (state === 'blocked') return 'Blocked';
  return 'Disabled';
}

function statusClasses(state: RgbLightStatusKind): string {
  if (state === 'contributing') {
    return 'bg-emerald-950/70 border-emerald-700 text-emerald-300';
  }
  if (state === 'blocked') {
    return 'bg-rose-950/70 border-rose-700 text-rose-300';
  }
  return 'bg-slate-900 border-slate-700 text-slate-500';
}

/**
 * Stable fingerprint of only the light properties that can change a colour
 * answer. Equivalent colours, reordered arrays and unused properties do not
 * produce a new fingerprint, so unrelated renders do not clear the answer.
 */
function getLightAnswerSignature(lights: StudioLight[]): string {
  if (!Array.isArray(lights)) return '';

  return lights
    .map((light) => {
      if (!light) return JSON.stringify(['missing']);

      const srgb = hexToSrgbChannels(light.color);
      const color = srgb ? srgbChannelsToHex(srgb) : '';
      const intensity =
        Number.isFinite(light.intensity) && light.intensity > 0 ? light.intensity : 0;

      return JSON.stringify([
        typeof light.id === 'string' ? light.id : '',
        light.enabled === true ? 1 : 0,
        color,
        intensity,
      ]);
    })
    .sort()
    .join(';');
}

/**
 * Presentational RGB challenge card.
 *
 * Challenge selection, selected answer, hint visibility and submission state
 * are local to this component for Step 5. App integration happens in Step 6.
 */
export const RgbChallengeOverlay: React.FC<RgbChallengeOverlayProps> = ({
  lights,
  currentChallenge,
  challenges,
  onChallengeChange,
  onClose,
}) => {
  const challengeList = useMemo(
    () => (challenges && challenges.length > 0 ? challenges : RGB_CHALLENGES),
    [challenges]
  );

  const currentChallengeId = currentChallenge?.id;
  // Recalculate from the light objects every render so same-array mutations
  // cannot leave the signature, prediction or reset logic stale.
  const lightSignature = getLightAnswerSignature(lights);

  const controlledIndex = useMemo(() => {
    if (!currentChallengeId) return null;
    const index = challengeList.findIndex((item) => item.id === currentChallengeId);
    return index >= 0 ? index : 0;
  }, [challengeList, currentChallengeId]);

  const [uncontrolledIndex, setUncontrolledIndex] = useState<number>(controlledIndex ?? 0);

  // Keep the uncontrolled fallback aligned with a parent-selected challenge.
  useEffect(() => {
    if (controlledIndex === null) return;
    setUncontrolledIndex(controlledIndex);
  }, [controlledIndex]);

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const activeIndex = Math.max(
    0,
    Math.min(controlledIndex ?? uncontrolledIndex, challengeList.length - 1)
  );
  const challenge = challengeList[activeIndex] ?? challengeList[0];

  const resetAnswerState = useCallback(() => {
    setSelectedOptionId(null);
    setSubmitted(false);
    setShowHint(false);
  }, []);

  const lastChallengeIdRef = useRef<string | undefined>(challenge?.id);
  const lastLightSignatureRef = useRef<string>(lightSignature);

  // Reset once when the active challenge or answer-affecting lights change.
  useEffect(() => {
    const challengeChanged = challenge?.id !== lastChallengeIdRef.current;
    const lightsChanged = lightSignature !== lastLightSignatureRef.current;

    if (!challengeChanged && !lightsChanged) return;

    if (challengeChanged) lastChallengeIdRef.current = challenge?.id;
    if (lightsChanged) lastLightSignatureRef.current = lightSignature;
    resetAnswerState();
  }, [challenge?.id, lightSignature, resetAnswerState]);

  const resolution = resolveRgbChallenge(challenge, lights);
  const validation = useMemo(
    () => (selectedOptionId ? validateResolvedRgbAnswer(resolution, selectedOptionId) : null),
    [resolution, selectedOptionId]
  );

  const hasContributors = resolution.expectedColour.contributingLightIds.length > 0;
  const isConceptualChallenge = Boolean(resolution.challenge.correctOptionId);
  const expectedHex = resolution.expectedColour.hex;
  const expectedHexText = hasContributors ? expectedHex : '—';

  const goToChallenge = (nextIndex: number): void => {
    const clamped = Math.max(0, Math.min(challengeList.length - 1, nextIndex));
    if (clamped === activeIndex) return;

    const nextChallenge = challengeList[clamped];
    if (!nextChallenge) return;

    if (controlledIndex !== null) {
      // The parent owns the active challenge and echoes it via currentChallenge.
      onChallengeChange?.(nextChallenge, clamped);
      return;
    }

    setUncontrolledIndex(clamped);
  };

  const handleSelectOption = (optionId: string): void => {
    if (optionId === selectedOptionId) return;
    setSelectedOptionId(optionId);
    // A changed selection unlocks a fresh submission.
    if (submitted) setSubmitted(false);
  };

  const handleSubmit = (): void => {
    if (!selectedOptionId || submitted) return;
    setSubmitted(true);
  };

  return (
    <div className="absolute top-16 left-4 right-4 sm:left-auto sm:right-4 z-20 w-auto sm:w-80 max-h-[calc(100vh-5rem)] overflow-y-auto bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl text-white animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800 text-indigo-400 shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-100 truncate" title={challenge.title}>
              {challenge.title}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded-full border bg-slate-900 text-slate-300 border-slate-700">
                {challenge.difficulty}
              </span>
              <span className="text-[10px] text-slate-500">
                Challenge {activeIndex + 1} of {challengeList.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => goToChallenge(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous RGB challenge"
            title="Previous challenge"
            className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => goToChallenge(activeIndex + 1)}
            disabled={activeIndex === challengeList.length - 1}
            aria-label="Next RGB challenge"
            title="Next challenge"
            className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close RGB challenges"
              title="Close challenges"
              className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Question */}
      <p className="mb-2 text-[11px] text-slate-300 leading-relaxed">{challenge.prompt}</p>

      <button
        type="button"
        onClick={() => setShowHint((visible) => !visible)}
        aria-expanded={showHint}
        className="mb-2 flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span>{showHint ? 'Hide hint' : 'Need a hint?'}</span>
      </button>

      {showHint && (
        <div className="mb-3 p-2 rounded-lg bg-indigo-950/80 border border-indigo-800/80 text-[11px] text-indigo-200 leading-relaxed animate-fadeIn">
          💡 {challenge.hint}
        </div>
      )}

      {/* Live theoretical prediction */}
      <div className="mb-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 shrink-0 rounded-lg border border-white/20 shadow-inner"
            style={{ backgroundColor: expectedHex }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <span className="text-[9px] uppercase font-semibold tracking-wide text-slate-500 block">
              Theoretical direct-light prediction
            </span>
            <span className="text-xs font-bold text-slate-100 block">
              {formatRgbColourLabel(resolution.expectedColour)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">{expectedHexText}</span>
          </div>
        </div>
        <p className="mt-2 text-[9px] leading-snug text-slate-500">
          Direct-light prediction only. It does not model per-pixel occlusion, spotlight geometry,
          material response, ambient/environment fill, soft penumbra, or ACES tone mapping. Challenge
          blocking is a learning simulation, not a Three.js shadow-map change.
        </p>
      </div>

      {/* Per-light indicators */}
      <div className="mb-3">
        <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
          Light Contributions
        </span>
        <div className="space-y-1">
          {resolution.lightStatuses.map((status) => (
            <div
              key={status.id}
              className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900/60 border border-slate-800"
            >
              <div
                className="w-3 h-3 shrink-0 rounded-full border border-white/20"
                style={{ backgroundColor: status.color }}
                aria-hidden="true"
              />
              <span className="text-[10px] font-semibold text-slate-200 truncate flex-1" title={status.name}>
                {status.name}
              </span>
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] font-bold ${statusClasses(status.state)}`}
              >
                {statusLabel(status.state)}
              </span>
            </div>
          ))}
          {resolution.lightStatuses.length === 0 && (
            <p className="text-[10px] text-slate-500">No lights were supplied.</p>
          )}
        </div>

        {resolution.missingBlockedLightIds.length > 0 && (
          <p className="mt-1.5 text-[9px] leading-snug text-amber-300/90">
            Missing light ID(s): {resolution.missingBlockedLightIds.join(', ')}. They were ignored in
            the prediction.
          </p>
        )}
      </div>

      {/* Multiple-choice answers */}
      <div className="mb-2">
        <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
          Your Prediction
        </span>
        <div className="space-y-1.5">
          {resolution.options.map((option) => {
            const isSelected = option.id === selectedOptionId;
            // Show every valid answer, not only the one the user selected.
            const showCorrect =
              submitted && Boolean(validation?.correctOptionIds.includes(option.id));
            const showIncorrect = submitted && isSelected && validation && !validation.isCorrect;
            const optionHexText =
              option.colour && option.colour.contributingLightIds.length > 0
                ? option.colour.hex
                : '—';

            let optionClasses =
              'border-slate-800 bg-slate-900/70 hover:border-slate-700 text-slate-200';
            if (isSelected) {
              optionClasses = 'border-amber-500 bg-amber-950/40 text-amber-100';
            }
            if (showCorrect) {
              optionClasses = 'border-emerald-500 bg-emerald-950/40 text-emerald-100';
            } else if (showIncorrect) {
              optionClasses = 'border-rose-500 bg-rose-950/40 text-rose-100';
            }

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelectOption(option.id)}
                aria-pressed={isSelected}
                className={`w-full flex items-center justify-between gap-2 p-2 rounded-xl border text-left text-[10px] leading-snug transition-colors ${optionClasses}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {option.colour && (
                    <span
                      className="w-3 h-3 shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: option.colour.hex }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{option.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {showCorrect && (
                    <CheckCircle2
                      className="w-3 h-3 text-emerald-400"
                      aria-label="Correct answer"
                    />
                  )}
                  {option.colour && (
                    <span className="font-mono text-[9px] text-slate-400">{optionHexText}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedOptionId || submitted}
          className="mt-2 w-full px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[11px] font-bold transition-colors"
        >
          {submitted ? 'Answer submitted' : 'Submit answer'}
        </button>
      </div>

      {/* Feedback + explanation */}
      {submitted && validation && (
        <div className="space-y-2 animate-fadeIn">
          <div
            className={`p-2 rounded-lg border ${
              validation.isCorrect
                ? 'bg-emerald-950/60 border-emerald-800'
                : 'bg-rose-950/60 border-rose-800'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {validation.isCorrect ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span
                className={`text-[10px] font-bold ${
                  validation.isCorrect ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {validation.isCorrect ? 'Correct' : 'Not quite'}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-300 leading-snug">{validation.feedback}</p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] font-semibold text-slate-300 block mb-1">Why</span>
            <p className="text-[10px] text-slate-400 leading-relaxed">{challenge.explanation}</p>
            {!isConceptualChallenge && (
              <div className="mt-2 flex items-center gap-2 pt-2 border-t border-slate-800/80">
                <div
                  className="w-5 h-5 shrink-0 rounded border border-white/20"
                  style={{ backgroundColor: expectedHex }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <span className="text-[9px] text-slate-500 block">
                    {hasContributors ? 'Expected theoretical colour' : 'No contributing lights'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-200">{expectedHexText}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
