/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AnamorphicPreset, AnamorphicViewMetrics } from "../types";
import {
	CheckCircle2,
	Compass,
	Crosshair,
	Eye,
	Image,
	Lock,
	Orbit,
	Sparkles,
	Unlock,
} from "lucide-react";

interface AnamorphicOverlayProps {
	presets: AnamorphicPreset[];
	activePreset: AnamorphicPreset;
	onSelectPreset: (preset: AnamorphicPreset) => void;
	view: AnamorphicViewMetrics | null;
	score: number;
	passed: boolean;
	integrity: number;
	viewpointLocked: boolean;
	explorationMode: boolean;
	showTargetOverlay: boolean;
	onGoToSweetSpot: () => void;
	onToggleViewpointLock: () => void;
	onToggleExploration: () => void;
	onToggleTargetOverlay: () => void;
}

const ToleranceRow: React.FC<{
	label: string;
	error: number;
	tolerance: number;
	unit: string;
	ok: boolean;
}> = ({ label, error, tolerance, unit, ok }) => (
	<div className="flex items-center justify-between gap-2 text-[10px]">
		<span className="text-slate-400">{label}</span>
		<span className="flex items-center gap-1.5 font-mono">
			<span className={ok ? "text-emerald-400" : "text-amber-400"}>
				{error.toFixed(2)}
				{unit}
			</span>
			<span className="text-slate-600">/</span>
			<span className="text-slate-500">
				±{tolerance}
				{unit}
			</span>
		</span>
	</div>
);

export const AnamorphicOverlay: React.FC<AnamorphicOverlayProps> = ({
	presets,
	activePreset,
	onSelectPreset,
	view,
	score,
	passed,
	integrity,
	viewpointLocked,
	explorationMode,
	showTargetOverlay,
	onGoToSweetSpot,
	onToggleViewpointLock,
	onToggleExploration,
	onToggleTargetOverlay,
}) => {
	const accuracy = view?.accuracy ?? 0;
	const tolerance = activePreset.sweetSpot.tolerance;
	const isResolved = passed;

	const positionOk =
		(view?.positionError ?? Infinity) <= tolerance.position + 1e-4;
	const angleOk =
		(view?.angleErrorDeg ?? Infinity) <= tolerance.angleDeg + 1e-4;
	const fovOk = (view?.fovError ?? Infinity) <= tolerance.fov + 1e-4;

	return (
		<div className="absolute top-16 left-4 z-20 w-84 max-w-[calc(100vw-32px)] max-h-[calc(100vh-15rem)] overflow-y-auto bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-white">
			{/* Header */}
			<div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800">
				<div className="flex items-center gap-2">
					<div className="p-1.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-400">
						<Eye className="w-4 h-4" />
					</div>
					<div>
						<span className="text-xs font-bold text-slate-100 block">
							Anamorphic Perspective
						</span>
						<span className="text-[10px] text-slate-400">
							Fixed-Viewpoint Illusion
						</span>
					</div>
				</div>

				{/* Preset Selector */}
				<select
					value={activePreset.id}
					onChange={(e) => {
						const found = presets.find(
							(p) => p.id === e.target.value,
						);
						if (found) onSelectPreset(found);
					}}
					className="max-w-[8.5rem] bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold px-2 py-1 text-slate-200 outline-none"
				>
					{presets.map((p) => (
						<option key={p.id} value={p.id}>
							{p.name}
						</option>
					))}
				</select>
			</div>

			{/* Preset Brief */}
			<div className="mb-3 flex gap-3">
				<img
					src={activePreset.targetImage}
					alt="Target silhouette"
					className="h-16 w-16 shrink-0 rounded-lg border border-slate-700 bg-slate-900 object-contain p-1"
				/>
				<div className="min-w-0">
					<h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
						<span>{activePreset.name}</span>
						{isResolved && (
							<CheckCircle2 className="w-4 h-4 text-emerald-400" />
						)}
					</h3>
					<p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
						{activePreset.description}
					</p>
					<p className="text-[10px] text-sky-300/90 mt-1.5 leading-relaxed">
						<strong>Goal:</strong> move the camera until the scattered
						fragments stack into the ghost silhouette. The meter rises
						only near the single correct viewpoint.
					</p>
				</div>
			</div>

			{/* Alignment Gauge */}
			<div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 mb-2.5 space-y-2">
				<div className="flex items-center justify-between text-xs">
					<span className="font-semibold text-slate-300 flex items-center gap-1.5">
						<Compass className="w-3.5 h-3.5 text-rose-400" />
						<span>Sweet-Spot Alignment</span>
					</span>
					<span className="font-mono font-bold text-sm">
						<span
							className={
								isResolved
									? "text-emerald-400"
									: "text-rose-400"
							}
						>
							{accuracy}%
						</span>
					</span>
				</div>

				{/* Bar */}
				<div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden relative">
					<div
						className={`h-full transition-all duration-300 rounded-full ${
							isResolved
								? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/50"
								: "bg-gradient-to-r from-rose-600 to-pink-500"
						}`}
						style={{ width: `${accuracy}%` }}
					/>
				</div>

				{/* Tolerance breakdown */}
				<div className="space-y-0.5 pt-0.5">
					<ToleranceRow
						label="Position"
						error={view?.positionError ?? 0}
						tolerance={tolerance.position}
						unit="m"
						ok={positionOk}
					/>
					<ToleranceRow
						label="View angle"
						error={view?.angleErrorDeg ?? 0}
						tolerance={tolerance.angleDeg}
						unit="°"
						ok={angleOk}
					/>
					<ToleranceRow
						label="Field of view"
						error={view?.fovError ?? 0}
						tolerance={tolerance.fov}
						unit="°"
						ok={fovOk}
					/>
				</div>

				{/* Status Message */}
				<div className="text-[11px] font-medium text-center pt-1">
					{!view && (
						<span className="text-slate-400">
							Move the camera to begin alignment…
						</span>
					)}
					{view && accuracy < 40 && (
						<span className="text-slate-400">
							Chaotic 3D cluster — orbit to see the depth
						</span>
					)}
					{view && accuracy >= 40 && accuracy < 75 && (
						<span className="text-amber-400">
							Fragments beginning to converge…
						</span>
					)}
					{view &&
						accuracy >= 75 &&
						!isResolved &&
						integrity >= 90 && (
							<span className="text-pink-400">
								Almost aligned! Nudge the viewpoint.
							</span>
						)}
					{view && view.withinTolerance && integrity < 90 && (
						<span className="text-orange-400">
							Camera aligned — restore the scattered fragments.
						</span>
					)}
					{isResolved && (
						<span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
							<Sparkles className="w-3.5 h-3.5" />
							<span>Optical Illusion Perfectly Resolved!</span>
						</span>
					)}
				</div>
			</div>

			{/* Score + integrity */}
			<div className="grid grid-cols-2 gap-2 mb-3">
				<div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
					<span className="text-[10px] uppercase tracking-wide text-slate-500 block">
						Illusion Score
					</span>
					<span
						className={`text-lg font-black font-mono ${
							isResolved ? "text-emerald-400" : "text-slate-200"
						}`}
					>
						{score}
						<span className="text-[10px] text-slate-500 font-normal">
							/100
						</span>
					</span>
				</div>
				<div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
					<span className="text-[10px] uppercase tracking-wide text-slate-500 block">
						Fragment Integrity
					</span>
					<span
						className={`text-lg font-black font-mono ${
							integrity >= 90
								? "text-sky-300"
								: "text-amber-400"
						}`}
					>
						{integrity}
						<span className="text-[10px] text-slate-500 font-normal">
							%
						</span>
					</span>
				</div>
			</div>

			{/* Action Buttons */}
			<div className="grid grid-cols-2 gap-2 text-xs">
				<button
					onClick={onGoToSweetSpot}
					className="col-span-2 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold shadow-lg shadow-rose-950/60 transition-all"
				>
					<Crosshair className="w-3.5 h-3.5" />
					<span>Go to Sweet Spot</span>
				</button>

				<button
					onClick={onToggleViewpointLock}
					className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl font-semibold border transition-colors ${
						viewpointLocked
							? "bg-emerald-950/80 border-emerald-700 text-emerald-300"
							: "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
					}`}
				>
					{viewpointLocked ? (
						<Lock className="w-3.5 h-3.5" />
					) : (
						<Unlock className="w-3.5 h-3.5 text-slate-400" />
					)}
					<span>
						{viewpointLocked ? "Locked" : "Lock View"}
					</span>
				</button>

				<button
					onClick={onToggleExploration}
					className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl font-semibold border transition-colors ${
						explorationMode
							? "bg-indigo-950/80 border-indigo-700 text-indigo-300"
							: "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
					}`}
				>
					<Orbit className="w-3.5 h-3.5" />
					<span>
						{explorationMode ? "Exploring" : "Explore 3D"}
					</span>
				</button>

				<button
					onClick={onToggleTargetOverlay}
					className={`col-span-2 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl font-medium border transition-colors ${
						showTargetOverlay
							? "bg-slate-800 border-slate-600 text-slate-100"
							: "bg-slate-900 border-slate-800 text-slate-500"
					}`}
				>
					<Image className="w-3.5 h-3.5" />
					<span>
						Target Overlay{" "}
						{showTargetOverlay ? "On" : "Off"}
					</span>
				</button>
			</div>

			{/* CGVR Educational footnote */}
			<div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[10px] text-slate-400 leading-normal">
				<strong>CGVR Concept:</strong> Perspective projection maps
				3D points (X, Y, Z) to 2D coordinates (X/Z, Y/Z). Placing
				fragments along shared lines of sight at different depths makes
				an observer at the focal point perceive one flat silhouette.
			</div>
		</div>
	);
};
