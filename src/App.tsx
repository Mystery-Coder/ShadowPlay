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
  PuzzleScoreResult,
  EnginePerformanceMetrics,
} from './types';
import { ShadowStudioEngine } from './engine/shadow-studio';
import { detectWebGpuSupport } from './engine/webgpu-diagnostic';
import { PUZZLE_LEVELS, cloneLights, cloneObjects } from './engine/puzzles';
import { analyzeShadowMasks, computePuzzleScore, toIoUResult } from './engine/puzzle-scoring';
import { validateShadowShape } from './engine/puzzle-validation';
import { ANAMORPHIC_PRESETS } from './engine/anamorphic';

import { HeaderBar } from './components/HeaderBar';
import { BottomDock } from './components/BottomDock';
import { PuzzleOverlay } from './components/PuzzleOverlay';
import { AnamorphicOverlay } from './components/AnamorphicOverlay';
import { MultiLightOverlay } from './components/MultiLightOverlay';
import { PagpOverlay } from './components/PagpOverlay';
import { GpuDiagnosticModal } from './components/GpuDiagnosticModal';
import { ConceptExplainerModal } from './components/ConceptExplainerModal';
import { WebXrModal } from './components/WebXrModal';

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

// RGB Multi-Light Studio Preset
const RGB_STUDIO_LIGHTS: StudioLight[] = [
  {
    id: 'light-red',
    name: 'Red Spotlight',
    type: 'spot',
    position: [-1.8, 2.6, -5.2],
    targetPosition: [0, 2.0, 6.0],
    color: '#ff2222',
    intensity: 2.5,
    distance: 25,
    angle: 0.75,
    penumbra: 0.25,
    enabled: true,
    castShadow: true,
  },
  {
    id: 'light-green',
    name: 'Green Spotlight',
    type: 'spot',
    position: [0.0, 3.2, -5.5],
    targetPosition: [0, 2.0, 6.0],
    color: '#22ff22',
    intensity: 2.5,
    distance: 25,
    angle: 0.75,
    penumbra: 0.25,
    enabled: true,
    castShadow: true,
  },
  {
    id: 'light-blue',
    name: 'Blue Spotlight',
    type: 'spot',
    position: [1.8, 2.6, -5.2],
    targetPosition: [0, 2.0, 6.0],
    color: '#2266ff',
    intensity: 2.8,
    distance: 25,
    angle: 0.75,
    penumbra: 0.25,
    enabled: true,
    castShadow: true,
  },
];

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ShadowStudioEngine | null>(null);

  // App State
  const [mode, setMode] = useState<AppMode>('sandbox');
  const [gpuStatus, setGpuStatus] = useState<WebGpuStatus | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<EnginePerformanceMetrics | null>(
    null
  );
  const [selectedObject, setSelectedObject] = useState<StudioObject | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [activeCameraPreset, setActiveCameraPreset] = useState<string>('orbit');

  // Scene state
  const [objects, setObjects] = useState<StudioObject[]>(DEFAULT_SANDBOX_OBJECTS);
  const [lights, setLights] = useState<StudioLight[]>(DEFAULT_SANDBOX_LIGHTS);

  // Puzzle state
  const [puzzleLevelIndex, setPuzzleLevelIndex] = useState(0);
  const [currentShadowPixels, setCurrentShadowPixels] = useState<Uint8Array | null>(null);
  const [targetShadowPixels, setTargetShadowPixels] = useState<Uint8Array | null>(null);
  const [iouResult, setIouResult] = useState<IoUResult | null>(null);
  const [puzzleScore, setPuzzleScore] = useState<PuzzleScoreResult | null>(null);
  const [puzzleAttempts, setPuzzleAttempts] = useState(1);
  const [puzzleStartedAt, setPuzzleStartedAt] = useState(() => Date.now());
  const [puzzleSolvedAt, setPuzzleSolvedAt] = useState<number | null>(null);
  const [solutionRevealed, setSolutionRevealed] = useState(false);
  const targetSilhouetteBufferRef = useRef<Uint8Array | null>(null);
  const puzzleLevelRef = useRef(PUZZLE_LEVELS[0]);
  const modeRef = useRef<AppMode>('sandbox');

  // Anamorphic state
  const [anamorphicPresetIndex, setAnamorphicPresetIndex] = useState(0);
  const [anamorphicAccuracy, setAnamorphicAccuracy] = useState(0);

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
        // The engine returns a fresh buffer on every capture.
        setCurrentShadowPixels(pixels);

        // Only evaluate while a puzzle is active and a target mask exists.
        if (modeRef.current !== 'puzzle' || !targetSilhouetteBufferRef.current) return;

        const startedAt = performance.now();
        const level = puzzleLevelRef.current;
        const metrics = analyzeShadowMasks(
          pixels,
          targetSilhouetteBufferRef.current,
          width,
          height
        );
        const validation = validateShadowShape(metrics, level);
        const result = computePuzzleScore(metrics, level, validation);
        const computeTimeMs =
          Math.round((performance.now() - startedAt) * 100) / 100;

        setPuzzleScore(result);
        setIouResult(toIoUResult(result, 'Direct Pixel Reduction', computeTimeMs));
      },
      onAnamorphicAccuracyChange: (acc) => {
        setAnamorphicAccuracy(acc);
      },
      onPerformanceUpdate: (nextMetrics) => {
        if (modeRef.current === 'pagp') setPerformanceMetrics(nextMetrics);
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

  // Keep the engine callback's refs in sync with React state.
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // 3. Keep the level ref in sync and clear stale scoring when leaving puzzles.
  useEffect(() => {
    puzzleLevelRef.current = PUZZLE_LEVELS[puzzleLevelIndex];
    if (mode !== 'puzzle') targetSilhouetteBufferRef.current = null;
    setIouResult(null);
    setPuzzleScore(null);
  }, [mode, puzzleLevelIndex]);

  // 4. Freeze the solve time once the puzzle passes.
  useEffect(() => {
    if (mode === 'puzzle' && puzzleScore?.passed) {
      setPuzzleSolvedAt((previous) => previous ?? Date.now());
    }
  }, [mode, puzzleScore?.passed]);

  /**
   * Loads a puzzle level with a clean scene. Objects and lights are cloned so
   * the engine's in-place transforms can never corrupt the level definition.
   * `resetSession` is false for Reset, which restores only the scene and keeps
   * the running timer, attempt count and solve state unchanged.
   */
  const loadPuzzleLevel = useCallback(
    (index: number, attempts: number = 1, resetSession: boolean = true) => {
      const safeIndex = Math.max(0, Math.min(PUZZLE_LEVELS.length - 1, index));
      const level = PUZZLE_LEVELS[safeIndex];
      const nextObjects = cloneObjects(level.initialObjects);
      const nextLights = cloneLights(level.initialLights);

      modeRef.current = 'puzzle';
      puzzleLevelRef.current = level;

      setPuzzleLevelIndex(safeIndex);
      setObjects(nextObjects);
      setLights(nextLights);
      setSelectedObject(null);
      setCurrentShadowPixels(null);
      setIouResult(null);
      setPuzzleScore(null);
      if (resetSession) {
        setPuzzleAttempts(attempts);
        setPuzzleStartedAt(Date.now());
        setPuzzleSolvedAt(null);
        setSolutionRevealed(false);
      }

      const engine = engineRef.current;
      if (engine) {
        engine.setFlatLightFalloff(true);

        // Derive the ground truth from the engine's own projected shadow of the
        // intended arrangement. This guarantees that every target is achievable
        // and that target/live masks share exactly the same orientation.
        engine.setLights(cloneLights(level.solutionLights));
        engine.setObjects(cloneObjects(level.solutionObjects));
        const targetMask = engine.captureShadowSilhouette();
        targetSilhouetteBufferRef.current = targetMask;
        setTargetShadowPixels(targetMask);

        engine.setLights(nextLights);
        engine.setObjects(nextObjects);
        engine.setCameraPreset('puzzle_overview');
      } else {
        targetSilhouetteBufferRef.current = null;
        setTargetShadowPixels(null);
      }
      setActiveCameraPreset('puzzle_overview');
    },
    []
  );

  // 4. Handle Mode Changes
  const handleSetMode = useCallback(
    (newMode: AppMode) => {
      modeRef.current = newMode;
      setMode(newMode);
      setSelectedObject(null);
      engineRef.current?.setFlatLightFalloff(
        newMode === 'puzzle' || newMode === 'pagp'
      );
      engineRef.current?.setPerformanceMonitoring(newMode === 'pagp');

      if (newMode === 'puzzle') {
        loadPuzzleLevel(puzzleLevelIndex, 1);
        return;
      }

      // Leaving puzzle mode: clear the evaluation state.
      targetSilhouetteBufferRef.current = null;
      setTargetShadowPixels(null);
      setIouResult(null);
      setPuzzleScore(null);
      setCurrentShadowPixels(null);

      const engine = engineRef.current;
      if (!engine) return;

      if (newMode === 'sandbox') {
        engine.setObjects(DEFAULT_SANDBOX_OBJECTS);
        engine.setLights(DEFAULT_SANDBOX_LIGHTS);
        setObjects(DEFAULT_SANDBOX_OBJECTS);
        setLights(DEFAULT_SANDBOX_LIGHTS);
        engine.setCameraPreset('orbit');
        setActiveCameraPreset('orbit');
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
        engine.setObjects(multiObjects);
        engine.setLights(RGB_STUDIO_LIGHTS);
        setObjects(multiObjects);
        setLights(RGB_STUDIO_LIGHTS);
        engine.setCameraPreset('wall_front');
        setActiveCameraPreset('wall_front');
      } else if (newMode === 'pagp') {
        // Keep a representative studio scene, with the puzzle-level key light
        // strength so the projected shadow stays dark and readable. The dock
        // remains available here for adjusting objects and lights.
        const pagpLights = cloneLights(DEFAULT_SANDBOX_LIGHTS).map((light) => ({
          ...light,
          intensity: 4.0,
        }));
        engine.setObjects(DEFAULT_SANDBOX_OBJECTS);
        engine.setLights(pagpLights);
        setObjects(DEFAULT_SANDBOX_OBJECTS);
        setLights(pagpLights);
        engine.setCameraPreset('orbit');
        setActiveCameraPreset('orbit');
      }
    },
    [puzzleLevelIndex, anamorphicPresetIndex, loadPuzzleLevel]
  );

  // Handle puzzle level selection
  const handleSelectPuzzleLevel = useCallback(
    (index: number) => {
      loadPuzzleLevel(index, 1);
    },
    [loadPuzzleLevel]
  );

  const handleResetPuzzle = useCallback(() => {
    loadPuzzleLevel(puzzleLevelIndex, puzzleAttempts, false);
  }, [loadPuzzleLevel, puzzleLevelIndex, puzzleAttempts]);

  const handleRetryPuzzle = useCallback(() => {
    loadPuzzleLevel(puzzleLevelIndex, puzzleAttempts + 1, true);
  }, [loadPuzzleLevel, puzzleLevelIndex, puzzleAttempts]);

  const handleRevealSolution = useCallback(() => {
    setSolutionRevealed(true);
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

    // Puzzle levels only allow shapes that make sense for the challenge.
    if (mode === 'puzzle') {
      const allowed = PUZZLE_LEVELS[puzzleLevelIndex].allowedShapes;
      if (!allowed.includes(shape)) return;
    }

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
    if (preset === 'rgb') {
      const rgb = RGB_STUDIO_LIGHTS;
      setLights(rgb);
      engineRef.current?.setLights(rgb);
    } else if (preset === 'cmy') {
      const cmy: StudioLight[] = [
        {
          id: 'light-cyan',
          name: 'Cyan Light',
          type: 'spot',
          position: [-1.8, 2.6, -5.2],
          targetPosition: [0, 2.0, 6.0],
          color: '#06b6d4',
          intensity: 2.8,
          distance: 25,
          angle: 0.75,
          penumbra: 0.25,
          enabled: true,
          castShadow: true,
        },
        {
          id: 'light-magenta',
          name: 'Magenta Light',
          type: 'spot',
          position: [0.0, 3.2, -5.5],
          targetPosition: [0, 2.0, 6.0],
          color: '#d946ef',
          intensity: 2.8,
          distance: 25,
          angle: 0.75,
          penumbra: 0.25,
          enabled: true,
          castShadow: true,
        },
        {
          id: 'light-yellow',
          name: 'Yellow Light',
          type: 'spot',
          position: [1.8, 2.6, -5.2],
          targetPosition: [0, 2.0, 6.0],
          color: '#eab308',
          intensity: 2.8,
          distance: 25,
          angle: 0.75,
          penumbra: 0.25,
          enabled: true,
          castShadow: true,
        },
      ];
      setLights(cmy);
      engineRef.current?.setLights(cmy);
    } else if (preset === 'sunset') {
      const sunset: StudioLight[] = [
        {
          id: 'light-amber',
          name: 'Amber Glow',
          type: 'spot',
          position: [-2.0, 2.5, -5.0],
          targetPosition: [0, 2.0, 6.0],
          color: '#f59e0b',
          intensity: 3.0,
          distance: 25,
          angle: 0.8,
          penumbra: 0.3,
          enabled: true,
          castShadow: true,
        },
        {
          id: 'light-rose',
          name: 'Rose Backlight',
          type: 'spot',
          position: [2.0, 2.5, -5.0],
          targetPosition: [0, 2.0, 6.0],
          color: '#f43f5e',
          intensity: 2.8,
          distance: 25,
          angle: 0.8,
          penumbra: 0.3,
          enabled: true,
          castShadow: true,
        },
      ];
      setLights(sunset);
      engineRef.current?.setLights(sunset);
    } else {
      setLights(DEFAULT_SANDBOX_LIGHTS);
      engineRef.current?.setLights(DEFAULT_SANDBOX_LIGHTS);
    }
  };

  const handleToggleLight = (index: number) => {
    handleUpdateLight(index, { enabled: !lights[index].enabled });
  };

  // Camera presets
  const handleSetCameraPreset = (
    preset: 'orbit' | 'wall_front' | 'light_pov' | 'top_down' | 'anamorphic_peep' | 'puzzle_overview'
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
    if (mode === 'puzzle') {
      handleResetPuzzle();
      return;
    }
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
          targetShadowPixels={targetShadowPixels}
          resolution={128}
          iouResult={iouResult}
          puzzleScore={puzzleScore}
          attempts={puzzleAttempts}
          startedAt={puzzleStartedAt}
          solvedAt={puzzleSolvedAt}
          solutionRevealed={solutionRevealed}
          onReset={handleResetPuzzle}
          onRetry={handleRetryPuzzle}
          onRevealSolution={handleRevealSolution}
          onNextLevel={() =>
            handleSelectPuzzleLevel(Math.min(PUZZLE_LEVELS.length - 1, puzzleLevelIndex + 1))
          }
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
        <MultiLightOverlay
          lights={lights}
          onApplyColorPreset={handleApplyColorPreset}
          onToggleLight={handleToggleLight}
        />
      )}

      {mode === 'pagp' && (
        <PagpOverlay metrics={performanceMetrics} webGpuStatus={gpuStatus} />
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
        allowedShapes={
          mode === 'puzzle' ? PUZZLE_LEVELS[puzzleLevelIndex].allowedShapes : undefined
        }
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
