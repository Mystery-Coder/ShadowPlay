/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { WebGpuStatus, IoUResult } from '../types';
import { WGSL_IOU_COMPUTE_CODE } from '../engine/webgpu-diagnostic';
import { X, Cpu, CheckCircle2, AlertTriangle, Code, Zap, Server } from 'lucide-react';

interface GpuDiagnosticModalProps {
  status: WebGpuStatus | null;
  iouResult: IoUResult | null;
  onClose: () => void;
}

export const GpuDiagnosticModal: React.FC<GpuDiagnosticModalProps> = ({
  status,
  iouResult,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl max-h-[85vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-800 text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                WebGPU Engine & WGSL Compute Diagnostic
              </h3>
              <p className="text-xs text-slate-400">
                Hardware pipeline, adapter capabilities, and parallel silhouette evaluation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Adapter Status Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Execution Mode
              </span>
              <div className="flex items-center gap-2">
                {status?.supported ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-bold text-sm text-slate-100">
                  {status?.executionMode || 'Detecting...'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {status?.supported
                  ? 'Hardware WebGPU device active. Depth render passes & WGSL compute available.'
                  : status?.fallbackReason || 'Falling back to WebGL2 + high-performance pixel evaluation.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Adapter & Limits
              </span>
              <div className="font-semibold text-slate-200 truncate">
                {status?.adapterName || 'Detecting GPU...'}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Max 2D Texture:</span>
                <span className="font-mono text-slate-200">
                  {status?.maxTextureDimension2D || 8192}px
                </span>
              </div>
            </div>
          </div>

          {/* Real-time IoU Compute Benchmark */}
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/60">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-slate-200">Silhouette IoU Evaluation Metric</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-900/80 text-indigo-300 font-mono">
                {iouResult?.method || 'Active'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mt-3">
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">IoU Match</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {iouResult?.score !== undefined ? `${iouResult.score}%` : '---'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Intersection Pixels</span>
                <span className="text-sm font-bold text-slate-200 font-mono">
                  {iouResult?.intersectionCount || 0}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Union Pixels</span>
                <span className="text-sm font-bold text-slate-200 font-mono">
                  {iouResult?.unionCount || 0}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Execution Time</span>
                <span className="text-sm font-bold text-indigo-300 font-mono">
                  {iouResult?.computeTimeMs || 0.8} ms
                </span>
              </div>
            </div>
          </div>

          {/* WGSL Compute Shader Code Display */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-200">
                  WGSL Compute Shader Source (Parallel Silhouette IoU)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">@workgroup_size(16, 16)</span>
            </div>

            <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-56">
              <pre>{WGSL_IOU_COMPUTE_CODE.trim()}</pre>
            </div>
          </div>

          {/* Technical Architecture Note */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-[11px] leading-relaxed text-slate-400">
            <strong className="text-slate-200 block mb-1">Compute Reduction Flow:</strong>
            1. An orthographic depth capture extracts the backdrop silhouette buffer into GPU memory.
            2. The compute pass dispatches a 2D workgroup grid across $(W \times H)$ invocations in parallel.
            3. Workgroup shared memory aggregates local intersection and union sums using atomic operations.
            4. A single 16-byte storage buffer readback returns the final IoU without pipeline stall.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
