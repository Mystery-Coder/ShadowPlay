/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Crosshair, Sparkles } from "lucide-react";

interface SweetSpotMarkerProps {
	targetImage: string;
	revealColor: string;
	showTarget: boolean;
	accuracy: number;
	solved: boolean;
	onGoToSweetSpot: () => void;
}

/**
 * Full-viewport registration frame. The square matches the vertical FOV used by
 * the preset builder, so the ghost silhouette lines up with the 3D bead cloud.
 */
export const SweetSpotMarker: React.FC<SweetSpotMarkerProps> = ({
	targetImage,
	revealColor,
	showTarget,
	accuracy,
	solved,
	onGoToSweetSpot,
}) => {
	const targetOpacity = showTarget
		? Math.min(0.66, 0.12 + (accuracy / 100) * 0.5)
		: 0;

	return (
		<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
			<div
				className="relative"
				style={{
					height: "100vh",
					width: "100vh",
					maxWidth: "100vw",
				}}
			>
				{/* Ghost target silhouette */}
				<img
					src={targetImage}
					alt="Anamorphic target silhouette"
					draggable={false}
					className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300 select-none"
					style={{
						opacity: targetOpacity,
						mixBlendMode: "screen",
						filter: solved
							? `drop-shadow(0 0 22px ${revealColor})`
							: `drop-shadow(0 0 10px ${revealColor}55)`,
					}}
				/>

				{/* Corner registration brackets */}
				{[
					"top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
					"top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
					"bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
					"bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
				].map((corner) => (
					<div
						key={corner}
						className={`absolute h-12 w-12 ${corner}`}
						style={{
							borderColor: `${revealColor}${solved ? "cc" : "55"}`,
						}}
					/>
				))}

				{/* Centre reticle */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
					<div
						className="relative flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-300"
						style={{
							borderColor: solved
								? revealColor
								: `${revealColor}66`,
							boxShadow: solved
								? `0 0 26px ${revealColor}99`
								: "none",
						}}
					>
						<span
							className="absolute h-px w-5"
							style={{ backgroundColor: `${revealColor}bb` }}
						/>
						<span
							className="absolute h-5 w-px"
							style={{ backgroundColor: `${revealColor}bb` }}
						/>
						<span
							className="h-1.5 w-1.5 rounded-full"
							style={{ backgroundColor: revealColor }}
						/>
					</div>
					<span
						className="mt-2 block text-center text-[9px] font-bold tracking-[0.25em] uppercase"
						style={{ color: `${revealColor}cc` }}
					>
						Sweet Spot
					</span>
				</div>

				{/* Quick jump */}
				<div className="pointer-events-auto absolute bottom-48 left-1/2 -translate-x-1/2">
					<button
						onClick={onGoToSweetSpot}
						className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold shadow-2xl backdrop-blur-md transition-all hover:scale-105"
						style={{
							backgroundColor: `${revealColor}22`,
							borderColor: `${revealColor}88`,
							color: revealColor,
						}}
					>
						{solved ? (
							<Sparkles className="h-3.5 w-3.5" />
						) : (
							<Crosshair className="h-3.5 w-3.5" />
						)}
						<span>
							{solved ? "Illusion Resolved" : "Go to Sweet Spot"}
						</span>
					</button>
				</div>
			</div>
		</div>
	);
};
