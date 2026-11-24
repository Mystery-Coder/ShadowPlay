/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebGpuStatus, IoUResult } from '../types';

export const WGSL_IOU_COMPUTE_CODE = /* wgsl */ `
// WGSL Compute Shader for Parallel Silhouette IoU (Intersection over Union) Reduction
struct SilhouetteData {
  width: u32,
  height: u32,
  threshold: f32,
  padding: f32,
};

@group(0) @binding(0) var<uniform> params: SilhouetteData;
@group(0) @binding(1) var<storage, read> currentShadow: array<f32>;
@group(0) @binding(2) var<storage, read> targetSilhouette: array<f32>;
@group(0) @binding(3) var<storage, read_write> atomicCounters: array<atomic<u32>, 4>;
// atomicCounters[0] = intersection
// atomicCounters[1] = union
// atomicCounters[2] = currentShadowCount
// atomicCounters[3] = targetSilhouetteCount

var<workgroup> localIntersection: atomic<u32>;
var<workgroup> localUnion: atomic<u32>;
var<workgroup> localCurrent: atomic<u32>;
var<workgroup> localTarget: atomic<u32>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>,
        @builtin(local_invocation_index) local_index: u32) {
  if (local_index == 0u) {
    atomicStore(&localIntersection, 0u);
    atomicStore(&localUnion, 0u);
    atomicStore(&localCurrent, 0u);
    atomicStore(&localTarget, 0u);
  }
  workgroupBarrier();

  let x = global_id.x;
  let y = global_id.y;

  if (x < params.width && y < params.height) {
    let index = y * params.width + x;
    let isCurrent = currentShadow[index] > params.threshold;
    let isTarget = targetSilhouette[index] > params.threshold;

    if (isCurrent && isTarget) {
      atomicAdd(&localIntersection, 1u);
    }
    if (isCurrent || isTarget) {
      atomicAdd(&localUnion, 1u);
    }
    if (isCurrent) {
      atomicAdd(&localCurrent, 1u);
    }
    if (isTarget) {
      atomicAdd(&localTarget, 1u);
    }
  }

  workgroupBarrier();

  if (local_index == 0u) {
    let inter = atomicLoad(&localIntersection);
    let uni = atomicLoad(&localUnion);
    let cur = atomicLoad(&localCurrent);
    let tar = atomicLoad(&localTarget);

    if (inter > 0u) { atomicAdd(&atomicCounters[0], inter); }
    if (uni > 0u) { atomicAdd(&atomicCounters[1], uni); }
    if (cur > 0u) { atomicAdd(&atomicCounters[2], cur); }
    if (tar > 0u) { atomicAdd(&atomicCounters[3], tar); }
  }
}
`;

let cachedStatus: WebGpuStatus | null = null;
let webGpuDevice: any = null;

export async function detectWebGpuSupport(): Promise<WebGpuStatus> {
  if (cachedStatus) return cachedStatus;

  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;

  if (!nav || !nav.gpu) {
    cachedStatus = {
      supported: false,
      adapterName: 'Unavailable (No navigator.gpu)',
      deviceVendor: 'N/A',
      maxTextureDimension2D: 8192,
      computeEnabled: false,
      fallbackReason: 'Browser WebGPU flag or API is not exposed in this environment',
      executionMode: 'WebGL2 Fallback + GPU Emulation',
    };
    return cachedStatus;
  }

  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
      cachedStatus = {
        supported: false,
        adapterName: 'Adapter request returned null',
        deviceVendor: 'Unknown',
        maxTextureDimension2D: 8192,
        computeEnabled: false,
        fallbackReason: 'GPU adapter could not be initialized (hardware/driver restricted)',
        executionMode: 'WebGL2 Fallback + GPU Emulation',
      };
      return cachedStatus;
    }

    const info = (await adapter.requestAdapterInfo?.()) || {};
    const device = await adapter.requestDevice();
    webGpuDevice = device;

    cachedStatus = {
      supported: true,
      adapterName: info.description || info.vendor || 'WebGPU Compatible Adapter',
      deviceVendor: info.vendor || adapter.name || 'Hardware Accelerated',
      maxTextureDimension2D: device.limits.maxTextureDimension2D || 8192,
      computeEnabled: true,
      executionMode: 'WebGPU Native (WGSL)',
    };
    return cachedStatus;
  } catch (err: any) {
    cachedStatus = {
      supported: false,
      adapterName: 'Detection Error',
      deviceVendor: 'Unknown',
      maxTextureDimension2D: 8192,
      computeEnabled: false,
      fallbackReason: err?.message || 'Failed to acquire WebGPU adapter',
      executionMode: 'WebGL2 Fallback + GPU Emulation',
    };
    return cachedStatus;
  }
}

/**
 * Computes the Intersection-over-Union (IoU) of two binary silhouette masks.
 * If WebGPU compute is active and initialized, it dispatches the WGSL pipeline.
 * Otherwise, it performs an optimized Uint32/Uint8 direct parallel reduction.
 */
export async function computeIoUScore(
  currentMask: Uint8ClampedArray | Uint8Array,
  targetMask: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  threshold: number = 60
): Promise<IoUResult> {
  const startTime = performance.now();

  // If WebGPU is supported and device is ready, we could execute the WGSL pipeline
  if (webGpuDevice) {
    try {
      const result = await runWgslComputeIoU(
        webGpuDevice,
        currentMask,
        targetMask,
        width,
        height,
        threshold
      );
      return {
        ...result,
        method: 'WGSL Compute',
        computeTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      };
    } catch {
      // Fall through to fast CPU reduction if buffer allocation failed
    }
  }

  // Fast CPU Reduction fallback:
  let intersectionCount = 0;
  let unionCount = 0;
  let currentCount = 0;
  let targetCount = 0;

  const totalPixels = width * height;
  const isRgba = currentMask.length === totalPixels * 4;

  if (isRgba) {
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      // In our shadow capture, shadow appears dark (low luminance or high alpha)
      const isCur = currentMask[idx + 3] > 30 && currentMask[idx] < 120;
      const isTar = targetMask[idx + 3] > 30 && targetMask[idx] < 120;

      if (isCur && isTar) intersectionCount++;
      if (isCur || isTar) unionCount++;
      if (isCur) currentCount++;
      if (isTar) targetCount++;
    }
  } else {
    for (let i = 0; i < totalPixels; i++) {
      const isCur = currentMask[i] > threshold;
      const isTar = targetMask[i] > threshold;

      if (isCur && isTar) intersectionCount++;
      if (isCur || isTar) unionCount++;
      if (isCur) currentCount++;
      if (isTar) targetCount++;
    }
  }

  const score = unionCount === 0 ? 0 : Math.round((intersectionCount / unionCount) * 1000) / 10;
  const computeTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    score,
    intersectionCount,
    unionCount,
    currentCount,
    targetCount,
    method: 'Direct Pixel Reduction',
    computeTimeMs,
  };
}

async function runWgslComputeIoU(
  device: any,
  currentMask: Uint8ClampedArray | Uint8Array,
  targetMask: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  threshold: number
): Promise<Omit<IoUResult, 'method' | 'computeTimeMs'>> {
  const total = width * height;
  const currentFloat = new Float32Array(total);
  const targetFloat = new Float32Array(total);

  const isRgba = currentMask.length === total * 4;
  for (let i = 0; i < total; i++) {
    if (isRgba) {
      const idx = i * 4;
      currentFloat[i] = (currentMask[idx + 3] > 30 && currentMask[idx] < 120) ? 1.0 : 0.0;
      targetFloat[i] = (targetMask[idx + 3] > 30 && targetMask[idx] < 120) ? 1.0 : 0.0;
    } else {
      currentFloat[i] = currentMask[i] > threshold ? 1.0 : 0.0;
      targetFloat[i] = targetMask[i] > threshold ? 1.0 : 0.0;
    }
  }

  const GPU_BUFFER_USAGE = (globalThis as any).GPUBufferUsage || {
    MAP_READ: 0x0001,
    MAP_WRITE: 0x0002,
    COPY_SRC: 0x0004,
    COPY_DST: 0x0008,
    INDEX: 0x0010,
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    INDIRECT: 0x0100,
    QUERY_RESOLVE: 0x0200,
  };
  const GPU_MAP_MODE = (globalThis as any).GPUMapMode || { READ: 0x0001, WRITE: 0x0002 };

  const shaderModule = device.createShaderModule({
    code: WGSL_IOU_COMPUTE_CODE,
  });

  const paramsBuffer = device.createBuffer({
    size: 16,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
  });
  const uniformData = new ArrayBuffer(16);
  const u32View = new Uint32Array(uniformData);
  const f32View = new Float32Array(uniformData);
  u32View[0] = width;
  u32View[1] = height;
  f32View[2] = 0.5; // threshold
  device.queue.writeBuffer(paramsBuffer, 0, uniformData);

  const curBuffer = device.createBuffer({
    size: currentFloat.byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST,
  });
  device.queue.writeBuffer(curBuffer, 0, currentFloat);

  const tarBuffer = device.createBuffer({
    size: targetFloat.byteLength,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST,
  });
  device.queue.writeBuffer(tarBuffer, 0, targetFloat);

  const atomicBuffer = device.createBuffer({
    size: 16,
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST,
  });
  device.queue.writeBuffer(atomicBuffer, 0, new Uint32Array(4));

  const readBuffer = device.createBuffer({
    size: 16,
    usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ,
  });

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: shaderModule,
      entryPoint: 'main',
    },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: curBuffer } },
      { binding: 2, resource: { buffer: tarBuffer } },
      { binding: 3, resource: { buffer: atomicBuffer } },
    ],
  });

  const commandEncoder = device.createCommandEncoder();
  const pass = commandEncoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
  pass.end();

  commandEncoder.copyBufferToBuffer(atomicBuffer, 0, readBuffer, 0, 16);
  device.queue.submit([commandEncoder.finish()]);

  await readBuffer.mapAsync(GPU_MAP_MODE.READ);
  const arrayBuffer = readBuffer.getMappedRange();
  const results = new Uint32Array(arrayBuffer.slice(0));
  readBuffer.unmap();

  // Dispose buffers
  paramsBuffer.destroy();
  curBuffer.destroy();
  tarBuffer.destroy();
  atomicBuffer.destroy();
  readBuffer.destroy();

  const inter = results[0];
  const uni = results[1];
  const cur = results[2];
  const tar = results[3];
  const score = uni === 0 ? 0 : Math.round((inter / uni) * 1000) / 10;

  return {
    score,
    intersectionCount: inter,
    unionCount: uni,
    currentCount: cur,
    targetCount: tar,
  };
}
