/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { PuzzleLevel, IoUResult } from '../types';
import { drawTargetSilhouette } from '../engine/puzzles';
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
} from 'lucide-react';

interface PuzzleOverlayProps {
  level: PuzzleLevel;
  levelIndex: number;
  totalLevels: number;
  onSelectLevel: (index: number) => void;
  currentShadowPixels: Uint8Array | null;
  resolution: number;
  iouResult: IoUResult | null;
  onNextLevel: () => void;
}

export const PuzzleOverlay: React.FC<PuzzleOverlayProps> = ({
  level,
  levelIndex,
  totalLevels,
  onSelectLevel,
  currentShadowPixels,
  resolution,
  iouResult,
  onNextLevel,
}) => {
  const targetCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  // Redraw target silhouette when level changes
  useEffect(() => {
    if (targetCanvasRef.current) {
      const ctx = targetCanvasRef.current.getContext('2d');
      if (ctx) {
        drawTargetSilhouette(ctx, level.id, resolution, resolution);
      }
    }
    setShowHint(false);
    setShowVictory(false);
    setHasCelebrated(false);
  }, [level.id, resolution]);

  // Update visual difference canvas
  useEffect(() => {
    if (!diffCanvasRef.current || !targetCanvasRef.current || !currentShadowPixels) return;

    const diffCtx = diffCanvasRef.current.getContext('2d');
    const targetCtx = targetCanvasRef.current.getContext('2d');
    if (!diffCtx || !targetCtx) return;

    const targetImgData = targetCtx.getImageData(0, 0, resolution, resolution);
    const diffImgData = diffCtx.createImageData(resolution, resolution);

    const total = resolution * resolution;
    const cur = currentShadowPixels;
    const tar = targetImgData.data;
    const out = diffImgData.data;

    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      // In Three.js render target capture: shadows are darker than lit wall
      // The wall is lit white (~255), shadow is dark (~0..100)
      const isCur = cur[idx] < 120 && cur[idx + 3] > 30;
      const isTar = tar[idx + 3] > 30 && tar[idx] < 120;

      if (isCur && isTar) {
        // MATCH: Emerald Green
        out[idx] = 16;
        out[idx + 1] = 185;
        out[idx + 2] = 129;
        out[idx + 3] = 230;
      } else if (isCur && !isTar) {
        // EXCESS SHADOW: Coral Red
        out[idx] = 239;
        out[idx + 1] = 68;
        out[idx + 2] = 68;
        out[idx + 3] = 210;
      } else if (!isCur && isTar) {
        // MISSING SHADOW: Sky Blue
        out[idx] = 56;
        out[idx + 1] = 189;
        out[idx + 2] = 248;
        out[idx + 3] = 160;
      } else {
        // Background: Deep dark slate
        out[idx] = 15;
        out[idx + 1] = 23;
        out[idx + 2] = 42;
        out[idx + 3] = 200;
      }
    }

    diffCtx.putImageData(diffImgData, 0, 0);
  }, [currentShadowPixels, resolution]);

  // Check victory condition
  useEffect(() => {
    const score = iouResult?.score || 0;
    if (score >= level.targetThreshold && !hasCelebrated) {
      setShowVictory(true);
      setHasCelebrated(true);
      // Play celebratory audio chime procedural tone
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.3); // G5
        osc.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.5); // C6
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.85);
      } catch {
        // Audio optional
      }
    }
  }, [iouResult?.score, level.targetThreshold, hasCelebrated]);

  const score = iouResult?.score || 0;
  const isPassed = score >= level.targetThreshold;

  const difficultyColors = {
    Beginner: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    Intermediate: 'bg-amber-950 text-amber-300 border-amber-800',
    Advanced: 'bg-rose-950 text-rose-300 border-rose-800',
    Master: 'bg-purple-950 text-purple-300 border-purple-800',
  };

  return (
    <>
      {/* Top Left Floating Puzzle Challenge Card */}
      <div className="absolute top-16 left-4 z-20 w-80 max-w-[calc(100vw-32px)] bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl text-white">
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
          {/* Target Silhouette */}
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

          {/* Real-time Match Difference Mask */}
          <div className="text-center">
            <span className="text-[10px] font-semibold text-slate-400 block mb-1">
              GPU Silhouette Mask
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

        {/* IoU Match Meter */}
        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 mb-2">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>IoU Match</span>
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

          {/* Progress Bar */}
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
        </div>

        {/* Hint Toggle & Solution Note */}
        <div className="pt-1 flex items-center justify-between text-xs">
          <button
            onClick={() => setShowHint(!showHint)}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors text-[11px]"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showHint ? 'Hide Hint' : 'Need a hint?'}</span>
          </button>

          <span className="text-[10px] text-slate-500 font-mono">
            {iouResult?.method || 'WGSL Compute'}
          </span>
        </div>

        {showHint && (
          <div className="mt-2 p-2 rounded-lg bg-indigo-950/80 border border-indigo-800/80 text-[11px] text-indigo-200 leading-relaxed animate-fadeIn">
            💡 {level.hint}
          </div>
        )}
      </div>

      {/* Victory Celebration Modal */}
      {showVictory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/50 rounded-3xl p-6 shadow-2xl text-center text-white relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />

            {/* Trophy Icon */}
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/50">
              <Trophy className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold tracking-tight text-white mb-1 flex items-center justify-center gap-2">
              <span>Challenge Solved!</span>
              <Sparkles className="w-5 h-5 text-amber-400" />
            </h3>

            <p className="text-xs text-slate-300 mb-4">
              Your shadow sculpture matched the target silhouette with a similarity score of{' '}
              <strong className="text-emerald-400 font-bold">{score.toFixed(1)}%</strong>!
            </p>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left text-xs text-slate-400 mb-5 leading-relaxed">
              <strong className="text-slate-200 block mb-0.5">CGVR Graphic Principle:</strong>
              {level.solutionNote}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowVictory(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Inspect Sculpture
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
