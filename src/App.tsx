/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AppMode,
  StudioObject,
  StudioLight,
  ShapeType,
  WebGpuStatus,
  IoUResult,
} from './types';
import { ShadowStudioEngine } from './engine/shadow-studio';
import { detectWebGpuSupport, computeIoUScore } from './engine/webgpu-diagnostic';
import { PUZZLE_LEVELS, drawTargetSilhouette } from './engine/puzzles';
import { ANAMORPHIC_PRESETS } from './engine/anamorphic';
import { applyLightPreset } from './engine/multi-light-presets';
import { RGB_CHALLENGES } from './engine/rgb-challenges';

import { HeaderBar } from './components/HeaderBar';
import { BottomDock } from './components/BottomDock';
import { PuzzleOverlay } from './components/PuzzleOverlay';
import { AnamorphicOverlay } from './components/AnamorphicOverlay';
import { MultiLightOverlay } from './components/MultiLightOverlay';
import { RgbChallengeOverlay } from './components/RgbChallengeOverlay';
import { GpuDiagnosticModal } from './components/GpuDiagnosticModal';
import { ConceptExplainerModal } from './components/ConceptExplainerModal';
import { WebXrModal } from './components/WebXrModal';

/**
 * Responsive placement for the two Multi-Light HUD cards. The overlays keep
 * their own visual styling; this only stacks them on narrow screens and keeps
 * the existing left/right split once both fixed-width cards can fit.
 */
const MULTI_LIGHT_HUD_LAYOUT_CSS = `
  [data-multi-light-hud] > div {
    pointer-events: auto;
  }

  @media (max-width: 767px) {
    [data-multi-light-hud] {
      top: 4rem;
      right: 1rem;
      bottom: 1rem;
      left: 1rem;
      overflow-y: auto;
    }

    [data-multi-light-hud] > div {
      position: relative;
      top: auto;
      right: auto;
      bottom: auto;
      left: auto;
      width: 100%;
      max-width: none;
      max-height: none;
      overflow: visible;
    }

    [data-multi-light-hud] > div + div {
      margin-top: 0.75rem;
    }
  }

  @media (min-width: 768px) {
    [data-multi-light-hud] {
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      overflow: visible;
    }

    [data-multi-light-hud] > div {
      top: 4rem;
      bottom: auto;
      max-height: calc(100vh - 5rem);
      overflow-y: auto;
    }

    [data-multi-light-hud] > div:first-child {
      right: auto;
      left: 1rem;
      width: 21rem;
    }

    [data-multi-light-hud] > div:last-child {
      right: 1rem;
      left: auto;
      width: 20rem;
    }
  }
`;

// Default lights for sandbox mode
const DEFAULT_SANDBOX_LIGHTS: StudioLight[] = [
  {
    id: 'key-light',
    name: 'Spotlight 1 (Key)',
    type: 'spot',
    position: [0, 2.8, -5.5],
    targetPosition: [0, 2.0, 6.0],
    color: '#ffffff',
    intensity: 2.8,
    distance: 25,
    angle: 0.7,
    penumbra: 0.2,
    enabled: true,
    castShadow: true,
  },
];

// Default objects for sandbox mode
const DEFAULT_SANDBOX_OBJECTS: StudioObject[] = [
  {
    id: 'obj-1',
    name: 'Teapot Centerpiece',
    shape: 'teapot',
    position: [0, 0.8, 0],
    rotation: [0, 45, 0],
    scale: [1.2, 1.2, 1.2],
    color: '#f59e0b',
  },
  {
    id: 'obj-2',
    name: 'Pedestal Ring',
    shape: 'ring',
    position: [-0.8, 0.4, -0.6],
    rotation: [0, 0, 30],
    scale: [0.8, 0.8, 0.8],
    color: '#38bdf8',
  },
  {
    id: 'obj-3',
    name: 'Spire Rod',
    shape: 'rod',
    position: [0.9, 0.4, 0.5],
    rotation: [15, 0, -20],
    scale: [0.8, 0.8, 0.8],
    color: '#ec4899',
  },
];

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ShadowStudioEngine | null>(null);

  // App State
  const [mode, setMode] = useState<AppMode>('sandbox');
  const [gpuStatus, setGpuStatus] = useState<WebGpuStatus | null>(null);
  const [selectedObject, setSelectedObject] = useState<StudioObject | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [activeCameraPreset, setActiveCameraPreset] = useState<string>('orbit');

  // Scene state
  const [objects, setObjects] = useState<StudioObject[]>(DEFAULT_SANDBOX_OBJECTS);
  const [lights, setLights] = useState<StudioLight[]>(DEFAULT_SANDBOX_LIGHTS);

  // Puzzle state
  const [puzzleLevelIndex, setPuzzleLevelIndex] = useState(0);
  const [currentShadowPixels, setCurrentShadowPixels] = useState<Uint8Array | null>(null);
  const [iouResult, setIouResult] = useState<IoUResult | null>(null);
  const targetSilhouetteBufferRef = useRef<Uint8ClampedArray | null>(null);

  // Anamorphic state
  const [anamorphicPresetIndex, setAnamorphicPresetIndex] = useState(0);
  const [anamorphicAccuracy, setAnamorphicAccuracy] = useState(0);

  // RGB challenge state
  const [rgbChallengeIndex, setRgbChallengeIndex] = useState(0);

  // Modals
  const [showGpuModal, setShowGpuModal] = useState(false);
  const [showConceptsModal, setShowConceptsModal] = useState(false);
  const [showWebXrModal, setShowWebXrModal] = useState(false);

  // 1. Detect WebGPU on initial load
  useEffect(() => {
    detectWebGpuSupport().then((status) => {
      setGpuStatus(status);
    });
  }, []);

  // 2. Initialize 3D Engine
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const engine = new ShadowStudioEngine(canvasMountRef.current, {
      onSelectObject: (obj) => {
        setSelectedObject(obj);
      },
      onObjectTransformChange: (obj) => {
        setSelectedObject({ ...obj });
        setObjects((prev) => prev.map((o) => (o.id === obj.id ? { ...obj } : o)));
      },
      onSilhouetteUpdate: (pixels, width, height) => {
        setCurrentShadowPixels(pixels);

        // If in puzzle mode, evaluate IoU with target silhouette
        if (targetSilhouetteBufferRef.current) {
          computeIoUScore(pixels, targetSilhouetteBufferRef.current, width, height).then(
            (result) => {
              setIouResult(result);
            }
          );
        }
      },
      onAnamorphicAccuracyChange: (acc) => {
        setAnamorphicAccuracy(acc);
      },
    });

    engineRef.current = engine;
    engine.setObjects(DEFAULT_SANDBOX_OBJECTS);
    engine.setLights(DEFAULT_SANDBOX_LIGHTS);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // 3. Pre-render target silhouette buffer when puzzle level changes
  useEffect(() => {
    if (mode === 'puzzle') {
      const level = PUZZLE_LEVELS[puzzleLevelIndex];
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawTargetSilhouette(ctx, level.id, 128, 128);
        const imgData = ctx.getImageData(0, 0, 128, 128);
        targetSilhouetteBufferRef.current = imgData.data;
      }
    } else {
      targetSilhouetteBufferRef.current = null;
      setIouResult(null);
    }
  }, [mode, puzzleLevelIndex]);

  // 4. Handle Mode Changes
  const handleSetMode = useCallback((newMode: AppMode) => {
    setMode(newMode);
    setSelectedObject(null);
    const engine = engineRef.current;
    if (!engine) return;

    engine.setMultiLightReducedAmbient(newMode === 'multilight');

    if (newMode === 'sandbox') {
      engine.setObjects(DEFAULT_SANDBOX_OBJECTS);
      engine.setLights(DEFAULT_SANDBOX_LIGHTS);
      setObjects(DEFAULT_SANDBOX_OBJECTS);
      setLights(DEFAULT_SANDBOX_LIGHTS);
      engine.setCameraPreset('orbit');
      setActiveCameraPreset('orbit');
    } else if (newMode === 'puzzle') {
      const level = PUZZLE_LEVELS[puzzleLevelIndex];
      engine.setObjects(level.initialObjects);
      engine.setLights(level.initialLights);
      setObjects(level.initialObjects);
      setLights(level.initialLights);
      engine.setCameraPreset('wall_front');
      setActiveCameraPreset('wall_front');
    } else if (newMode === 'illusion') {
      const preset = ANAMORPHIC_PRESETS[anamorphicPresetIndex];
      engine.setObjects(preset.objects);
      engine.setLights(DEFAULT_SANDBOX_LIGHTS);
      setObjects(preset.objects);
      setLights(DEFAULT_SANDBOX_LIGHTS);
      engine.setAnamorphicSweetSpot(preset.sweetSpot.position, preset.sweetSpot.lookAt);
      engine.setCameraPreset('orbit');
      setActiveCameraPreset('orbit');
    } else if (newMode === 'multilight') {
      // 3 overlapping colored lights + interesting sculpture
      const multiObjects: StudioObject[] = [
        {
          id: 'ml-teapot',
          name: 'Central Teapot',
          shape: 'teapot',
          position: [0, 0.8, 0],
          rotation: [0, 45, 0],
          scale: [1.2, 1.2, 1.2],
          color: '#ffffff',
        },
        {
          id: 'ml-arch',
          name: 'Arch Gate',
          shape: 'arch',
          position: [0, 0.4, 0.9],
          rotation: [0, 0, 0],
          scale: [0.9, 0.9, 0.9],
          color: '#ffffff',
        },
      ];
      const multiLights = applyLightPreset('rgb');
      engine.setObjects(multiObjects);
      engine.setLights(multiLights);
      setObjects(multiObjects);
      setLights(multiLights);
      engine.setCameraPreset('wall_front');
      setActiveCameraPreset('wall_front');
    }
  }, [puzzleLevelIndex, anamorphicPresetIndex]);

  // Handle puzzle level selection
  const handleSelectPuzzleLevel = useCallback((index: number) => {
    setPuzzleLevelIndex(index);
    const level = PUZZLE_LEVELS[index];
    if (engineRef.current) {
      engineRef.current.setObjects(level.initialObjects);
      engineRef.current.setLights(level.initialLights);
      setObjects(level.initialObjects);
      setLights(level.initialLights);
      setSelectedObject(null);
    }
  }, []);

  // Handle anamorphic preset selection
  const handleSelectAnamorphicPreset = useCallback((preset: typeof ANAMORPHIC_PRESETS[0]) => {
    const idx = ANAMORPHIC_PRESETS.findIndex((p) => p.id === preset.id);
    if (idx !== -1) setAnamorphicPresetIndex(idx);
    if (engineRef.current) {
      engineRef.current.setObjects(preset.objects);
      setObjects(preset.objects);
      engineRef.current.setAnamorphicSweetSpot(preset.sweetSpot.position, preset.sweetSpot.lookAt);
      setSelectedObject(null);
    }
  }, []);

  // Object transformation actions
  const handleUpdateTransform = (
    pos?: [number, number, number],
    rot?: [number, number, number],
    scl?: [number, number, number]
  ) => {
    if (!selectedObject || !engineRef.current) return;
    engineRef.current.updateObjectTransform(selectedObject.id, pos, rot, scl);
    setSelectedObject((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        position: pos || prev.position,
        rotation: rot || prev.rotation,
        scale: scl || prev.scale,
      };
    });
  };

  const handleUpdateColor = (color: string) => {
    if (!selectedObject || !engineRef.current) return;
    engineRef.current.updateObjectColor(selectedObject.id, color);
    setSelectedObject((prev) => (prev ? { ...prev, color } : null));
  };

  const handleDeleteObject = () => {
    if (!selectedObject || !engineRef.current) return;
    engineRef.current.removeObject(selectedObject.id);
    setObjects((prev) => prev.filter((o) => o.id !== selectedObject.id));
    setSelectedObject(null);
  };

  const handleDuplicateObject = () => {
    if (!selectedObject || !engineRef.current) return;
    const cloned: StudioObject = {
      ...selectedObject,
      id: `obj-${Date.now()}`,
      name: `${selectedObject.name} (Copy)`,
      position: [
        selectedObject.position[0] + 0.3,
        selectedObject.position[1],
        selectedObject.position[2] + 0.3,
      ],
    };
    engineRef.current.addObject(cloned, true);
    setObjects((prev) => [...prev, cloned]);
    setSelectedObject(cloned);
  };

  const handleAddObject = (shape: ShapeType) => {
    if (!engineRef.current) return;
    const newObj: StudioObject = {
      id: `obj-${Date.now()}`,
      name: `New ${shape.charAt(0).toUpperCase() + shape.slice(1)}`,
      shape,
      position: [(Math.random() - 0.5) * 1.5, 0.6, (Math.random() - 0.5) * 1.5],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#e2e8f0',
    };
    engineRef.current.addObject(newObj, true);
    setObjects((prev) => [...prev, newObj]);
    setSelectedObject(newObj);
  };

  // Lighting adjustments
  const handleUpdateLight = (index: number, partial: Partial<StudioLight>) => {
    setLights((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...partial };
      if (engineRef.current) {
        engineRef.current.addOrUpdateLight(updated[index]);
      }
      return updated;
    });
  };

  const handleApplyColorPreset = (preset: 'rgb' | 'cmy' | 'sunset' | 'mono') => {
    const presetLights = applyLightPreset(preset);
    setLights(presetLights);
    engineRef.current?.setLights(presetLights);
  };

  const handleToggleLight = (index: number) => {
    handleUpdateLight(index, { enabled: !lights[index].enabled });
  };

  // Camera presets
  const handleSetCameraPreset = (
    preset: 'orbit' | 'wall_front' | 'light_pov' | 'top_down' | 'anamorphic_peep'
  ) => {
    setActiveCameraPreset(preset);
    engineRef.current?.setCameraPreset(preset);
  };

  // Snapshot & JSON Export / Import
  const handleCaptureSnapshot = () => {
    if (!engineRef.current) return;
    const dataUrl = engineRef.current.captureSnapshot();
    const link = document.createElement('a');
    link.download = `ShadowPlay-${mode}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleExportSceneJson = () => {
    const sceneData = {
      name: 'ShadowPlay Composition',
      createdAt: new Date().toISOString(),
      mode,
      objects,
      lights,
    };
    const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `shadowplay-scene-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSceneJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.objects && parsed.lights && engineRef.current) {
          engineRef.current.setObjects(parsed.objects);
          engineRef.current.setLights(parsed.lights);
          setObjects(parsed.objects);
          setLights(parsed.lights);
          setSelectedObject(null);
        }
      } catch (err) {
        alert('Invalid ShadowPlay scene JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetScene = () => {
    handleSetMode(mode);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 't' || e.key === 'T') {
        setTransformMode('translate');
        engineRef.current?.setTransformMode('translate');
      } else if (e.key === 'r' || e.key === 'R') {
        setTransformMode('rotate');
        engineRef.current?.setTransformMode('rotate');
      } else if (e.key === 's' || e.key === 'S') {
        setTransformMode('scale');
        engineRef.current?.setTransformMode('scale');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObject) {
          handleDeleteObject();
        }
      } else if (e.key === 'Escape') {
        engineRef.current?.selectObject(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObject]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D Canvas Mount Point */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing outline-none"
      />

      {/* Header Bar */}
      <HeaderBar
        mode={mode}
        onSetMode={handleSetMode}
        gpuStatus={gpuStatus}
        onOpenGpuModal={() => setShowGpuModal(true)}
        onOpenConceptsModal={() => setShowConceptsModal(true)}
        onOpenWebXrModal={() => setShowWebXrModal(true)}
        onResetScene={handleResetScene}
        onCaptureSnapshot={handleCaptureSnapshot}
      />

      {/* Mode-Specific Floating HUD Overlays */}
      {mode === 'puzzle' && (
        <PuzzleOverlay
          level={PUZZLE_LEVELS[puzzleLevelIndex]}
          levelIndex={puzzleLevelIndex}
          totalLevels={PUZZLE_LEVELS.length}
          onSelectLevel={handleSelectPuzzleLevel}
          currentShadowPixels={currentShadowPixels}
          resolution={128}
          iouResult={iouResult}
          onNextLevel={() => handleSelectPuzzleLevel(Math.min(PUZZLE_LEVELS.length - 1, puzzleLevelIndex + 1))}
        />
      )}

      {mode === 'illusion' && (
        <AnamorphicOverlay
          presets={ANAMORPHIC_PRESETS}
          activePreset={ANAMORPHIC_PRESETS[anamorphicPresetIndex]}
          onSelectPreset={handleSelectAnamorphicPreset}
          accuracy={anamorphicAccuracy}
          onLockPeepHole={() => handleSetCameraPreset('anamorphic_peep')}
          onFreeOrbit={() => handleSetCameraPreset('orbit')}
        />
      )}

      {mode === 'multilight' && (
        <>
          <style>{MULTI_LIGHT_HUD_LAYOUT_CSS}</style>
          <div className="pointer-events-none absolute z-20" data-multi-light-hud="">
            <MultiLightOverlay
              lights={lights}
              onApplyColorPreset={handleApplyColorPreset}
              onToggleLight={handleToggleLight}
              onUpdateLight={handleUpdateLight}
            />
            <RgbChallengeOverlay
              lights={lights}
              challenges={RGB_CHALLENGES}
              currentChallenge={RGB_CHALLENGES[rgbChallengeIndex] ?? RGB_CHALLENGES[0]}
              onChallengeChange={(_, index) => setRgbChallengeIndex(index)}
            />
          </div>
        </>
      )}

      {/* Bottom Collapsible Control Dock */}
      <BottomDock
        mode={mode}
        selectedObject={selectedObject}
        transformMode={transformMode}
        onSetTransformMode={(m) => {
          setTransformMode(m);
          engineRef.current?.setTransformMode(m);
        }}
        onUpdateTransform={handleUpdateTransform}
        onUpdateColor={handleUpdateColor}
        onDeleteObject={handleDeleteObject}
        onDuplicateObject={handleDuplicateObject}
        onAddObject={handleAddObject}
        lights={lights}
        onUpdateLight={handleUpdateLight}
        onSetCameraPreset={handleSetCameraPreset}
        onExportSceneJson={handleExportSceneJson}
        onImportSceneJson={handleImportSceneJson}
        activeCameraPreset={activeCameraPreset}
      />

      {/* Modals */}
      {showGpuModal && (
        <GpuDiagnosticModal
          status={gpuStatus}
          iouResult={iouResult}
          onClose={() => setShowGpuModal(false)}
        />
      )}

      {showConceptsModal && (
        <ConceptExplainerModal onClose={() => setShowConceptsModal(false)} />
      )}

      {showWebXrModal && (
        <WebXrModal onClose={() => setShowWebXrModal(false)} />
      )}
    </div>
  );
}
