/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppMode = 'sandbox' | 'puzzle' | 'illusion' | 'multilight' | 'pagp';

/** Live renderer telemetry emitted by ShadowStudioEngine. */
export interface EnginePerformanceMetrics {
  fps: number;
  frameTimeMs: number;
  frameTimeAvgMs: number;
  frameTimeMinMs: number;
  frameTimeMaxMs: number;
  frameTimeP95Ms: number;
  cpuTimeMs: number;
  gpuRenderTimeMs: number | null;
  gpuTimingSource: 'WebGL2 timer query' | 'CPU fallback (no timer query)';
  shadowTimeMs: number;
  captureTimeMs: number;
  drawCalls: number;
  triangles: number;
  sampleCount: number;
  timestamp: number;
}

/** Result of one CPU/WebGPU IoU benchmark workload. */
export interface IoUBenchmarkResult {
  resolution: number;
  workgroupSize: number;
  pixels: number;
  cpuTimeMs: number;
  gpuTimeMs: number | null;
  gpuWallTimeMs: number;
  gpuTimingSource: 'WebGPU timestamp query' | 'submit + readback fallback';
  speedup: number | null;
  throughputMegapixelsPerSecond: number | null;
  workgroups: number;
  workgroupUtilization: number;
  effectiveBandwidthGbps: number | null;
  maskTrafficMb: number;
  launchOverheadMs: number | null;
  atomicOperations: number;
  cpuScore: number;
  gpuScore: number | null;
  absoluteError: number | null;
  intersectionCount: number;
  unionCount: number;
  error: string | null;
}

export interface PagpBenchmarkSummary {
  supported: boolean;
  timestampQueries: boolean;
  adapterName: string;
  results: IoUBenchmarkResult[];
  validationErrors: number;
  deviceLosses: number;
  consistencySamples: number;
  consistentSamples: number;
  gpuDispatches: number;
  ranAt: number;
}

export type ShapeType =
  | 'cube'
  | 'sphere'
  | 'cylinder'
  | 'rod'
  | 'ring'
  | 'cone'
  | 'teapot'
  | 'bird'
  | 'chair'
  | 'key'
  | 'arch'
  | 'spiral';

export interface StudioObject {
  id: string;
  name: string;
  shape: ShapeType;
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles in degrees
  scale: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  locked?: boolean;
}

export interface StudioLight {
  id: string;
  name: string;
  type: 'spot' | 'point' | 'directional';
  position: [number, number, number];
  targetPosition: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
  angle: number; // for spotlight in radians or degrees
  penumbra: number; // soft shadow factor
  enabled: boolean;
  castShadow: boolean;
}

export interface PuzzleLevel {
  id: number;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Master';
  description: string;
  hint: string;
  /** Optional progressive hints. The first entry is normally the same as `hint`. */
  hints?: string[];
  targetSilhouetteSvg?: string; // fallback SVG representation
  /** Inline data-URI of the target silhouette (black on transparent). */
  targetImage: string;
  initialObjects: StudioObject[];
  initialLights: StudioLight[];
  /** Exact arrangement whose projected shadow is the level's target. */
  solutionObjects: StudioObject[];
  solutionLights: StudioLight[];
  /** Shapes the player is allowed to spawn while solving this level. */
  allowedShapes: ShapeType[];
  targetThreshold: number; // e.g. 78% IoU to pass
  solutionNote: string;
  /** Optional par time shown in the HUD. */
  timerSeconds?: number;
  // Optional per-level shape-validation overrides. Defaults live in puzzle-validation.ts.
  minPrecision?: number;
  minRecall?: number;
  minStructure?: number;
  maxCentroidDistance?: number;
  maxAspectError?: number;
  minCoverage?: number;
  maxCoverage?: number;
}

export type ScoreState =
  | 'idle'
  | 'empty'
  | 'invalid'
  | 'forming'
  | 'close'
  | 'near-solve'
  | 'solved';

export interface SilhouetteBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  aspect: number;
}

export interface SilhouetteMetrics {
  width: number;
  height: number;
  intersectionCount: number;
  unionCount: number;
  currentCount: number;
  targetCount: number;
  /** Intersection over union, 0..100. */
  iou: number;
  /** 0..1 */
  precision: number;
  /** 0..1 */
  recall: number;
  /** 0..1 */
  f1: number;
  /** currentCount / targetCount */
  coverage: number;
  /** 0..1, distance between centroids normalised by the image diagonal. */
  centroidDistance: number;
  /** 0..1, relative difference between the current and target bounding-box aspect ratios. */
  aspectError: number;
  /** 0..1, cosine similarity of the occupancy grids (shape agreement, not just area). */
  structureScore: number;
}

export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface ShapeValidationIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
}

export interface ShapeValidationResult {
  valid: boolean;
  /** 0..100 shape-quality score. */
  score: number;
  issues: ShapeValidationIssue[];
}

export interface PuzzleScoreResult {
  /** Final score after shape validation, 0..100. */
  score: number;
  rawIoU: number;
  state: ScoreState;
  passed: boolean;
  validation: ShapeValidationResult;
  metrics: SilhouetteMetrics;
}

export interface AnamorphicPreset {
  id: string;
  name: string;
  description: string;
  sweetSpot: {
    position: [number, number, number];
    lookAt: [number, number, number];
    fov: number;
  };
  objects: StudioObject[];
  revealColor: string;
}

export interface WebGpuStatus {
  supported: boolean;
  adapterName: string;
  deviceVendor: string;
  maxTextureDimension2D: number;
  computeEnabled: boolean;
  timestampQueries?: boolean;
  fallbackReason?: string;
  executionMode: 'WebGPU Native (WGSL)' | 'WebGL2 Fallback + GPU Emulation';
}

export interface IoUResult {
  score: number; // 0 to 100
  intersectionCount: number;
  unionCount: number;
  targetCount: number;
  currentCount: number;
  method: 'WGSL Compute' | 'Direct Pixel Reduction';
  computeTimeMs: number;
  rawIou?: number;
}
