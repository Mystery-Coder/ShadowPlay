/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IoUResult, PuzzleLevel, PuzzleScoreResult, ScoreState } from '../types';
import { drawTargetSilhouette, getSolutionDiagramImage } from '../engine/puzzles';
import { getPrimaryValidationMessage } from '../engine/puzzle-validation';
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  Timer,
  RotateCcw,
  RefreshCw,
  Eye,
  X,
  Target,
  ShieldAlert,
  Lightbulb,
  Gauge,
} from 'lucide-react';

interface PuzzleOverlayProps {
  level: PuzzleLevel;
  levelIndex: number;
  totalLevels: number;
  onSelectLevel: (index: number) => void;
  currentShadowPixels: Uint8Array | null;
  targetShadowPixels: Uint8Array | null;
  resolution: number;
  iouResult: IoUResult | null;
  puzzleScore: PuzzleScoreResult | null;
  attempts: number;
  startedAt: number;
  solvedAt: number | null;
  solutionRevealed: boolean;
  onReset: () => void;
  onRetry: () => void;
  onRevealSolution: () => void;
  onNextLevel: () => void;
}

const SCORE_STATE_META: Record<
  ScoreState,
  { label: string; hint: string; className: string }
> = {
  idle: {
    label: 'Awaiting Shadow',
    hint: 'Move or rotate an object into the spotlight.',
    className: 'bg-slate-900 text-slate-300 border-slate-700',
  },
  empty: {
    label: 'No Shadow',
    hint: 'Nothing is blocking the light yet.',
    className: 'bg-slate-900 text-slate-300 border-slate-700',
  },
  invalid: {
    label: 'Shape Mismatch',
    hint: 'The shadow is dark, but its outline is wrong.',
    className: 'bg-rose-950 text-rose-300 border-rose-800',
  },
  forming: {
    label: 'Forming',
    hint: 'A silhouette is appearing. Keep shaping it.',
    className: 'bg-amber-950 text-amber-300 border-amber-800',
  },
  close: {
    label: 'Getting Close',
    hint: 'The overall shape is reading. Refine the edges.',
    className: 'bg-sky-950 text-sky-300 border-sky-800',
  },
  'near-solve': {
    label: 'Almost Solved',
    hint: 'Only a small adjustment remains.',
    className: 'bg-violet-950 text-violet-300 border-violet-800',
  },
  solved: {
    label: 'Solved',
    hint: 'The projected shadow matches the target.',
    className: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  },
};

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const MiniMetric: React.FC<{
  label: string;
  value: number;
  accent: string;
}> = ({ label, value, accent }) => {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-1.5">
      <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1">
        <span>{label}</span>
        <span className="font-mono text-slate-200">{percent}%</span>
      </div>
      <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

export const PuzzleOverlay: React.FC<PuzzleOverlayProps> = ({
  level,
  levelIndex,
  totalLevels,
  onSelectLevel,
  currentShadowPixels,
  targetShadowPixels,
  resolution,
  iouResult,
  puzzleScore,
  attempts,
  startedAt,
  solvedAt,
  solutionRevealed,
  onReset,
  onRetry,
  onRevealSolution,
  onNextLevel,
}) => {
  const targetCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [showVictory, setShowVictory] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);
  const [showSolutionModal, setShowSolutionModal] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const hints = useMemo(
    () => (level.hints && level.hints.length > 0 ? level.hints : [level.hint]),
    [level.hints, level.hint]
  );

  // Redraw target silhouette and reset local UI when the level or attempt changes.
  useEffect(() => {
    if (targetCanvasRef.current) {
      const ctx = targetCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        if (targetShadowPixels && targetShadowPixels.length >= resolution * resolution * 4) {
          // Show the exact ground-truth shadow captured from the solution scene.
          const image = ctx.createImageData(resolution, resolution);
          const total = resolution * resolution;
          for (let i = 0; i < total; i++) {
            const idx = i * 4;
            const isShadow =
              targetShadowPixels[idx] < 120 && targetShadowPixels[idx + 3] > 30;
            const value = isShadow ? 0 : 255;
            image.data[idx] = value;
            image.data[idx + 1] = value;
            image.data[idx + 2] = value;
            image.data[idx + 3] = 255;
          }
          ctx.putImageData(image, 0, 0);
        } else {
          drawTargetSilhouette(ctx, level.id, resolution, resolution);
        }
      }
    }
    setShowHint(false);
    setHintIndex(0);
    setShowVictory(false);
    setHasCelebrated(false);
    setShowSolutionModal(false);
  }, [level.id, resolution, startedAt, targetShadowPixels]);

  // Update visual difference canvas.
  useEffect(() => {
    if (!diffCanvasRef.current || !targetCanvasRef.current) return;

    const diffCtx = diffCanvasRef.current.getContext('2d');
    const targetCtx = targetCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!diffCtx || !targetCtx) return;

    if (!currentShadowPixels) {
      diffCtx.clearRect(0, 0, resolution, resolution);
      return;
    }

    const targetImgData = targetCtx.getImageData(0, 0, resolution, resolution);
    const diffImgData = diffCtx.createImageData(resolution, resolution);

    const total = resolution * resolution;
    const cur = currentShadowPixels;
    const tar = targetImgData.data;
    const out = diffImgData.data;

    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      // The engine returns a white background / black projected-shadow mask.
      const isCur = cur[idx] < 120 && cur[idx + 3] > 30;
      const isTar = tar[idx + 3] > 30 && tar[idx] < 120;

      if (isCur && isTar) {
        out[idx] = 16;
        out[idx + 1] = 185;
        out[idx + 2] = 129;
        out[idx + 3] = 230;
      } else if (isCur && !isTar) {
        out[idx] = 239;
        out[idx + 1] = 68;
        out[idx + 2] = 68;
        out[idx + 3] = 210;
      } else if (!isCur && isTar) {
        out[idx] = 56;
        out[idx + 1] = 189;
        out[idx + 2] = 248;
        out[idx + 3] = 160;
      } else {
        out[idx] = 15;
        out[idx + 1] = 23;
        out[idx + 2] = 42;
        out[idx + 3] = 200;
      }
    }

    diffCtx.putImageData(diffImgData, 0, 0);
  }, [currentShadowPixels, resolution, level.id]);

  // Live clock, frozen on solve.
  useEffect(() => {
    if (solvedAt) {
      setNow(solvedAt);
      return;
    }
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [startedAt, solvedAt]);

  // Victory celebration.
  useEffect(() => {
    if (puzzleScore?.passed && !hasCelebrated) {
      setShowVictory(true);
      setHasCelebrated(true);
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.15);
        osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.3);
        osc.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.85);
      } catch {
        // Audio is optional.
      }
    }
  }, [puzzleScore?.passed, hasCelebrated]);

  const score = puzzleScore?.score ?? iouResult?.score ?? 0;
  const rawIoU = puzzleScore?.rawIoU ?? iouResult?.rawIou ?? iouResult?.score ?? 0;
  const isPassed = puzzleScore?.passed ?? false;
  const scoreState: ScoreState = puzzleScore?.state ?? 'idle';
  const stateMeta = SCORE_STATE_META[scoreState];
  const validationMessage = puzzleScore
    ? getPrimaryValidationMessage(puzzleScore.validation)
    : null;
  const metrics = puzzleScore?.metrics;

  const elapsedMs = Math.max(0, (solvedAt ?? now) - startedAt);
  const parSeconds = level.timerSeconds;
  const parLabel = parSeconds ? formatDuration(parSeconds * 1000) : '—';

  const difficultyColors = {
    Beginner: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    Intermediate: 'bg-amber-950 text-amber-300 border-amber-800',
    Advanced: 'bg-rose-950 text-rose-300 border-rose-800',
    Master: 'bg-purple-950 text-purple-300 border-purple-800',
  };

  return (
    <>
      {/* Top Left Floating Puzzle Challenge Card */}
      <div className="absolute top-16 left-4 z-20 w-80 max-w-[calc(100vw-32px)] max-h-[calc(100vh-13rem)] overflow-y-auto bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl text-white">
        {/* Level Header & Navigation */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                difficultyColors[level.difficulty]
              }`}
            >
              {level.difficulty}
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              Level {levelIndex + 1} of {totalLevels}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onSelectLevel(Math.max(0, levelIndex - 1))}
              disabled={levelIndex === 0}
              className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300"
              title="Previous Level"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSelectLevel(Math.min(totalLevels - 1, levelIndex + 1))}
              disabled={levelIndex === totalLevels - 1}
              className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300"
              title="Next Level"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Level Title & Brief */}
        <div className="mb-3">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
            <span>{level.title}</span>
            {isPassed && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
            {level.description}
          </p>
        </div>

        {/* Visual Difference & Target Canvases */}
        <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
          <div className="text-center">
            <span className="text-[10px] font-semibold text-slate-400 block mb-1">
              Target Silhouette
            </span>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-slate-700/80 bg-white shadow-inner flex items-center justify-center">
              <canvas
                ref={targetCanvasRef}
                width={resolution}
                height={resolution}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="text-center">
            <span className="text-[10px] font-semibold text-slate-400 block mb-1">
              Projected Mask
            </span>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-slate-700/80 bg-slate-950 shadow-inner flex items-center justify-center">
              <canvas
                ref={diffCanvasRef}
                width={resolution}
                height={resolution}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 mb-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Match
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Excess
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Missing
          </span>
        </div>

        {/* Score State & Meter */}
        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 mb-2">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Shadow Match</span>
            </span>
            <span className="font-mono font-bold text-sm">
              <span className={isPassed ? 'text-emerald-400' : 'text-amber-400'}>
                {score.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500 ml-1">
                (Need {level.targetThreshold}%)
              </span>
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-200 rounded-full ${
                isPassed
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-amber-500 to-rose-500'
              }`}
              style={{ width: `${Math.min(100, (score / level.targetThreshold) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-2 gap-2">
            <span
              className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${stateMeta.className}`}
              title={stateMeta.hint}
            >
              {stateMeta.label}
            </span>
            <span className="text-[9px] text-slate-500 font-mono">
              raw IoU {rawIoU.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Attempts, Timer & Par */}
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-1.5 text-center">
            <span className="text-[9px] text-slate-500 block">Attempts</span>
            <span className="text-xs font-bold text-slate-200 font-mono">{attempts}</span>
          </div>
          <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-1.5 text-center">
            <span className="text-[9px] text-slate-500 flex items-center justify-center gap-1">
              <Timer className="w-2.5 h-2.5" /> Time
            </span>
            <span className="text-xs font-bold text-slate-200 font-mono">
              {formatDuration(elapsedMs)}
            </span>
          </div>
          <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-1.5 text-center">
            <span className="text-[9px] text-slate-500 flex items-center justify-center gap-1">
              <Target className="w-2.5 h-2.5" /> Par
            </span>
            <span className="text-xs font-bold text-slate-200 font-mono">{parLabel}</span>
          </div>
        </div>

        {/* Validation feedback */}
        {validationMessage && (
          <div
            className={`mb-2 p-2 rounded-lg border text-[10px] leading-relaxed flex items-start gap-1.5 ${
              validationMessage.severity === 'error'
                ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                : 'bg-amber-950/50 border-amber-800/70 text-amber-200'
            }`}
          >
            {validationMessage.severity === 'error' ? (
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            )}
            <span>{validationMessage.message}</span>
          </div>
        )}

        {/* Shape metrics */}
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <MiniMetric
            label="Precision"
            value={metrics?.precision ?? 0}
            accent="bg-emerald-400"
          />
          <MiniMetric label="Recall" value={metrics?.recall ?? 0} accent="bg-sky-400" />
          <MiniMetric
            label="Shape"
            value={metrics?.structureScore ?? 0}
            accent="bg-violet-400"
          />
        </div>

        {/* Hint & Solution Controls */}
        <div className="pt-1 flex items-center justify-between text-xs">
          <button
            onClick={() => setShowHint((previous) => !previous)}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showHint ? 'Hide Hint' : 'Need a hint?'}</span>
          </button>

          <button
            onClick={() => {
              onRevealSolution();
              setShowSolutionModal(true);
            }}
            className="flex items-center gap-1 text-slate-400 hover:text-amber-300 transition-colors text-[11px]"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{solutionRevealed ? 'View Solution' : 'Reveal Solution'}</span>
          </button>
        </div>

        {showHint && (
          <div className="mt-2 p-2 rounded-lg bg-indigo-950/80 border border-indigo-800/80 text-[11px] text-indigo-200 leading-relaxed">
            <div className="flex items-start gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" />
              <span>{hints[hintIndex] ?? level.hint}</span>
            </div>
            {hints.length > 1 && (
              <button
                onClick={() => setHintIndex((previous) => (previous + 1) % hints.length)}
                className="mt-1.5 text-[10px] font-semibold text-indigo-300 hover:text-indigo-100"
              >
                Next hint ({hintIndex + 1}/{hints.length}) →
              </button>
            )}
          </div>
        )}

        {/* Reset / Retry */}
        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors"
            title="Restore the starting arrangement; the timer keeps running"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            onClick={onRetry}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors"
            title="Restart the puzzle and count a new attempt"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-500 font-mono">
          <span className="flex items-center gap-1">
            <Gauge className="w-2.5 h-2.5" />
            {iouResult?.method || 'Direct Pixel Reduction'}
          </span>
          <span>{solutionRevealed ? 'Solution revealed' : 'Shape-gated scoring'}</span>
        </div>
      </div>

      {/* Solution Reveal Modal */}
      {showSolutionModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-amber-500/40 bg-slate-950 text-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-700 text-amber-300 shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-100">Solution Reveal</h3>
                  <p className="text-[11px] text-slate-400">
                    Object-by-object construction of the target shadow
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSolutionModal(false)}
                className="shrink-0 p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Close solution"
                aria-label="Close solution"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-4">
              <div className="rounded-2xl bg-white p-2 mb-1.5 border border-slate-700">
                <img
                  src={getSolutionDiagramImage(level.id) ?? level.targetImage}
                  alt={`${level.title} solution arrangement`}
                  className="w-full max-h-52 object-contain"
                />
              </div>

              <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                Each coloured part is one object from the scene, drawn at the position and rotation
                that makes up the projected shadow.
              </p>

              <div className="max-h-36 overflow-y-auto rounded-xl bg-slate-900 border border-slate-800 mb-3">
                {level.solutionObjects.map((object, index) => (
                  <div
                    key={object.id}
                    className="flex items-start gap-2 px-2.5 py-1.5 border-b border-slate-800/70 last:border-b-0"
                  >
                    <span
                      className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-950 shrink-0"
                      style={{ backgroundColor: object.color }}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-200">
                        {object.name}{' '}
                        <span className="text-slate-500 font-normal">({object.shape})</span>
                      </div>
                      <div className="text-[9px] font-mono text-slate-400 break-words">
                        pos {object.position.join(', ')} · rot {object.rotation.join(', ')}° · scale{' '}
                        {object.scale.join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 leading-relaxed mb-3">
                <strong className="text-amber-300 block mb-1">How it is built:</strong>
                {level.solutionNote}
              </div>

              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  onClick={onReset}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Scene
                </button>
                <button
                  onClick={() => setShowSolutionModal(false)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white text-xs font-bold transition-all"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Victory Celebration Modal */}
      {showVictory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/50 rounded-3xl p-6 shadow-2xl text-center text-white relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />

            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/50">
              <Trophy className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold tracking-tight text-white mb-1 flex items-center justify-center gap-2">
              <span>Challenge Solved!</span>
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h3>

            <p className="text-xs text-slate-300 mb-3">
              Your projected shadow matched the target silhouette with a score of{' '}
              <strong className="text-emerald-400 font-bold">{score.toFixed(1)}%</strong>.
            </p>

            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2">
                <span className="text-[9px] text-slate-500 block">Time</span>
                <span className="text-xs font-bold font-mono">{formatDuration(elapsedMs)}</span>
              </div>
              <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2">
                <span className="text-[9px] text-slate-500 block">Attempts</span>
                <span className="text-xs font-bold font-mono">{attempts}</span>
              </div>
              <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2">
                <span className="text-[9px] text-slate-500 block">Shape</span>
                <span className="text-xs font-bold font-mono">
                  {Math.round((puzzleScore?.validation.score ?? 0) * 10) / 10}%
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left text-xs text-slate-400 mb-5 leading-relaxed">
              <strong className="text-slate-200 block mb-0.5">CGVR Graphic Principle:</strong>
              {level.solutionNote}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setShowVictory(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Inspect Sculpture
              </button>
              <button
                onClick={onRetry}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
              {levelIndex < totalLevels - 1 ? (
                <button
                  onClick={() => {
                    setShowVictory(false);
                    onNextLevel();
                  }}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-950 transition-all flex items-center gap-1.5"
                >
                  <span>Next Challenge</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <span className="text-xs font-semibold text-emerald-400">
                  🎉 Mastered All Challenges!
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
