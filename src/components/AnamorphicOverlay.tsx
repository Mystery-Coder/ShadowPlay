/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AnamorphicPreset } from '../types';
import { Eye, Sparkles, Orbit, Compass, CheckCircle2 } from 'lucide-react';

interface AnamorphicOverlayProps {
  presets: AnamorphicPreset[];
  activePreset: AnamorphicPreset;
  onSelectPreset: (preset: AnamorphicPreset) => void;
  accuracy: number; // 0 to 100
  onLockPeepHole: () => void;
  onFreeOrbit: () => void;
}

export const AnamorphicOverlay: React.FC<AnamorphicOverlayProps> = ({
  presets,
  activePreset,
  onSelectPreset,
  accuracy,
  onLockPeepHole,
  onFreeOrbit,
}) => {
  const isResolved = accuracy >= 90;

  return (
    <div className="absolute top-16 left-4 z-20 w-84 max-w-[calc(100vw-32px)] bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-white">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-400">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-100 block">
              Anamorphic Perspective
            </span>
            <span className="text-[10px] text-slate-400">Fixed-Viewpoint Illusion</span>
          </div>
        </div>

        {/* Preset Selector */}
        <select
          value={activePreset.id}
          onChange={(e) => {
            const found = presets.find((p) => p.id === e.target.value);
            if (found) onSelectPreset(found);
          }}
          className="bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold px-2 py-1 text-slate-200 outline-none"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Preset Brief */}
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
          <span>{activePreset.name}</span>
          {isResolved && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        </h3>
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
          {activePreset.description}
        </p>
      </div>

      {/* Alignment Gauge */}
      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 mb-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-rose-400" />
            <span>Peep-Hole Alignment</span>
          </span>
          <span className="font-mono font-bold text-sm">
            <span className={isResolved ? 'text-emerald-400' : 'text-rose-400'}>
              {accuracy}%
            </span>
          </span>
        </div>

        {/* Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isResolved
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/50'
                : 'bg-gradient-to-r from-rose-600 to-pink-500'
            }`}
            style={{ width: `${accuracy}%` }}
          />
        </div>

        {/* Status Message */}
        <div className="text-[11px] font-medium text-center">
          {accuracy < 40 && (
            <span className="text-slate-400">Chaotic 3D cluster (Rotate around to see depth)</span>
          )}
          {accuracy >= 40 && accuracy < 75 && (
            <span className="text-amber-400">Shapes beginning to converge...</span>
          )}
          {accuracy >= 75 && accuracy < 90 && (
            <span className="text-pink-400">Almost aligned! Adjust viewpoint slightly.</span>
          )}
          {isResolved && (
            <span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Optical Illusion Perfectly Resolved!</span>
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          onClick={onLockPeepHole}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold shadow-lg shadow-rose-950/60 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Snap to Peep-Hole</span>
        </button>

        <button
          onClick={onFreeOrbit}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors border border-slate-700"
        >
          <Orbit className="w-3.5 h-3.5 text-slate-400" />
          <span>Inspect 3D Depth</span>
        </button>
      </div>

      {/* CGVR Educational footnote */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] text-slate-400 leading-normal">
        <strong>CGVR Concept:</strong> Perspective projection maps 3D points $(X, Y, Z)$ to 2D
        coordinates $(X/Z, Y/Z)$. By carefully placing objects along specific lines of sight at
        differing depths, an observer at the focal point perceives a unified 2D silhouette.
      </div>
    </div>
  );
};
