/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, Glasses, CheckCircle2, AlertCircle, Laptop, Smartphone, HelpCircle } from 'lucide-react';

interface WebXrModalProps {
  onClose: () => void;
}

export const WebXrModal: React.FC<WebXrModalProps> = ({ onClose }) => {
  const [xrSupported, setXrSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).xr) {
      (navigator as any).xr
        .isSessionSupported('immersive-vr')
        .then((supported: boolean) => setXrSupported(supported))
        .catch(() => setXrSupported(false));
    } else {
      setXrSupported(false);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-950/80 border border-sky-800 text-sky-400">
              <Glasses className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">WebXR Immersive Integration</h3>
              <p className="text-xs text-slate-400">Headset VR architecture & roadmap</p>
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
        <div className="p-6 space-y-4 text-xs text-slate-300">
          {/* Status Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            {xrSupported === true ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-sky-400 shrink-0" />
            )}
            <div>
              <div className="font-bold text-slate-100">
                {xrSupported === true
                  ? 'WebXR Immersive VR Supported'
                  : 'Desktop Browser Baseline Mode Active'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {xrSupported === true
                  ? 'A compatible VR headset or WebXR runtime was detected.'
                  : 'As designed in the project synopsis, the desktop WebGPU studio serves as the primary verified baseline.'}
              </div>
            </div>
          </div>

          {/* Architecture Details */}
          <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800">
            <strong className="text-slate-100 block mb-1">
              Phase 5 WebXR Architecture (per Project Synopsis):
            </strong>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              <li>
                <strong>Single Codebase:</strong> The same WebGPU render loop and shadow mapping passes run in both desktop and headset modes without a separate build.
              </li>
              <li>
                <strong>Stereo Transformation:</strong> Headset supplies per-eye view and projection matrices via <code>XRView</code> each frame with a stable <code>local-floor</code> origin.
              </li>
              <li>
                <strong>Controller Raycasting:</strong> Tracked 6DoF controllers drive ray selection and 3D grab manipulation in the virtual studio room.
              </li>
              <li>
                <strong>DOM Overlay:</strong> The studio interface and puzzle HUD are projected as an interactive WebXR DOM layer.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
