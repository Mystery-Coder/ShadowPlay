/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PAGP benchmark harness for ShadowPlay.
 *
 * A: core performance is measured by ShadowStudioEngine's render telemetry.
 * B: this module benchmarks sequential CPU IoU against a WGSL compute-shader
 *    IoU, including workgroup-size and workload-resolution variation.
 * E: it compares CPU/GPU scores, checks repeated GPU results, and counts
 *    validation errors and device loss.
 */

import { IoUBenchmarkResult, PagpBenchmarkSummary } from '../types';

const WORKGROUP_SIZES = [64, 128, 256];
const RESOLUTIONS = [256, 512, 1024];
const CONSISTENCY_REPEATS = 4;

const GPU_USAGE = (globalThis as any).GPUBufferUsage || {
  MAP_READ: 0x0001,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  QUERY_RESOLVE: 0x0200,
};
const GPU_MAP_MODE = (globalThis as any).GPUMapMode || { READ: 0x0001 };

interface PagpDevice {
  device: any;
  adapterName: string;
  timestampQueries: boolean;
  validationErrors: number;
  deviceLost: boolean;
}

interface GpuRun {
  score: number;
  intersectionCount: number;
  unionCount: number;
  gpuTimeMs: number | null;
  wallTimeMs: number;
  usedTimestamps: boolean;
}

interface CpuRun {
  score: number;
  intersectionCount: number;
  unionCount: number;
  timeMs: number;
}

let cachedDevice: Promise<PagpDevice | null> | null = null;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function getDevice(): Promise<PagpDevice | null> {
  if (cachedDevice) return cachedDevice;

  cachedDevice = (async () => {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (!nav?.gpu) return null;

    try {
      const adapter = await nav.gpu.requestAdapter();
      if (!adapter) return null;

      const timestampQueries = Boolean(adapter.features?.has?.('timestamp-query'));
      const device = await adapter.requestDevice({
        requiredFeatures: timestampQueries ? ['timestamp-query'] : [],
      });

      const pagpDevice: PagpDevice = {
        device,
        adapterName: 'WebGPU Compatible Adapter',
        timestampQueries,
        validationErrors: 0,
        deviceLost: false,
      };

      device.addEventListener?.('uncapturederror', () => {
        pagpDevice.validationErrors += 1;
      });
      device.lost?.then(() => {
        pagpDevice.deviceLost = true;
      });

      let info: any = {};
      try {
        info = (await adapter.requestAdapterInfo?.()) || {};
      } catch {
        // Adapter info is optional; the adapter name is not critical to metrics.
      }
      pagpDevice.adapterName =
        info.description || info.vendor || adapter.name || 'WebGPU Compatible Adapter';

      return pagpDevice;
    } catch {
      return null;
    }
  })();

  return cachedDevice;
}

/** Deterministic synthetic masks: overlapping circle and rectangle. */
function createWorkload(resolution: number): { current: Float32Array; target: Float32Array } {
  const current = new Float32Array(resolution * resolution);
  const target = new Float32Array(resolution * resolution);
  const centre = resolution / 2;
  const radius = resolution * 0.28;

  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const index = y * resolution + x;
      const dx = x - centre;
      const dy = y - centre;
      const insideCircle = dx * dx + dy * dy < radius * radius;
      const insideRectangle =
        Math.abs(x - resolution * 0.62) < resolution * 0.24 &&
        Math.abs(y - resolution * 0.43) < resolution * 0.32;
      current[index] = insideCircle ? 1 : 0;
      target[index] = insideRectangle ? 1 : 0;
    }
  }

  return { current, target };
}

function computeCpuIoU(current: Float32Array, target: Float32Array): CpuRun {
  const started = performance.now();
  let intersection = 0;
  let union = 0;

  for (let i = 0; i < current.length; i++) {
    const a = current[i] > 0.5;
    const b = target[i] > 0.5;
    if (a && b) intersection++;
    if (a || b) union++;
  }

  return {
    score: union === 0 ? 0 : round((intersection / union) * 100, 3),
    intersectionCount: intersection,
    unionCount: union,
    timeMs: round(performance.now() - started, 3),
  };
}

function buildShader(workgroupSize: number): string {
  return /* wgsl */ `
struct Params {
  width: u32,
  height: u32,
  threshold: f32,
  padding: f32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> currentMask: array<f32>;
@group(0) @binding(2) var<storage, read> targetMask: array<f32>;
@group(0) @binding(3) var<storage, read_write> counters: array<atomic<u32>, 4>;

var<workgroup> localCounters: array<atomic<u32>, 4>;

@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) globalId: vec3<u32>,
  @builtin(local_invocation_index) localIndex: u32
) {
  if (localIndex == 0u) {
    for (var i = 0u; i < 4u; i = i + 1u) {
      atomicStore(&localCounters[i], 0u);
    }
  }
  workgroupBarrier();

  let index = globalId.x;
  if (index < params.width * params.height) {
    let isCurrent = currentMask[index] > params.threshold;
    let isTarget = targetMask[index] > params.threshold;

    if (isCurrent && isTarget) { atomicAdd(&localCounters[0], 1u); }
    if (isCurrent || isTarget) { atomicAdd(&localCounters[1], 1u); }
    if (isCurrent) { atomicAdd(&localCounters[2], 1u); }
    if (isTarget) { atomicAdd(&localCounters[3], 1u); }
  }

  workgroupBarrier();
  if (localIndex == 0u) {
    for (var i = 0u; i < 4u; i = i + 1u) {
      let partial = atomicLoad(&localCounters[i]);
      if (partial > 0u) { atomicAdd(&counters[i], partial); }
    }
  }
}
`;
}

async function runGpuIoU(
  pagpDevice: PagpDevice,
  current: Float32Array,
  target: Float32Array,
  width: number,
  height: number,
  workgroupSize: number,
  preferTimestamps: boolean
): Promise<GpuRun> {
  const { device, timestampQueries } = pagpDevice;
  const useTimestamps = preferTimestamps && timestampQueries;
  const total = width * height;

  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPU_USAGE.UNIFORM | GPU_USAGE.COPY_DST,
  });
  const currentBuffer = device.createBuffer({
    size: current.byteLength,
    usage: GPU_USAGE.STORAGE | GPU_USAGE.COPY_DST,
  });
  const targetBuffer = device.createBuffer({
    size: target.byteLength,
    usage: GPU_USAGE.STORAGE | GPU_USAGE.COPY_DST,
  });
  const counterBuffer = device.createBuffer({
    size: 16,
    usage: GPU_USAGE.STORAGE | GPU_USAGE.COPY_SRC | GPU_USAGE.COPY_DST,
  });
  const counterReadBuffer = device.createBuffer({
    size: 16,
    usage: GPU_USAGE.COPY_DST | GPU_USAGE.MAP_READ,
  });

  const uniformData = new ArrayBuffer(16);
  const u32 = new Uint32Array(uniformData);
  const f32 = new Float32Array(uniformData);
  u32[0] = width;
  u32[1] = height;
  f32[2] = 0.5;

  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  device.queue.writeBuffer(currentBuffer, 0, current);
  device.queue.writeBuffer(targetBuffer, 0, target);
  device.queue.writeBuffer(counterBuffer, 0, new Uint32Array(4));

  let querySet: any = null;
  let timestampResolveBuffer: any = null;
  let timestampReadBuffer: any = null;
  if (useTimestamps) {
    querySet = device.createQuerySet({ type: 'timestamp', count: 2 });
    timestampResolveBuffer = device.createBuffer({
      size: 16,
      usage: GPU_USAGE.QUERY_RESOLVE | GPU_USAGE.COPY_SRC,
    });
    timestampReadBuffer = device.createBuffer({
      size: 16,
      usage: GPU_USAGE.COPY_DST | GPU_USAGE.MAP_READ,
    });
  }

  try {
    const module = device.createShaderModule({ code: buildShader(workgroupSize) });
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: currentBuffer } },
        { binding: 2, resource: { buffer: targetBuffer } },
        { binding: 3, resource: { buffer: counterBuffer } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass(
      querySet
        ? {
            timestampWrites: {
              querySet,
              beginningOfPassWriteIndex: 0,
              endOfPassWriteIndex: 1,
            },
          }
        : undefined
    );
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(total / workgroupSize));
    pass.end();

    encoder.copyBufferToBuffer(counterBuffer, 0, counterReadBuffer, 0, 16);
    if (querySet && timestampResolveBuffer && timestampReadBuffer) {
      encoder.resolveQuerySet(querySet, 0, 2, timestampResolveBuffer, 0);
      encoder.copyBufferToBuffer(timestampResolveBuffer, 0, timestampReadBuffer, 0, 16);
    }

    // Wall time is retained only as an explicit fallback; it measures submit
    // plus readback, not the individual compute-shader execution time.
    const wallStart = performance.now();
    device.queue.submit([encoder.finish()]);
    await counterReadBuffer.mapAsync(GPU_MAP_MODE.READ);

    let timestamps: BigUint64Array | null = null;
    if (timestampReadBuffer) {
      await timestampReadBuffer.mapAsync(GPU_MAP_MODE.READ);
      timestamps = new BigUint64Array(timestampReadBuffer.getMappedRange().slice(0));
      timestampReadBuffer.unmap();
    }

    const counters = new Uint32Array(counterReadBuffer.getMappedRange().slice(0));
    counterReadBuffer.unmap();
    const wallTimeMs = round(performance.now() - wallStart, 3);

    let gpuTimeMs: number | null = null;
    if (timestamps && timestamps[1] >= timestamps[0]) {
      gpuTimeMs = round(Number(timestamps[1] - timestamps[0]) / 1_000_000, 3);
    }

    return {
      score: counters[1] === 0 ? 0 : round((counters[0] / counters[1]) * 100, 3),
      intersectionCount: counters[0],
      unionCount: counters[1],
      gpuTimeMs,
      wallTimeMs,
      usedTimestamps: gpuTimeMs !== null,
    };
  } finally {
    uniformBuffer.destroy();
    currentBuffer.destroy();
    targetBuffer.destroy();
    counterBuffer.destroy();
    counterReadBuffer.destroy();
    querySet?.destroy?.();
    timestampResolveBuffer?.destroy?.();
    timestampReadBuffer?.destroy?.();
  }
}

function baseResult(
  resolution: number,
  workgroupSize: number,
  cpu: CpuRun
): IoUBenchmarkResult {
  return {
    resolution,
    workgroupSize,
    pixels: resolution * resolution,
    cpuTimeMs: cpu.timeMs,
    gpuTimeMs: null,
    gpuWallTimeMs: 0,
    gpuTimingSource: 'submit + readback fallback',
    speedup: null,
    throughputMegapixelsPerSecond: null,
    workgroups: Math.ceil(resolution * resolution / workgroupSize),
    workgroupUtilization: round(
      (resolution * resolution) /
        (Math.ceil(resolution * resolution / workgroupSize) * workgroupSize) *
        100,
      2
    ),
    effectiveBandwidthGbps: null,
    maskTrafficMb: round((resolution * resolution * 8) / 1_000_000, 2),
    launchOverheadMs: null,
    atomicOperations: resolution * resolution * 4 + Math.ceil(resolution * resolution / workgroupSize) * 4,
    cpuScore: cpu.score,
    gpuScore: null,
    absoluteError: null,
    intersectionCount: cpu.intersectionCount,
    unionCount: cpu.unionCount,
    error: null,
  };
}

/** Timestamp queries are optional; fall back to wall time if they fail. */
async function runGpuWithFallback(
  pagpDevice: PagpDevice,
  current: Float32Array,
  target: Float32Array,
  resolution: number,
  workgroupSize: number
): Promise<{ run: GpuRun; timestampFallback: boolean }> {
  try {
    const run = await runGpuIoU(
      pagpDevice,
      current,
      target,
      resolution,
      resolution,
      workgroupSize,
      true
    );
    if (pagpDevice.timestampQueries && run.gpuTimeMs === null) {
      return {
        run: await runGpuIoU(
          pagpDevice,
          current,
          target,
          resolution,
          resolution,
          workgroupSize,
          false
        ),
        timestampFallback: true,
      };
    }
    return { run, timestampFallback: false };
  } catch (error) {
    if (!pagpDevice.timestampQueries) throw error;
    return {
      run: await runGpuIoU(
        pagpDevice,
        current,
        target,
        resolution,
        resolution,
        workgroupSize,
        false
      ),
      timestampFallback: true,
    };
  }
}

/** Runs the A/B/E benchmark matrix used by the PAGP dashboard. */
export async function runPagpBenchmark(): Promise<PagpBenchmarkSummary> {
  const pagpDevice = await getDevice();
  const validationBefore = pagpDevice?.validationErrors ?? 0;
  const lossBefore = pagpDevice?.deviceLost ? 1 : 0;
  const results: IoUBenchmarkResult[] = [];

  for (const resolution of RESOLUTIONS) {
    const { current, target } = createWorkload(resolution);
    const cpu = computeCpuIoU(current, target);

    for (const workgroupSize of WORKGROUP_SIZES) {
      const result = baseResult(resolution, workgroupSize, cpu);
      if (!pagpDevice) {
        result.error = 'WebGPU unavailable — CPU fallback only';
        results.push(result);
        continue;
      }

      try {
        const { run: gpu, timestampFallback } = await runGpuWithFallback(
          pagpDevice,
          current,
          target,
          resolution,
          workgroupSize
        );
        if (timestampFallback) {
          result.error =
            'Timestamp query unavailable; submit + readback time shown instead of shader time';
        }

        result.gpuTimeMs = gpu.gpuTimeMs;
        result.gpuWallTimeMs = gpu.wallTimeMs;
        result.gpuTimingSource = gpu.usedTimestamps
          ? 'WebGPU timestamp query'
          : 'submit + readback fallback';
        result.gpuScore = gpu.score;
        result.absoluteError = round(Math.abs(cpu.score - gpu.score), 3);
        result.intersectionCount = gpu.intersectionCount;
        result.unionCount = gpu.unionCount;

        // Speedup is a shader comparison, so it needs a real timestamp query.
        // Throughput is reported from whichever timing source is displayed.
        if (gpu.gpuTimeMs && gpu.gpuTimeMs > 0) {
          result.speedup = round(cpu.timeMs / gpu.gpuTimeMs, 2);
        }
        const timingMs = gpu.gpuTimeMs ?? gpu.wallTimeMs;
        if (timingMs > 0) {
          result.throughputMegapixelsPerSecond = round(
            result.pixels / timingMs / 1000,
            2
          );
        }
        // Two f32 masks are read per pixel: 8 bytes of mask traffic per pixel.
        // Bandwidth is a shader metric, so it requires a timestamp query.
        if (gpu.gpuTimeMs && gpu.gpuTimeMs > 0) {
          result.effectiveBandwidthGbps = round(
            (result.pixels * 8) / gpu.gpuTimeMs / 1_000_000,
            2
          );
          result.launchOverheadMs = round(
            Math.max(0, gpu.wallTimeMs - gpu.gpuTimeMs),
            2
          );
        }
      } catch (error: any) {
        result.error = error?.message || 'GPU benchmark failed';
      }
      results.push(result);
    }
  }

  // E: repeat the reference workload and verify that every dispatch returns
  // the same score, intersection, and union counts.
  let consistencySamples = 0;
  let consistentSamples = 0;
  if (pagpDevice) {
    const { current, target } = createWorkload(512);
    const reference = results.find(
      (item) => item.resolution === 512 && item.workgroupSize === 128 && item.gpuScore !== null
    );

    if (reference) {
      const referenceKey = `${reference.gpuScore}:${reference.intersectionCount}:${reference.unionCount}`;
      for (let repeat = 0; repeat < CONSISTENCY_REPEATS; repeat++) {
        consistencySamples += 1;
        try {
          const { run: gpu } = await runGpuWithFallback(
            pagpDevice,
            current,
            target,
            512,
            128
          );
          if (
            `${gpu.score}:${gpu.intersectionCount}:${gpu.unionCount}` === referenceKey
          ) {
            consistentSamples += 1;
          }
        } catch {
          // A failed repeat is itself an inconsistent result and is also
          // reflected in the GPU execution failure cards.
        }
      }
      if (consistentSamples !== consistencySamples) {
        reference.error = 'Repeated GPU executions disagreed';
      }
    }
  }

  return {
    supported: Boolean(pagpDevice),
    timestampQueries: Boolean(pagpDevice?.timestampQueries),
    adapterName:
      pagpDevice?.adapterName ?? 'WebGPU unavailable (CPU reduction fallback)',
    results,
    validationErrors: Math.max(
      0,
      (pagpDevice?.validationErrors ?? 0) - validationBefore
    ),
    deviceLosses: Math.max(0, (pagpDevice?.deviceLost ? 1 : 0) - lossBefore),
    consistencySamples,
    consistentSamples,
    gpuDispatches: pagpDevice ? consistencySamples + results.length : 0,
    ranAt: Date.now(),
  };
}
