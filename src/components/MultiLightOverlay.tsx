/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { StudioLight } from '../types';
import { Palette, Lightbulb, Sun, Layers } from 'lucide-react';

interface MultiLightOverlayProps {
  lights: StudioLight[];
  onApplyColorPreset: (preset: 'rgb' | 'cmy' | 'sunset' | 'mono') => void;
  onToggleLight: (index: number) => void;
}

export const MultiLightOverlay: React.FC<MultiLightOverlayProps> = ({
  lights,
  onApplyColorPreset,
  onToggleLight,
}) => {
  return (
    <div className="absolute top-16 left-4 z-20 w-84 max-w-[calc(100vw-32px)] bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-white">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-slate-800">
        <div className="p-1.5 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-400">
          <Palette className="w-4 h-4" />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-100 block">
            Multi-Light Shadow Studio
          </span>
          <span className="text-[10px] text-slate-400">Chromatic Shadow Color Synthesis</span>
        </div>
      </div>

      {/* Physics Explanation */}
      <div className="mb-3 text-[11px] text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
        <p className="mb-1.5">
          When three spotlights (<strong>Red</strong>, <strong>Green</strong>, and <strong>Blue</strong>) illuminate a white backdrop, their combined rays create white light.
        </p>
        <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center font-semibold">
          <div className="p-1 rounded bg-cyan-950/80 border border-cyan-700 text-cyan-300">
            Block Red → <strong>Cyan</strong>
          </div>
          <div className="p-1 rounded bg-fuchsia-950/80 border border-fuchsia-700 text-fuchsia-300">
            Block Green → <strong>Magenta</strong>
          </div>
          <div className="p-1 rounded bg-yellow-950/80 border border-yellow-700 text-yellow-300">
            Block Blue → <strong>Yellow</strong>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-400">
          Where all three lights are blocked, the shadow is pitch black.
        </p>
      </div>

      {/* Color Rig Presets */}
      <div className="mb-3">
        <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
          Lighting Palette Presets
        </span>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <button
            onClick={() => onApplyColorPreset('rgb')}
            className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-left transition-colors"
          >
            <span className="flex -space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            </span>
            <span className="font-semibold text-xs">RGB Triad</span>
          </button>

          <button
            onClick={() => onApplyColorPreset('cmy')}
            className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-left transition-colors"
          >
            <span className="flex -space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
            </span>
            <span className="font-semibold text-xs">CMY Contrast</span>
          </button>

          <button
            onClick={() => onApplyColorPreset('sunset')}
            className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-left transition-colors"
          >
            <span className="flex -space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
            </span>
            <span className="font-semibold text-xs">Sunset Warm</span>
          </button>

          <button
            onClick={() => onApplyColorPreset('mono')}
            className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-left transition-colors"
          >
            <Sun className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-semibold text-xs">Neutral Studio</span>
          </button>
        </div>
      </div>

      {/* Active Light Sources Toggle */}
      <div>
        <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
          Active Spotlights in Virtual Rig
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {lights.map((l, i) => (
            <button
              key={l.id}
              onClick={() => onToggleLight(i)}
              className={`p-1.5 rounded-lg border text-center transition-all ${
                l.enabled
                  ? 'bg-slate-900 border-slate-600 shadow-md'
                  : 'bg-slate-950 border-slate-800 opacity-50'
              }`}
            >
              <div
                className="w-3.5 h-3.5 rounded-full mx-auto mb-1 border border-white/20"
                style={{ backgroundColor: l.color }}
              />
              <span className="text-[10px] font-bold block truncate">{l.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
