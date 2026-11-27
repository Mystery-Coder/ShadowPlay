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
  /**
   * Optional until Step 6. Pass App's existing `handleUpdateLight(index, partial)`
   * here to make the per-light property controls live.
   */
  onUpdateLight?: (index: number, patch: Partial<StudioLight>) => void;
}

type AxisIndex = 0 | 1 | 2;

const HEX_PATTERN = /^#[\da-f]{6}$/i;
const COLOR_INPUT_FALLBACK = '#000000';

/** HTML colour inputs require `#rrggbb`; keep malformed stored values safe. */
function toColorInputValue(hex: string): string {
  if (typeof hex !== 'string') return COLOR_INPUT_FALLBACK;
  const trimmed = hex.trim();
  return HEX_PATTERN.test(trimmed) ? trimmed.toLowerCase() : COLOR_INPUT_FALLBACK;
}

function finiteOr(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface VectorControlProps {
  label: string;
  values: [number, number, number];
  disabled: boolean;
  onChange: (axis: AxisIndex, value: number) => void;
}

/** Compact X/Y/Z numeric control group for a StudioLight vector property. */
const VectorControl: React.FC<VectorControlProps> = ({ label, values, disabled, onChange }) => {
  const axes: ReadonlyArray<{ label: string; axis: AxisIndex }> = [
    { label: 'X', axis: 0 },
    { label: 'Y', axis: 1 },
    { label: 'Z', axis: 2 },
  ];

  return (
    <div>
      <span className="text-[10px] text-slate-400 block mb-1">{label}</span>
      <div className="grid grid-cols-3 gap-1">
        {axes.map(({ label: axisLabel, axis }) => (
          <label key={axisLabel} className="block">
            <span className="text-[9px] text-slate-500 block mb-0.5">{axisLabel}</span>
            <input
              type="number"
              min={-10}
              max={10}
              step={0.1}
              value={finiteOr(values[axis])}
              disabled={disabled}
              title={disabled ? 'Requires onUpdateLight callback' : `${label} ${axisLabel}`}
              onChange={(event) => {
                const nextValue = Number.parseFloat(event.target.value);
                if (Number.isFinite(nextValue)) onChange(axis, nextValue);
              }}
              className="w-full min-w-0 bg-slate-950/80 border border-slate-800 rounded-md px-1.5 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </label>
        ))}
      </div>
    </div>
  );
};

export const MultiLightOverlay: React.FC<MultiLightOverlayProps> = ({
  lights,
  onApplyColorPreset,
  onToggleLight,
  onUpdateLight,
}) => {
  const canUpdateProperties = typeof onUpdateLight === 'function';

  /** Send only the changed field; the parent merges it with the existing light. */
  const updateLight = (index: number, patch: Partial<StudioLight>): void => {
    onUpdateLight?.(index, patch);
  };

  /** Copy the existing tuple before changing one axis; never mutate light data. */
  const updateVector = (
    index: number,
    light: StudioLight,
    property: 'position' | 'targetPosition',
    axis: AxisIndex,
    value: number
  ): void => {
    const nextVector: [number, number, number] = [
      light[property][0],
      light[property][1],
      light[property][2],
    ];
    nextVector[axis] = value;

    if (property === 'position') {
      updateLight(index, { position: nextVector });
    } else {
      updateLight(index, { targetPosition: nextVector });
    }
  };

  return (
    <div className="absolute top-16 left-4 z-20 w-84 max-w-[calc(100vw-32px)] max-h-[calc(100vh-5rem)] overflow-y-auto bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-white">
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

      {/* Individual Light Controls */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-400">
            Individual Light Controls
          </span>
        </div>

        {!canUpdateProperties && (
          <p className="mb-2 text-[9px] leading-snug text-amber-400/80">
            Property editing requires an onUpdateLight callback from the parent.
          </p>
        )}

        <div className="space-y-2">
          {lights.map((light, index) => (
            <div
              key={light.id}
              className={`p-2.5 rounded-xl border transition-colors ${
                light.enabled
                  ? 'bg-slate-900/70 border-slate-700'
                  : 'bg-slate-950/80 border-slate-800 opacity-70'
              }`}
            >
              {/* Light identity + existing enable/disable callback */}
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <div
                  className="w-3.5 h-3.5 shrink-0 rounded-full border border-white/20"
                  style={{ backgroundColor: toColorInputValue(light.color) }}
                />
                <span className="text-[11px] font-bold truncate flex-1" title={light.name}>
                  {light.name}
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  {light.color}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleLight(index)}
                  aria-pressed={light.enabled}
                  title={light.enabled ? `Disable ${light.name}` : `Enable ${light.name}`}
                  className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold border transition-colors ${
                    light.enabled
                      ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}
                >
                  {light.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="space-y-2">
                {/* Colour picker */}
                <label className="flex items-center gap-2">
                  <span className="w-12 text-[10px] text-slate-400">Colour</span>
                  <input
                    type="color"
                    value={toColorInputValue(light.color)}
                    disabled={!canUpdateProperties}
                    title={canUpdateProperties ? 'Light colour' : 'Requires onUpdateLight callback'}
                    onChange={(event) => updateLight(index, { color: event.target.value })}
                    className="h-6 w-9 bg-transparent border border-slate-700 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <span className="text-[10px] font-mono text-slate-300">
                    {light.color}
                  </span>
                </label>

                {/* Intensity slider with visible numeric value */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400">Intensity</span>
                    <span className="text-[10px] font-mono text-amber-300">
                      {finiteOr(light.intensity).toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={0.1}
                    value={clamp(finiteOr(light.intensity), 0, 6)}
                    disabled={!canUpdateProperties}
                    title={canUpdateProperties ? 'Light intensity' : 'Requires onUpdateLight callback'}
                    onChange={(event) => {
                      const nextIntensity = Number.parseFloat(event.target.value);
                      if (Number.isFinite(nextIntensity)) {
                        updateLight(index, { intensity: nextIntensity });
                      }
                    }}
                    className="w-full h-1.5 accent-amber-400 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>

                {/* Position and target vectors are copied, never mutated. */}
                <VectorControl
                  label="Position"
                  values={light.position}
                  disabled={!canUpdateProperties}
                  onChange={(axis, value) => updateVector(index, light, 'position', axis, value)}
                />
                <VectorControl
                  label="Target / Direction"
                  values={light.targetPosition}
                  disabled={!canUpdateProperties}
                  onChange={(axis, value) =>
                    updateVector(index, light, 'targetPosition', axis, value)
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
