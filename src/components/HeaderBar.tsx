/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppMode, WebGpuStatus } from '../types';
import {
  Boxes,
  Puzzle,
  Eye,
  Palette,
  Cpu,
  GraduationCap,
  Glasses,
  Camera,
  RotateCcw,
  Gauge,
} from 'lucide-react';

interface HeaderBarProps {
  mode: AppMode;
  onSetMode: (mode: AppMode) => void;
  gpuStatus: WebGpuStatus | null;
  onOpenGpuModal: () => void;
  onOpenConceptsModal: () => void;
  onOpenWebXrModal: () => void;
  onResetScene: () => void;
  onCaptureSnapshot: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  mode,
  onSetMode,
  gpuStatus,
  onOpenGpuModal,
  onOpenConceptsModal,
  onOpenWebXrModal,
  onResetScene,
  onCaptureSnapshot,
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 text-white">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 p-[1.5px] shadow-lg shadow-rose-950/40">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <span className="text-lg font-black tracking-tighter bg-gradient-to-r from-amber-400 to-rose-400 bg-clip-text text-transparent">
              SP
            </span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-slate-100">
              ShadowPlay
            </h1>
            <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-950/90 text-indigo-300 border border-indigo-800/60">
              WebGPU Studio
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium hidden md:block">
            3D Shadow Sculpting & Optical Illusion Studio · RVCE CGVR
          </p>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <nav className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-inner">
        <button
          onClick={() => onSetMode('sandbox')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'sandbox'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Free 3D shadow creation sandbox"
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Creator</span>
        </button>

        <button
          onClick={() => onSetMode('puzzle')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'puzzle'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Shadow Silhouette Puzzle Challenges"
        >
          <Puzzle className="w-3.5 h-3.5" />
          <span>Puzzles</span>
        </button>

        <button
          onClick={() => onSetMode('illusion')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'illusion'
              ? 'bg-gradient-to-r from-rose-600 to-pink-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Anamorphic Perspective Illusions"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Illusion</span>
        </button>

        <button
          onClick={() => onSetMode('multilight')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'multilight'
              ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="Multi-Light Chromatic Color Shadow Studio"
        >
          <Palette className="w-3.5 h-3.5" />
          <span>RGB Lights</span>
        </button>

        <button
          onClick={() => onSetMode('pagp')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'pagp'
              ? 'bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
          title="PAGP Performance and GPU Analytics Dashboard"
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>PAGP</span>
        </button>
      </nav>

      {/* Utility Actions */}
      <div className="flex items-center gap-2">
        {/* WebGPU Status Pill */}
        <button
          onClick={onOpenGpuModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors"
          title="View WebGPU Pipeline & WGSL Compute details"
        >
          <Cpu className={`w-3.5 h-3.5 ${gpuStatus?.supported ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="hidden sm:inline">
            {gpuStatus?.supported ? 'WebGPU Active' : 'GPU Emulation'}
          </span>
        </button>

        {/* CGVR Concepts */}
        <button
          onClick={onOpenConceptsModal}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors"
          title="Computer Graphics & VR Syllabus Concepts"
        >
          <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden lg:inline">Concepts</span>
        </button>

        {/* WebXR Readiness */}
        <button
          onClick={onOpenWebXrModal}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors"
          title="WebXR Immersive Mode Info"
        >
          <Glasses className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden lg:inline">WebXR</span>
        </button>

        {/* Snapshot Capture */}
        <button
          onClick={onCaptureSnapshot}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Export high-res PNG snapshot of shadow art"
        >
          <Camera className="w-4 h-4" />
        </button>

        {/* Reset */}
        <button
          onClick={onResetScene}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Reset current scene"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
