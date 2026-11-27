/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Cpu,
  Gauge,
  Layers3,
  LoaderCircle,
  Monitor,
  Play,
  RefreshCw,
  Timer,
  Zap,
} from 'lucide-react';
import {
  EnginePerformanceMetrics,
  PagpBenchmarkSummary,
  WebGpuStatus,
} from '../types';
import { runPagpBenchmark } from '../engine/pagp-benchmark';

interface PagpOverlayProps {
  metrics: EnginePerformanceMetrics | null;
  webGpuStatus: WebGpuStatus | null;
}

type ChartDatum = { label: string; value: number | null };
type Tab = 'overview' | 'parallel' | 'correctness';

const formatMs = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${value.toFixed(2)} ms`;
const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString();
const formatPercent = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${value.toFixed(2)}%`;
const formatBandwidth = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${value.toFixed(1)} GB/s`;
const formatMillions = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${(value / 1_000_000).toFixed(1)}M`;
const average = (values: number[]) =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

function MetricCard({
  label,
  value,
  sub,
  definition,
  icon: Icon,
  accent = 'sky',
}: {
  label: string;
  value: string;
  sub?: string;
  definition: string;
  icon: React.ElementType;
  accent?: 'sky' | 'violet' | 'emerald' | 'amber' | 'rose';
}) {
  const accents: Record<string, string> = {
    sky: 'from-sky-500/20 to-cyan-500/5 border-sky-400/30 text-sky-300',
    violet: 'from-violet-500/20 to-fuchsia-500/5 border-violet-400/30 text-violet-300',
    emerald: 'from-emerald-500/20 to-teal-500/5 border-emerald-400/30 text-emerald-300',
    amber: 'from-amber-500/20 to-orange-500/5 border-amber-400/30 text-amber-300',
    rose: 'from-rose-500/20 to-pink-500/5 border-rose-400/30 text-rose-300',
  };
  return (
    <div title={definition} className={`rounded-xl border bg-gradient-to-br p-2.5 ${accents[accent]}`}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="mt-1 text-base font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

function Sparkline({
  data,
  color = '#38bdf8',
  height = 54,
  suffix = '',
}: {
  data: number[];
  color?: string;
  height?: number;
  suffix?: string;
}) {
  const width = 220;
  const gradientId = `pagp-gradient-${color.replace('#', '')}`;

  if (data.length < 2) {
    return (
      <div className="flex h-[54px] items-center justify-center rounded-lg border border-slate-800/80 bg-slate-950/70 text-[10px] text-slate-500">
        Collecting samples…
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - 4 - ((value - min) / range) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((fraction) => (
        <line
          key={fraction}
          x1="0"
          x2={width}
          y1={height * fraction}
          y2={height * fraction}
          stroke="#1e293b"
          strokeWidth="1"
        />
      ))}
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <text x="3" y="10" fill="#64748b" fontSize="8">
        {max.toFixed(1)}
        {suffix}
      </text>
      <text x="3" y={height - 2} fill="#64748b" fontSize="8">
        {min.toFixed(1)}
        {suffix}
      </text>
    </svg>
  );
}

function BarChart({
  data,
  colorFor,
}: {
  data: ChartDatum[];
  colorFor?: (label: string) => string;
}) {
  const max = Math.max(...data.map((item) => item.value ?? 0), 0.001);
  return (
    <div className="space-y-1.5">
      {data.map((item) => (
        <div key={item.label} className="grid grid-cols-[3.25rem_1fr_3.75rem] items-center gap-2">
          <span className="truncate text-[10px] text-slate-400">{item.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: item.value === null ? 0 : `${Math.max(2, (item.value / max) * 100)}%`,
                background: colorFor?.(item.label) ?? 'linear-gradient(90deg, #0ea5e9, #22d3ee)',
              }}
            />
          </div>
          <span className="text-right text-[10px] tabular-nums text-slate-300">
            {item.value === null ? '—' : item.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  definition,
  children,
}: {
  icon: React.ElementType;
  definition: string;
  children: React.ReactNode;
}) {
  return (
    <div
      title={definition}
      className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300"
    >
      <Icon className="h-3.5 w-3.5 text-sky-400" />
      {children}
    </div>
  );
}

function StatusRow({ label, value, tone, definition }: {
  label: string;
  value: string;
  tone: string;
  definition: string;
}) {
  return (
    <div title={definition} className="flex justify-between rounded-lg bg-slate-950/60 px-2 py-1.5">
      <span className="text-slate-400">{label}</span>
      <span className={`max-w-[60%] truncate ${tone}`}>{value}</span>
    </div>
  );
}

export const PagpOverlay: React.FC<PagpOverlayProps> = ({ metrics, webGpuStatus }) => {
  const [frameHistory, setFrameHistory] = useState<number[]>([]);
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);
  const [bench, setBench] = useState<PagpBenchmarkSummary | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const lastTimestamp = useRef(0);

  const runBenchmark = useCallback(async () => {
    setRunning(true);
    try {
      setBench(await runPagpBenchmark());
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void runBenchmark();
  }, [runBenchmark]);

  useEffect(() => {
    if (!metrics || metrics.timestamp === lastTimestamp.current) return;
    lastTimestamp.current = metrics.timestamp;
    setFrameHistory((previous) => [...previous, metrics.frameTimeMs].slice(-60));
    setFpsHistory((previous) => [...previous, metrics.fps].slice(-60));
  }, [metrics]);

  const gpuResults = useMemo(
    () =>
      bench?.results.filter(
        (result) => !result.error?.startsWith('WebGPU unavailable')
      ) ?? [],
    [bench]
  );

  const workgroupData = useMemo(
    () =>
      [64, 128, 256].map((size) => ({
        label: String(size),
        value: average(
          gpuResults
            .filter((result) => result.workgroupSize === size)
            .map((result) => result.gpuTimeMs ?? result.gpuWallTimeMs)
            .filter((value) => value > 0)
        ),
      })),
    [gpuResults]
  );

  const bestWorkgroup = useMemo(() => {
    const ranked = workgroupData
      .filter((item) => item.value !== null)
      .sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity));
    return ranked[0]?.label ?? '—';
  }, [workgroupData]);

  const cpuGpuData: ChartDatum[] = [
    { label: 'CPU', value: average(gpuResults.map((result) => result.cpuTimeMs)) },
    {
      label: bench?.timestampQueries ? 'GPU' : 'GPU*',
      value: average(
        gpuResults
          .map((result) => result.gpuTimeMs ?? result.gpuWallTimeMs)
          .filter((value) => value > 0)
      ),
    },
  ];

  const throughputData = [256, 512, 1024].map((resolution) => ({
    label: `${resolution}`,
    value: average(
      gpuResults
        .filter((result) => result.resolution === resolution)
        .map((result) => result.throughputMegapixelsPerSecond ?? Number.NaN)
        .filter((value) => Number.isFinite(value))
    ),
  }));

  const speedupData = [64, 128, 256].map((size) => ({
    label: `wg ${size}`,
    value: average(
      gpuResults
        .filter((result) => result.workgroupSize === size)
        .map((result) => result.speedup ?? Number.NaN)
        .filter((value) => Number.isFinite(value))
    ),
  }));

  const utilizationData = [64, 128, 256].map((size) => ({
    label: String(size),
    value: average(
      gpuResults
        .filter((result) => result.workgroupSize === size)
        .map((result) => result.workgroupUtilization)
    ),
  }));

  const bandwidthData = [256, 512, 1024].map((resolution) => ({
    label: `${resolution}`,
    value: average(
      gpuResults
        .filter((result) => result.resolution === resolution)
        .map((result) => result.effectiveBandwidthGbps ?? Number.NaN)
        .filter((value) => Number.isFinite(value))
    ),
  }));

  const maxError = Math.max(0, ...gpuResults.map((result) => result.absoluteError ?? 0));
  const referenceResult = gpuResults[0];
  const failureResults = gpuResults.filter(
    (result) =>
      result.error &&
      !result.error.startsWith('Timestamp query unavailable') &&
      !result.error.startsWith('Repeated GPU')
  );

  return (
    <div className="absolute top-[7.25rem] left-4 z-20 max-h-[calc(100vh-21rem)] w-[26rem] max-w-[calc(100vw-32px)] overflow-y-auto rounded-2xl border border-slate-800/90 bg-slate-950/90 p-3.5 text-white shadow-2xl backdrop-blur-xl animate-fadeIn min-[900px]:top-16 min-[900px]:max-h-[calc(100vh-16.5rem)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Activity className="h-4 w-4 text-sky-400" />
            PAGP Performance Dashboard
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-400">
            Live renderer telemetry + CPU/GPU IoU analytics
          </p>
        </div>
        <button
          onClick={() => void runBenchmark()}
          disabled={running}
          title="Rerun the CPU and WGSL IoU benchmark matrix"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-medium text-sky-200 transition hover:bg-sky-500/20 disabled:opacity-50"
        >
          {running ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {running ? 'Running' : 'Benchmark'}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        {(
          [
            ['overview', 'Render'],
            ['parallel', 'Parallel GPU'],
            ['correctness', 'Correctness'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-2 py-1.5 text-[10px] font-semibold transition ${
              tab === key ? 'bg-sky-500/20 text-sky-200' : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              icon={Gauge}
              label="FPS"
              value={metrics ? metrics.fps.toFixed(1) : '—'}
              sub={`${metrics?.sampleCount ?? 0} frame samples`}
              definition="Frames rendered per second, averaged over the recent frame-time samples."
            />
            <MetricCard
              icon={Timer}
              label="Frame time"
              value={formatMs(metrics?.frameTimeMs)}
              sub={`avg ${formatMs(metrics?.frameTimeAvgMs)}`}
              accent="violet"
              definition="Wall-clock interval between animation frames; includes rendering, readback, and benchmark stalls."
            />
            <MetricCard
              icon={Cpu}
              label="CPU execution"
              value={formatMs(metrics?.cpuTimeMs)}
              sub="update + render + capture"
              accent="emerald"
              definition="CPU work in the frame: camera/control update, main render submission, and periodic shadow capture/readback."
            />
            <MetricCard
              icon={Zap}
              label="GPU execution"
              value={formatMs(metrics?.gpuRenderTimeMs)}
              sub={`${metrics?.gpuTimingSource ?? 'Waiting'} · main render`}
              accent="amber"
              definition="GPU timestamp for the main scene render only. Offscreen silhouette captures are excluded, so it is not comparable to total CPU frame work."
            />
            <MetricCard
              icon={Layers3}
              label="Draw calls"
              value={formatNumber(metrics?.drawCalls)}
              sub={`${formatNumber(metrics?.triangles)} triangles`}
              definition="Draw commands issued by the main render, shadow passes, and throttled silhouette captures."
            />
            <MetricCard
              icon={Timer}
              label="Shadow generation"
              value={formatMs(metrics?.shadowTimeMs)}
              sub={`capture ${formatMs(metrics?.captureTimeMs)}`}
              accent="rose"
              definition="CPU submit time for Three.js shadow-map passes; capture is the separate cost of reading the projected shadow mask."
            />
            <MetricCard
              icon={Zap}
              label="GPU busy"
              value={
                metrics?.gpuRenderTimeMs && metrics.frameTimeMs
                  ? formatPercent((metrics.gpuRenderTimeMs / metrics.frameTimeMs) * 100)
                  : '—'
              }
              sub="GPU time / frame time"
              accent="amber"
              definition="Share of the current frame interval spent in the main GPU render pass; low values suggest CPU-bound or stalled frames."
            />
            <MetricCard
              icon={Layers3}
              label="Shadow cost share"
              value={
                metrics?.cpuTimeMs
                  ? formatPercent((metrics.shadowTimeMs / metrics.cpuTimeMs) * 100)
                  : '—'
              }
              sub="shadow / CPU frame work"
              accent="rose"
              definition="Portion of CPU frame work spent submitting shadow-map passes, i.e. the cost of the projected shadow used by the studio."
            />
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-2.5">
            <SectionTitle
              icon={Activity}
              definition="Recent frame intervals, useful for spotting stalls and frame-time variance."
            >
              Frame time · last 60 frames
            </SectionTitle>
            <Sparkline data={frameHistory} color="#38bdf8" suffix=" ms" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-2.5">
              <SectionTitle icon={Gauge} definition="Trend of rendered frames per second over recent samples.">
                FPS history
              </SectionTitle>
              <Sparkline data={fpsHistory} color="#34d399" height={44} />
            </div>
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-2.5">
              <SectionTitle
                icon={BarChart3}
                definition="Summary of frame-time distribution; P95 is the 95th percentile and exposes occasional stalls."
              >
                Frame distribution
              </SectionTitle>
              <BarChart
                data={[
                  { label: 'avg', value: metrics?.frameTimeAvgMs ?? null },
                  { label: 'min', value: metrics?.frameTimeMinMs ?? null },
                  { label: 'max', value: metrics?.frameTimeMaxMs ?? null },
                  { label: 'P95', value: metrics?.frameTimeP95Ms ?? null },
                ]}
                colorFor={(label) => (label === 'P95' ? '#fb7185' : '#38bdf8')}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'parallel' && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              icon={Cpu}
              label="Sequential CPU IoU"
              value={formatMs(referenceResult?.cpuTimeMs)}
              sub="JavaScript reduction baseline"
              accent="emerald"
              definition="Time for a single-threaded JavaScript loop to count intersection and union pixels."
            />
            <MetricCard
              icon={Zap}
              label="WGSL GPU IoU"
              value={formatMs(referenceResult?.gpuTimeMs ?? referenceResult?.gpuWallTimeMs)}
              sub={referenceResult?.gpuTimingSource ?? 'Run benchmark'}
              accent="amber"
              definition="GPU compute-pass time from a timestamp query, or submit/readback wall time when timestamp queries are unavailable."
            />
            <MetricCard
              icon={Gauge}
              label="Speedup"
              value={referenceResult?.speedup ? `${referenceResult.speedup.toFixed(2)}×` : '—'}
              sub="T_CPU / T_GPU"
              accent="violet"
              definition="CPU IoU time divided by GPU shader time; shown only when a real timestamp query succeeds."
            />
            <MetricCard
              icon={Activity}
              label="Throughput"
              value={
                referenceResult?.throughputMegapixelsPerSecond
                  ? `${referenceResult.throughputMegapixelsPerSecond.toFixed(1)} MP/s`
                  : '—'
              }
              sub={
                referenceResult?.gpuTimingSource === 'WebGPU timestamp query'
                  ? 'pixels / shader seconds'
                  : 'pixels / wall seconds'
              }
              definition="Pixels processed per second using the displayed timing source."
            />
            <MetricCard
              icon={Layers3}
              label="Workgroups"
              value={formatNumber(referenceResult?.workgroups)}
              sub="threads / blocks / grid"
              definition="Dispatch grid size: ceil(pixels / workgroup size) workgroups launched by the compute shader."
            />
            <MetricCard
              icon={Gauge}
              label="Workgroup utilization"
              value={formatPercent(referenceResult?.workgroupUtilization)}
              sub="active invocations"
              accent="violet"
              definition="Fraction of launched invocations that map to real pixels; low values show tail waste from rounding up the grid."
            />
            <MetricCard
              icon={Activity}
              label="Effective bandwidth"
              value={formatBandwidth(referenceResult?.effectiveBandwidthGbps)}
              sub="two f32 masks"
              definition="Mask bytes read per second: two f32 masks mean 8 bytes per pixel, derived from GPU shader time."
            />
            <MetricCard
              icon={Zap}
              label="Atomic reductions"
              value={formatMillions(referenceResult?.atomicOperations)}
              sub="4/pixel + 4/workgroup"
              accent="rose"
              definition="Atomic additions used by the parallel reduction: four local updates per pixel plus four global partial sums per workgroup."
            />
            <MetricCard
              icon={Layers3}
              label="Mask traffic"
              value={
                referenceResult
                  ? `${referenceResult.maskTrafficMb.toFixed(2)} MB`
                  : '—'
              }
              sub="two f32 masks"
              definition="Total data read by the IoU kernel from the two input masks: 8 bytes per pixel, linking the kernel to the memory hierarchy."
            />
            <MetricCard
              icon={Timer}
              label="Launch overhead"
              value={formatMs(
                median(
                  gpuResults
                    .map((result) => result.launchOverheadMs)
                    .filter((value): value is number => value !== null)
                )
              )}
              sub={`${bench?.gpuDispatches ?? 0} kernel dispatches`}
              accent="amber"
              definition="Wall time minus shader time: queue submission and readback cost outside the compute kernel (interaction overhead)."
            />
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-2.5">
            <SectionTitle
              icon={BarChart3}
              definition="Side-by-side CPU and GPU time for the same IoU workload; the GPU bar uses shader time when available."
            >
              CPU vs GPU IoU execution (ms)
            </SectionTitle>
            <BarChart
              data={cpuGpuData}
              colorFor={(label) => (label.startsWith('GPU') ? '#f59e0b' : '#34d399')}
            />
            {referenceResult?.gpuTimingSource === 'submit + readback fallback' && (
              <p className="mt-2 text-[10px] text-amber-300/80">
                GPU* is submit + readback time; no shader timestamp query succeeded.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-2.5">
            <SectionTitle
              icon={Layers3}
              definition="Workgroup size versus GPU compute time, showing how thread-block mapping affects performance."
            >
              Workgroup size · GPU time (ms)
            </SectionTitle>
            <BarChart
              data={workgroupData}
              colorFor={(label) => (label === bestWorkgroup ? '#34d399' : '#38bdf8')}
            />
            <p className="mt-2 text-[10px] text-slate-500">Fastest workgroup: {bestWorkgroup}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-2.5">
              <SectionTitle
                icon={Activity}
                definition="Throughput as mask resolution changes, showing how the same kernel scales with workload size."
              >
                Resolution · MP/s
              </SectionTitle>
              <BarChart data={throughputData} colorFor={() => '#22d3ee'} />
            </div>
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-2.5">
              <SectionTitle
                icon={Gauge}
                definition="CPU-to-GPU speedup for each workgroup size, using timestamped shader time."
              >
                Speedup by workgroup
              </SectionTitle>
              <BarChart data={speedupData} colorFor={() => '#a78bfa'} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-2.5">
              <SectionTitle
                icon={Layers3}
                definition="Percentage of launched threads doing useful pixel work for each workgroup size."
              >
                Workgroup utilization
              </SectionTitle>
              <BarChart data={utilizationData} colorFor={() => '#34d399'} />
            </div>
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-2.5">
              <SectionTitle
                icon={Activity}
                definition="Effective mask-read bandwidth by resolution, connecting kernel performance to memory hierarchy."
              >
                Effective bandwidth · GB/s
              </SectionTitle>
              <BarChart data={bandwidthData} colorFor={() => '#22d3ee'} />
            </div>
          </div>

          {bench && !bench.supported && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] text-amber-200">
              WebGPU is unavailable here. CPU reduction still runs; GPU charts and shader
              timings need a WebGPU-capable browser/GPU.
            </div>
          )}
        </div>
      )}

      {tab === 'correctness' && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              icon={CheckCircle2}
              label="IoU accuracy CPU"
              value={formatPercent(referenceResult?.cpuScore)}
              sub="reference reduction"
              accent="emerald"
              definition="Intersection-over-Union computed by the sequential CPU baseline, used as the correctness reference."
            />
            <MetricCard
              icon={CheckCircle2}
              label="IoU accuracy GPU"
              value={formatPercent(referenceResult?.gpuScore)}
              sub="WGSL compute reduction"
              definition="Intersection-over-Union computed by the parallel WGSL atomic reduction."
            />
            <MetricCard
              icon={AlertTriangle}
              label="Absolute error"
              value={maxError ? formatPercent(maxError) : gpuResults.length ? '0.000%' : '—'}
              sub="|IoU_CPU − IoU_GPU|"
              accent="amber"
              definition="Largest absolute difference between CPU and GPU IoU scores across all benchmark workloads."
            />
            <MetricCard
              icon={RefreshCw}
              label="Consistency"
              value={
                bench?.consistencySamples
                  ? `${bench.consistentSamples}/${bench.consistencySamples}`
                  : '—'
              }
              sub="repeated GPU runs"
              accent="violet"
              definition="Repeated GPU dispatches that returned the same IoU score, intersection count, and union count."
            />
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-900/40 p-2.5">
            <SectionTitle
              icon={AlertTriangle}
              definition="Dependability view: validation errors, device loss, and failed dispatches observed during the benchmark."
            >
              GPU execution failures
            </SectionTitle>
            <div className="space-y-1 text-[10px]">
              <StatusRow
                label="Validation errors"
                value={String(bench?.validationErrors ?? 0)}
                tone={bench?.validationErrors ? 'text-rose-300' : 'text-emerald-300'}
                definition="Uncaptured WebGPU validation errors reported by the benchmark device."
              />
              <StatusRow
                label="Device loss"
                value={String(bench?.deviceLosses ?? 0)}
                tone={bench?.deviceLosses ? 'text-rose-300' : 'text-emerald-300'}
                definition="Whether the WebGPU device was lost during the benchmark run."
              />
              <StatusRow
                label="Dispatch failures"
                value={String(failureResults.length)}
                tone={failureResults.length ? 'text-rose-300' : 'text-emerald-300'}
                definition="Compute dispatches that threw an error or did not produce a result."
              />
              <StatusRow
                label="WebGPU adapter"
                value={bench?.adapterName ?? webGpuStatus?.adapterName ?? 'Checking…'}
                tone="text-slate-300"
                definition="Adapter used for the WGSL benchmark, or the CPU fallback when WebGPU is unavailable."
              />
              <StatusRow
                label="Timestamp queries"
                value={
                  bench
                    ? bench.timestampQueries
                      ? 'supported'
                      : 'fallback'
                    : webGpuStatus?.timestampQueries
                      ? 'supported'
                      : 'unavailable'
                }
                tone={bench?.timestampQueries ? 'text-emerald-300' : 'text-amber-300'}
                definition="Whether WebGPU timestamp queries are available for measuring actual compute-shader time."
              />
              {failureResults.slice(0, 3).map((result, index) => (
                <div
                  key={index}
                  title={result.error ?? undefined}
                  className="rounded-lg bg-rose-500/10 px-2 py-1.5 text-rose-200"
                >
                  {result.resolution}px / wg {result.workgroupSize}: {result.error}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-slate-800/80 pt-2 text-[10px] text-slate-500">
        <Monitor className="h-3 w-3" />
        <span className="truncate">
          {metrics
            ? `GPU render timing: ${metrics.gpuTimingSource}`
            : 'Waiting for engine telemetry'}
        </span>
      </div>
    </div>
  );
};
