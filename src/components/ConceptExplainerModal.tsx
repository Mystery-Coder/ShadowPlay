/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, GraduationCap, BookOpen, Layers, Lightbulb, Box, Compass } from 'lucide-react';

interface ConceptExplainerModalProps {
  onClose: () => void;
}

export const ConceptExplainerModal: React.FC<ConceptExplainerModalProps> = ({ onClose }) => {
  const concepts = [
    {
      title: '3D Geometric Transformations',
      icon: <Box className="w-4 h-4 text-indigo-400" />,
      desc: 'Every user interaction on a 3D primitive is translated into a 4×4 affine model matrix (M = T · R · S). Hierarchical composite models inherit transformations from parent nodes. Small rotational adjustments alter the resulting 2D shadow boundary.',
    },
    {
      title: 'Projection Transformations & Shadow Mapping',
      icon: <Layers className="w-4 h-4 text-emerald-400" />,
      desc: "A shadow is the geometric projection of 3D objects from the light source's point of view onto a receiving backdrop. In our WebGPU pipeline, a depth-only render pass records distance into a 32-bit depth buffer, sampled via Percentage-Closer Filtering (PCF) with normal-offset bias to prevent acne.",
    },
    {
      title: 'Anamorphic Perspective & Depth Ambiguity',
      icon: <Compass className="w-4 h-4 text-rose-400" />,
      desc: 'Perspective projection projects rays along lines passing through a single focal center. Objects placed at differing depths (Z) project to identical (X, Y) coordinates on the viewing plane if aligned along these sightlines, creating optical illusions that dissolve upon moving the camera.',
    },
    {
      title: 'Chromatic Shadow Color Synthesis',
      icon: <Lightbulb className="w-4 h-4 text-amber-400" />,
      desc: 'Demonstrates additive and subtractive color optics. Three primary spotlights (Red, Green, Blue) cast overlapping shadows. An object obstructing one color reveals the additive sum of the remaining two (e.g. blocking Red yields Cyan; blocking Green yields Magenta).',
    },
    {
      title: 'GPU Compute Parallel Reduction',
      icon: <GraduationCap className="w-4 h-4 text-sky-400" />,
      desc: 'A WGSL compute shader performs parallel Intersection-over-Union (IoU) reduction on GPU workgroups. It computes intersection and union pixel counts simultaneously across thousands of GPU threads and writes a single score to a storage buffer, avoiding CPU readback stalls.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl max-h-[85vh] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-800 text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                CGVR Academic Syllabus & Principles
              </h3>
              <p className="text-xs text-slate-400">
                Computer Graphics & Virtual Reality (Seventh Semester B.E. / B.Tech.)
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
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Project Credentials Badge */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">Project:</span>{' '}
              <strong className="text-slate-100">ShadowPlay Experiential Learning Studio</strong>
            </div>
            <div className="text-slate-400">
              Team: <span className="text-indigo-300 font-mono">1RV23CS245 · 246 · 257 · 000</span>
            </div>
          </div>

          {/* Core Concept Cards */}
          <div className="space-y-3">
            {concepts.map((c, i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {c.icon}
                  <h4 className="font-bold text-slate-200 text-xs">{c.title}</h4>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
