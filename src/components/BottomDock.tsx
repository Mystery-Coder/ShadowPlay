/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StudioObject, StudioLight, ShapeType, AppMode } from '../types';
import {
  Move,
  Rotate3d,
  Maximize2,
  Plus,
  Trash2,
  Copy,
  Sun,
  Eye,
  FileDown,
  FileUp,
  ChevronDown,
  ChevronUp,
  Sliders,
  Layers,
  Sparkles,
} from 'lucide-react';

interface BottomDockProps {
  mode: AppMode;
  selectedObject: StudioObject | null;
  transformMode: 'translate' | 'rotate' | 'scale';
  onSetTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  onUpdateTransform: (
    pos?: [number, number, number],
    rot?: [number, number, number],
    scl?: [number, number, number]
  ) => void;
  onUpdateColor: (color: string) => void;
  onDeleteObject: () => void;
  onDuplicateObject: () => void;
  onAddObject: (shape: ShapeType) => void;
  lights: StudioLight[];
  onUpdateLight: (index: number, partial: Partial<StudioLight>) => void;
  onSetCameraPreset: (preset: 'orbit' | 'wall_front' | 'light_pov' | 'top_down' | 'anamorphic_peep') => void;
  onExportSceneJson: () => void;
  onImportSceneJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  activeCameraPreset: string;
  /** When provided, only these shapes can be spawned (used by puzzle levels). */
  allowedShapes?: ShapeType[];
}

export const BottomDock: React.FC<BottomDockProps> = ({
  mode,
  selectedObject,
  transformMode,
  onSetTransformMode,
  onUpdateTransform,
  onUpdateColor,
  onDeleteObject,
  onDuplicateObject,
  onAddObject,
  lights,
  onUpdateLight,
  onSetCameraPreset,
  onExportSceneJson,
  onImportSceneJson,
  activeCameraPreset,
  allowedShapes,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'transform' | 'spawn' | 'lights' | 'camera' | 'file'>('transform');

  const shapeList: { type: ShapeType; label: string; desc: string }[] = [
    { type: 'cube', label: 'Cube', desc: 'Chamfered solid' },
    { type: 'sphere', label: 'Sphere', desc: 'Round core' },
    { type: 'cylinder', label: 'Cylinder', desc: 'Fluted column' },
    { type: 'rod', label: 'Rod', desc: 'Slender bar' },
    { type: 'ring', label: 'Torus Ring', desc: 'Donut loop' },
    { type: 'cone', label: 'Cone', desc: 'Tapered spire' },
    { type: 'teapot', label: 'Teapot', desc: 'Utah classic' },
    { type: 'bird', label: 'Bird', desc: 'Winged flyer' },
    { type: 'key', label: 'Key', desc: 'Antique bit' },
    { type: 'chair', label: 'Chair', desc: 'High-back seat' },
    { type: 'arch', label: 'Arch', desc: 'Roman portal' },
    { type: 'spiral', label: 'Spiral', desc: 'Helical curve' },
  ];

  const availableShapes = allowedShapes
    ? shapeList.filter((item) => allowedShapes.includes(item.type))
    : shapeList;

  return (
    <div
      className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-20 w-[95vw] max-w-4xl transition-all duration-300 ease-in-out ${
        collapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
      }`}
    >
      {/* Collapse / Expand Toggle Tab */}
      <div className="flex justify-center mb-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold shadow-lg backdrop-blur-md transition-colors"
          title="Toggle Control Dock (Press 'H')"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Studio Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Dock (Cinema Mode)</span>
            </>
          )}
        </button>
      </div>

      {/* Main Glassmorphic Dock Container */}
      <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-xl p-3 text-white overflow-hidden">
        {/* Top Dock Navigation & Quick Viewpoints */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800/80">
          {/* Main Control Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('transform')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'transform' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Transform</span>
            </button>

            <button
              onClick={() => setActiveTab('spawn')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'spawn' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Shape</span>
            </button>

            <button
              onClick={() => setActiveTab('lights')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'lights' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Lights</span>
            </button>

            <button
              onClick={() => setActiveTab('camera')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'camera' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Camera</span>
            </button>

            <button
              onClick={() => setActiveTab('file')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'file' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Save / Load</span>
            </button>
          </div>

          {/* Quick Viewpoint Buttons */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400 font-medium mr-1 hidden sm:inline">View:</span>
            <button
              onClick={() => onSetCameraPreset('orbit')}
              className={`px-2 py-0.5 rounded-md border text-xs transition-colors ${
                activeCameraPreset === 'orbit'
                  ? 'bg-slate-700 text-white border-slate-500 font-semibold'
                  : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              Orbit
            </button>
            <button
              onClick={() => onSetCameraPreset('wall_front')}
              className={`px-2 py-0.5 rounded-md border text-xs transition-colors ${
                activeCameraPreset === 'wall_front'
                  ? 'bg-slate-700 text-white border-slate-500 font-semibold'
                  : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
              title="Perpendicular front view of the shadow projection wall"
            >
              Wall Front
            </button>
            <button
              onClick={() => onSetCameraPreset('light_pov')}
              className={`px-2 py-0.5 rounded-md border text-xs transition-colors ${
                activeCameraPreset === 'light_pov'
                  ? 'bg-slate-700 text-white border-slate-500 font-semibold'
                  : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
              title="Point of view from inside the spotlight looking through the beam"
            >
              Light POV
            </button>
            <button
              onClick={() => onSetCameraPreset('top_down')}
              className={`px-2 py-0.5 rounded-md border text-xs transition-colors ${
                activeCameraPreset === 'top_down'
                  ? 'bg-slate-700 text-white border-slate-500 font-semibold'
                  : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              Top-Down
            </button>
            {mode === 'illusion' && (
              <button
                onClick={() => onSetCameraPreset('anamorphic_peep')}
                className={`px-2.5 py-0.5 rounded-md border text-xs font-semibold bg-rose-950/80 text-rose-300 border-rose-700/80 hover:bg-rose-900 transition-colors flex items-center gap-1`}
              >
                <Sparkles className="w-3 h-3 text-rose-400" />
                <span>Sweet Spot</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Transform & Object Controls */}
        {activeTab === 'transform' && (
          <div>
            {selectedObject ? (
              <div className="space-y-2.5">
                {/* Object Header: Name, Shape, Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                      {selectedObject.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {selectedObject.shape}
                    </span>
                  </div>

                  {/* Mode Buttons: Translate / Rotate / Scale */}
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => onSetTransformMode('translate')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium ${
                        transformMode === 'translate' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Translate (Drag in 3D)"
                    >
                      <Move className="w-3.5 h-3.5" />
                      <span>Translate</span>
                    </button>
                    <button
                      onClick={() => onSetTransformMode('rotate')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium ${
                        transformMode === 'rotate' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Rotate (Yaw, Pitch, Roll)"
                    >
                      <Rotate3d className="w-3.5 h-3.5" />
                      <span>Rotate</span>
                    </button>
                    <button
                      onClick={() => onSetTransformMode('scale')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium ${
                        transformMode === 'scale' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Scale Object"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Scale</span>
                    </button>
                  </div>

                  {/* Duplicate & Delete */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={onDuplicateObject}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                      title="Duplicate selected shape"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Clone</span>
                    </button>
                    <button
                      onClick={onDeleteObject}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-medium transition-colors"
                      title="Delete selected shape"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Transform Value Sliders / Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                  {/* Position (X, Y, Z) */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400">Position (X, Y, Z)</span>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <span className="text-red-400 font-bold">X</span>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedObject.position[0]}
                          onChange={(e) =>
                            onUpdateTransform([
                              parseFloat(e.target.value) || 0,
                              selectedObject.position[1],
                              selectedObject.position[2],
                            ])
                          }
                          className="w-full bg-transparent text-white outline-none font-mono text-[11px]"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <span className="text-emerald-400 font-bold">Y</span>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedObject.position[1]}
                          onChange={(e) =>
                            onUpdateTransform([
                              selectedObject.position[0],
                              parseFloat(e.target.value) || 0,
                              selectedObject.position[2],
                            ])
                          }
                          className="w-full bg-transparent text-white outline-none font-mono text-[11px]"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <span className="text-blue-400 font-bold">Z</span>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedObject.position[2]}
                          onChange={(e) =>
                            onUpdateTransform([
                              selectedObject.position[0],
                              selectedObject.position[1],
                              parseFloat(e.target.value) || 0,
                            ])
                          }
                          className="w-full bg-transparent text-white outline-none font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rotation Angles (Deg) */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400">Rotation Degrees (Pitch, Yaw, Roll)</span>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <span className="text-red-400 font-bold">X°</span>
                        <input
                          type="number"
                          step="15"
                          value={selectedObject.rotation[0]}
                          onChange={(e) =>
                            onUpdateTransform(
                              undefined,
                              [
                                parseFloat(e.target.value) || 0,
                                selectedObject.rotation[1],
                                selectedObject.rotation[2],
                              ]
                            )
                          }
                          className="w-full bg-transparent text-white outline-none font-mono text-[11px]"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <span className="text-emerald-400 font-bold">Y°</span>
                        <input
                          type="number"
                          step="15"
                          value={selectedObject.rotation[1]}
                          onChange={(e) =>
                            onUpdateTransform(
                              undefined,
                              [
                                selectedObject.rotation[0],
                                parseFloat(e.target.value) || 0,
                                selectedObject.rotation[2],
                              ]
                            )
                          }
                          className="w-full bg-transparent text-white outline-none font-mono text-[11px]"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <span className="text-blue-400 font-bold">Z°</span>
                        <input
                          type="number"
                          step="15"
                          value={selectedObject.rotation[2]}
                          onChange={(e) =>
                            onUpdateTransform(
                              undefined,
                              [
                                selectedObject.rotation[0],
                                selectedObject.rotation[1],
                                parseFloat(e.target.value) || 0,
                              ]
                            )
                          }
                          className="w-full bg-transparent text-white outline-none font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Scale & Material Color */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400">Scale & Surface Tint</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800 flex-1">
                        <span className="text-slate-400 font-bold">Scale</span>
                        <input
                          type="range"
                          min="0.2"
                          max="3.0"
                          step="0.05"
                          value={selectedObject.scale[0]}
                          onChange={(e) => {
                            const s = parseFloat(e.target.value);
                            onUpdateTransform(undefined, undefined, [s, s, s]);
                          }}
                          className="w-full accent-indigo-500"
                        />
                        <span className="text-[10px] font-mono w-7 text-right">
                          {selectedObject.scale[0].toFixed(1)}x
                        </span>
                      </div>

                      {/* Color Picker Swatch */}
                      <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <input
                          type="color"
                          value={selectedObject.color}
                          onChange={(e) => onUpdateColor(e.target.value)}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-xs text-slate-400">
                <span>Click on any 3D object in the studio or projection zone to select and transform it.</span>
                <button
                  onClick={() => setActiveTab('spawn')}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                >
                  + Add 3D Shape
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Add 3D Shape Spawner */}
        {activeTab === 'spawn' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                {allowedShapes
                  ? 'Puzzle-approved shapes for this challenge:'
                  : 'Select a 3D Primitive or Composite Model to spawn onto the turntable:'}
              </span>
              <span className="text-[11px] text-slate-500">
                {allowedShapes ? 'Restricted to keep the solution fair' : 'Auto-pivoted & shadow casting'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {availableShapes.map((item) => (
                <button
                  key={item.type}
                  onClick={() => {
                    onAddObject(item.type);
                    setActiveTab('transform');
                  }}
                  className="flex flex-col items-start p-2 rounded-xl bg-slate-900/80 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-600/60 transition-all text-left group"
                >
                  <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-400">
                    {item.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Lighting Rig Controls */}
        {activeTab === 'lights' && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">
                {mode === 'multilight'
                  ? 'Multi-Light Color Studio Rig (Red, Green, Blue / Additive Color Shadow Synthesis)'
                  : 'Studio Key Light Configuration'}
              </span>
              <span className="text-[11px] text-slate-500">Real-time WebGPU Shadow Depth Pass</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {lights.map((light, index) => (
                <div
                  key={light.id}
                  className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={light.enabled}
                        onChange={(e) => onUpdateLight(index, { enabled: e.target.checked })}
                        className="rounded accent-indigo-500"
                      />
                      <span className="font-bold text-slate-200">{light.name}</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={light.color}
                        onChange={(e) => onUpdateLight(index, { color: e.target.value })}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                  </div>

                  {/* Intensity */}
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 text-slate-400">Intensity</span>
                    <input
                      type="range"
                      min="0.5"
                      max="5.0"
                      step="0.1"
                      value={light.intensity}
                      onChange={(e) => onUpdateLight(index, { intensity: parseFloat(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                    <span className="w-8 font-mono text-right">{light.intensity.toFixed(1)}</span>
                  </div>

                  {/* Beam Angle / Frustum */}
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 text-slate-400">Beam Angle</span>
                    <input
                      type="range"
                      min="0.3"
                      max="1.2"
                      step="0.05"
                      value={light.angle}
                      onChange={(e) => onUpdateLight(index, { angle: parseFloat(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                    <span className="w-8 font-mono text-right">{light.angle.toFixed(2)}</span>
                  </div>

                  {/* Distance / Z Position */}
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 text-slate-400">Distance</span>
                    <input
                      type="range"
                      min="-9.0"
                      max="-2.0"
                      step="0.5"
                      value={light.position[2]}
                      onChange={(e) =>
                        onUpdateLight(index, {
                          position: [light.position[0], light.position[1], parseFloat(e.target.value)],
                        })
                      }
                      className="w-full accent-indigo-500"
                    />
                    <span className="w-8 font-mono text-right">{light.position[2].toFixed(1)}m</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Camera Perspectives */}
        {activeTab === 'camera' && (
          <div className="space-y-2 text-xs">
            <span className="font-semibold text-slate-300">Preset Camera Transformations & Angles</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => onSetCameraPreset('orbit')}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left"
              >
                <div className="font-bold text-slate-200">Orbit 3/4 View</div>
                <div className="text-[10px] text-slate-500">Isometric perspective to inspect table & wall</div>
              </button>
              <button
                onClick={() => onSetCameraPreset('wall_front')}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left"
              >
                <div className="font-bold text-slate-200">Wall Shadow Front</div>
                <div className="text-[10px] text-slate-500">Perpendicular to the projection backdrop</div>
              </button>
              <button
                onClick={() => onSetCameraPreset('light_pov')}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left"
              >
                <div className="font-bold text-slate-200">Light 1 POV</div>
                <div className="text-[10px] text-slate-500">Inside the spotlight frustum looking down beam</div>
              </button>
              <button
                onClick={() => onSetCameraPreset('top_down')}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left"
              >
                <div className="font-bold text-slate-200">Top-Down Blueprint</div>
                <div className="text-[10px] text-slate-500">Studio layout from above (light, objects, wall)</div>
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Scene Save / Load */}
        {activeTab === 'file' && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-semibold text-slate-200">ShadowArt Scene Serialization</div>
              <div className="text-[11px] text-slate-500">
                Save your 3D sculpture and lighting arrangement as portable JSON or reload a saved scene.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onExportSceneJson}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download Scene (.json)</span>
              </button>

              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer border border-slate-700">
                <FileUp className="w-3.5 h-3.5" />
                <span>Upload Scene</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={onImportSceneJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
