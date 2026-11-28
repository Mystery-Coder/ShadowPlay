/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
	AppMode,
	EnginePerformanceMetrics,
	StudioObject,
	StudioLight,
	ShapeType,
} from "../types";
import { createObjectMesh, createSpotlightRigModel } from "./procedural-models";

// Module-level reusable math instances (Zero-GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _color = new THREE.Color();

// Reduced fill used only while the Multi-Light Studio is active. These values
// attenuate existing ambient sources; they do not replace or dispose them.
const MULTI_LIGHT_HEMI_INTENSITY = 0.06;
const MULTI_LIGHT_ENVIRONMENT_INTENSITY = 0.25;

export interface StudioCallbacks {
	onSelectObject: (obj: StudioObject | null) => void;
	onObjectTransformChange: (obj: StudioObject) => void;
	onSilhouetteUpdate?: (
		currentPixels: Uint8Array,
		width: number,
		height: number,
	) => void;
	onAnamorphicAccuracyChange?: (accuracy: number) => void;
	onPerformanceUpdate?: (metrics: EnginePerformanceMetrics) => void;
}

export class ShadowStudioEngine {
	private container: HTMLElement;
	private renderer: THREE.WebGLRenderer;
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private controls: OrbitControls;
	private transformControls: TransformControls;

	// Scene elements
	private wallMesh: THREE.Mesh;
	private turntableMesh: THREE.Mesh;
	private objectGroup: THREE.Group;
	private lightFixturesGroup: THREE.Group;

	// Lights
	private lightsMap: Map<string, THREE.SpotLight> = new Map();
	private hemiLight: THREE.HemisphereLight;
	// Captured at construction so reduced-ambient mode can restore exact defaults.
	private normalHemiIntensity = 0.45;
	private normalEnvironmentIntensity = 1;

	// Object Registry
	private objectsMap: Map<
		string,
		{ model: THREE.Group; data: StudioObject }
	> = new Map();
	private selectedObjectId: string | null = null;

	// Camera animation target
	private cameraTargetPos: THREE.Vector3 | null = null;
	private cameraTargetLookAt: THREE.Vector3 | null = null;
	private cameraLookAtCurrent: THREE.Vector3 = new THREE.Vector3(0, 1.5, 0);

	// Offscreen Silhouette Capture for Puzzle Evaluation
	private silhouetteCamera: THREE.OrthographicCamera;
	private silhouetteRenderTarget: THREE.WebGLRenderTarget;
	private silhouettePixels: Uint8Array;
	private silhouetteReferencePixels: Uint8Array;
	private silhouetteMaskPixels: Uint8Array;
	private silhouetteResolution = 128;
	private silhouetteCounter = 0;
	/** Studio decor hidden while capturing the projection wall. */
	private captureDecor: THREE.Object3D[] = [];
	/** Puzzle mode trades studio fill light for high-contrast projected shadows. */
	private flatLightFalloff = false;

	// Anamorphic Sweet Spot
	private anamorphicSweetSpot: {
		pos: THREE.Vector3;
		lookAt: THREE.Vector3;
	} | null = null;

	// Callbacks
	private callbacks: StudioCallbacks;
	private animationFrameId = 0;
	private isDestroyed = false;
	private raycaster = new THREE.Raycaster();
	private mouse = new THREE.Vector2();

	// PAGP telemetry: rolling frame samples + optional WebGL2 GPU timer queries.
	private frameTimes: number[] = [];
	private cpuTimes: number[] = [];
	private captureTimes: number[] = [];
	private shadowTimes: number[] = [];
	private drawCalls: number[] = [];
	private triangles: number[] = [];
	private lastFrameTimestamp = 0;
	private lastPerformanceEmit = 0;
	private gpuTimerExtension: any = null;
	private glContext: WebGL2RenderingContext | null = null;
	private pendingGpuQueries: WebGLQuery[] = [];
	private latestGpuRenderTimeMs: number | null = null;
	private shadowSubmitAccumulator = 0;
	private performanceMonitoring = false;

	constructor(container: HTMLElement, callbacks: StudioCallbacks) {
		this.container = container;
		this.callbacks = callbacks;

		// 1. Detect Software GL
		const isSoftwareGl = (() => {
			const gl = document.createElement("canvas").getContext("webgl2");
			if (!gl) return true;
			const ext = gl.getExtension("WEBGL_debug_renderer_info");
			const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
			const gpu = String(gl.getParameter(param));
			gl.getExtension("WEBGL_lose_context")?.loseContext();
			return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
				gpu,
			);
		})();

		// 2. Setup Renderer
		this.renderer = new THREE.WebGLRenderer({
			antialias: !isSoftwareGl,
			powerPreference: "high-performance",
			preserveDrawingBuffer: true, // Needed for screenshot / capture
		});
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.05;
		this.renderer.setPixelRatio(
			isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
		);
		this.renderer.setSize(container.clientWidth, container.clientHeight);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		// Measure cumulative draw calls per animation frame (main render + shadow
		// passes + throttled silhouette captures).
		this.renderer.info.autoReset = false;

		// Optional GPU timestamp query for the main scene render. Devices without
		// EXT_disjoint_timer_query_webgl2 fall back to CPU render timing.
		const gl = this.renderer.getContext();
		if (
			typeof WebGL2RenderingContext !== "undefined" &&
			gl instanceof WebGL2RenderingContext
		) {
			this.glContext = gl;
			this.gpuTimerExtension = gl.getExtension(
				"EXT_disjoint_timer_query_webgl2",
			);
		}

		// Three issues shadow-map draws from this method. Wrapping it gives a
		// focused CPU-submit timing without changing the render pipeline.
		const shadowMap = this.renderer.shadowMap as any;
		const originalShadowRender = shadowMap.render.bind(shadowMap);
		shadowMap.render = (...args: any[]) => {
			const started = performance.now();
			const value = originalShadowRender(...args);
			this.shadowSubmitAccumulator += performance.now() - started;
			return value;
		};

		container.appendChild(this.renderer.domElement);

		// 3. Scene & Studio Environment
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x0b0f17);
		this.scene.fog = new THREE.FogExp2(0x0b0f17, 0.035);

		const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
		this.scene.environment = pmremGenerator.fromScene(
			new RoomEnvironment(),
			0.04,
		).texture;
		pmremGenerator.dispose();

		// 4. Camera & OrbitControls
		this.camera = new THREE.PerspectiveCamera(
			45,
			container.clientWidth / container.clientHeight,
			0.1,
			50,
		);
		this.camera.position.set(4.5, 3.2, 5.5);
		this.cameraLookAtCurrent.set(0, 1.5, 0.5);
		this.camera.lookAt(this.cameraLookAtCurrent);

		this.controls = new OrbitControls(
			this.camera,
			this.renderer.domElement,
		);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.05;
		this.controls.maxPolarAngle = Math.PI / 2 + 0.02; // prevent going below floor
		this.controls.minDistance = 1.5;
		this.controls.maxDistance = 25;
		this.controls.target.copy(this.cameraLookAtCurrent);

		// 5. TransformControls Gizmo for 3D manipulation
		this.transformControls = new TransformControls(
			this.camera,
			this.renderer.domElement,
		);
		this.transformControls.size = 0.75;
		this.transformControls.addEventListener("dragging-changed", (event) => {
			this.controls.enabled = !event.value;
		});
		this.transformControls.addEventListener("change", () => {
			if (this.selectedObjectId) {
				const entry = this.objectsMap.get(this.selectedObjectId);
				if (entry) {
					const m = entry.model;
					entry.data.position = [
						Math.round(m.position.x * 100) / 100,
						Math.round(m.position.y * 100) / 100,
						Math.round(m.position.z * 100) / 100,
					];
					entry.data.rotation = [
						Math.round(THREE.MathUtils.radToDeg(m.rotation.x)),
						Math.round(THREE.MathUtils.radToDeg(m.rotation.y)),
						Math.round(THREE.MathUtils.radToDeg(m.rotation.z)),
					];
					entry.data.scale = [
						Math.round(m.scale.x * 100) / 100,
						Math.round(m.scale.y * 100) / 100,
						Math.round(m.scale.z * 100) / 100,
					];
					this.callbacks.onObjectTransformChange(entry.data);
				}
			}
		});
		this.scene.add(this.transformControls.getHelper());

		// 6. Base Studio Geometry (Floor, Turntable, Projection Screen)
		this.turntableMesh = this.buildStudioBase();
		this.wallMesh = this.buildProjectionWall();

		// 7. Groups
		this.objectGroup = new THREE.Group();
		this.objectGroup.name = "UserObjects";
		this.scene.add(this.objectGroup);

		this.lightFixturesGroup = new THREE.Group();
		this.lightFixturesGroup.name = "LightFixtures";
		this.scene.add(this.lightFixturesGroup);

		// 8. Studio Fill Lighting (Cool sky fill + warm bounce)
		this.hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.45);
		this.hemiLight.position.set(0, 10, 0);
		this.scene.add(this.hemiLight);

		// Remember the real starting values (including Three.js's environment default)
		// so Multi-Light mode can be switched off without affecting other modes.
		this.normalHemiIntensity = this.hemiLight.intensity;
		this.normalEnvironmentIntensity = this.scene.environmentIntensity;

		// 9. Offscreen Silhouette Capture Setup
		// Orthographic camera pointing straight at the backdrop screen at Z = 5.0 facing +Z (screen is at Z = 6.0)
		const wallWidth = 7.0;
		const wallHeight = 4.8;
		this.silhouetteCamera = new THREE.OrthographicCamera(
			-wallWidth / 2,
			wallWidth / 2,
			wallHeight / 2,
			-wallHeight / 2,
			0.1,
			5.0,
		);
		this.silhouetteCamera.position.set(0, 2.4, 5.0);
		this.silhouetteCamera.lookAt(0, 2.4, 6.0);

		this.silhouetteRenderTarget = new THREE.WebGLRenderTarget(
			this.silhouetteResolution,
			this.silhouetteResolution,
			{
				format: THREE.RGBAFormat,
				type: THREE.UnsignedByteType,
				colorSpace: THREE.SRGBColorSpace,
			},
		);
		const silhouetteBufferSize =
			this.silhouetteResolution * this.silhouetteResolution * 4;
		this.silhouettePixels = new Uint8Array(silhouetteBufferSize);
		this.silhouetteReferencePixels = new Uint8Array(silhouetteBufferSize);
		this.silhouetteMaskPixels = new Uint8Array(silhouetteBufferSize);

		// Event listeners
		window.addEventListener("resize", this.onWindowResize);
		this.renderer.domElement.addEventListener(
			"pointerdown",
			this.onPointerDown,
		);

		// Start tick
		this.tick();
	}

	private buildStudioBase(): THREE.Mesh {
		// Studio Floor Grid Texture
		const canvas = document.createElement("canvas");
		canvas.width = 512;
		canvas.height = 512;
		const ctx = canvas.getContext("2d")!;
		ctx.fillStyle = "#0f172a";
		ctx.fillRect(0, 0, 512, 512);

		// Subtle grid lines
		ctx.strokeStyle = "#1e293b";
		ctx.lineWidth = 2;
		const step = 32;
		for (let x = 0; x <= 512; x += step) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, 512);
			ctx.stroke();
		}
		for (let y = 0; y <= 512; y += step) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(512, y);
			ctx.stroke();
		}

		const floorTexture = new THREE.CanvasTexture(canvas);
		floorTexture.wrapS = THREE.RepeatWrapping;
		floorTexture.wrapT = THREE.RepeatWrapping;
		floorTexture.repeat.set(16, 16);
		floorTexture.colorSpace = THREE.SRGBColorSpace;
		floorTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

		const floorGeo = new THREE.PlaneGeometry(36, 36);
		const floorMat = new THREE.MeshStandardMaterial({
			map: floorTexture,
			roughness: 0.8,
			metalness: 0.2,
		});
		const floor = new THREE.Mesh(floorGeo, floorMat);
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		floor.position.y = -0.01;
		this.scene.add(floor);
		this.captureDecor.push(floor);

		// Turntable Pedestal in center
		const pedestalGeo = new THREE.CylinderGeometry(2.2, 2.4, 0.15, 48);
		const pedestalMat = new THREE.MeshStandardMaterial({
			color: 0x1e293b,
			roughness: 0.4,
			metalness: 0.7,
		});
		const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
		pedestal.position.y = 0.075;
		pedestal.receiveShadow = true;
		this.scene.add(pedestal);
		this.captureDecor.push(pedestal);

		// Pedestal glow trim ring
		const trimGeo = new THREE.TorusGeometry(2.22, 0.02, 16, 64);
		const trimMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
		const trim = new THREE.Mesh(trimGeo, trimMat);
		trim.rotation.x = Math.PI / 2;
		trim.position.y = 0.15;
		this.scene.add(trim);
		this.captureDecor.push(trim);

		return pedestal;
	}

	private buildProjectionWall(): THREE.Mesh {
		// Clean matte projection screen backdrop at Z = 6.0
		const screenWidth = 7.0;
		const screenHeight = 4.8;

		const screenGeo = new THREE.PlaneGeometry(screenWidth, screenHeight);
		const screenMat = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 0.95,
			metalness: 0.0,
			polygonOffset: true,
			polygonOffsetFactor: -1,
			polygonOffsetUnits: -1,
		});
		const wall = new THREE.Mesh(screenGeo, screenMat);
		wall.position.set(0, 2.4, 6.0);
		wall.rotation.y = Math.PI; // Face towards the center table / light (-Z)
		wall.receiveShadow = true;
		this.scene.add(wall);

		// Matte black frame border for the screen
		const frameMat = new THREE.MeshStandardMaterial({
			color: 0x0f172a,
			roughness: 0.5,
			metalness: 0.8,
		});
		const frameTop = new THREE.Mesh(
			new THREE.BoxGeometry(screenWidth + 0.3, 0.15, 0.2),
			frameMat,
		);
		frameTop.position.set(0, 4.85, 6.0);
		this.scene.add(frameTop);

		const frameBottom = new THREE.Mesh(
			new THREE.BoxGeometry(screenWidth + 0.3, 0.15, 0.2),
			frameMat,
		);
		frameBottom.position.set(0, -0.05, 6.0);
		this.scene.add(frameBottom);

		const frameLeft = new THREE.Mesh(
			new THREE.BoxGeometry(0.15, screenHeight + 0.2, 0.2),
			frameMat,
		);
		frameLeft.position.set(-screenWidth / 2 - 0.075, 2.4, 6.0);
		this.scene.add(frameLeft);

		const frameRight = new THREE.Mesh(
			new THREE.BoxGeometry(0.15, screenHeight + 0.2, 0.2),
			frameMat,
		);
		frameRight.position.set(screenWidth / 2 + 0.075, 2.4, 6.0);
		this.scene.add(frameRight);

		this.captureDecor.push(frameTop, frameBottom, frameLeft, frameRight);

		return wall;
	}

	// --- Object Management ---

	public setObjects(objects: StudioObject[]) {
		// Clear old objects
		this.transformControls.detach();
		this.selectedObjectId = null;
		this.callbacks.onSelectObject(null);

		while (this.objectGroup.children.length > 0) {
			const child = this.objectGroup.children[0];
			this.objectGroup.remove(child);
			this.disposeObjectHierarchy(child);
		}
		this.objectsMap.clear();

		// Add new objects
		for (const obj of objects) {
			this.addObject(obj, false);
		}
	}

	public addObject(data: StudioObject, autoSelect: boolean = true) {
		const model = createObjectMesh(data.shape, data.color);
		model.position.set(...data.position);
		model.rotation.set(
			THREE.MathUtils.degToRad(data.rotation[0]),
			THREE.MathUtils.degToRad(data.rotation[1]),
			THREE.MathUtils.degToRad(data.rotation[2]),
		);
		model.scale.set(...data.scale);
		model.userData = { id: data.id, shape: data.shape };

		this.objectGroup.add(model);
		this.objectsMap.set(data.id, { model, data });

		if (autoSelect) {
			this.selectObject(data.id);
		}
	}

	public updateObjectTransform(
		id: string,
		pos?: [number, number, number],
		rot?: [number, number, number],
		scl?: [number, number, number],
	) {
		const entry = this.objectsMap.get(id);
		if (!entry) return;

		if (pos) {
			entry.model.position.set(...pos);
			entry.data.position = [...pos];
		}
		if (rot) {
			entry.model.rotation.set(
				THREE.MathUtils.degToRad(rot[0]),
				THREE.MathUtils.degToRad(rot[1]),
				THREE.MathUtils.degToRad(rot[2]),
			);
			entry.data.rotation = [...rot];
		}
		if (scl) {
			entry.model.scale.set(...scl);
			entry.data.scale = [...scl];
		}
	}

	public updateObjectColor(id: string, colorHex: string) {
		const entry = this.objectsMap.get(id);
		if (!entry) return;
		entry.data.color = colorHex;
		const color = new THREE.Color(colorHex);
		entry.model.traverse((child) => {
			if ((child as THREE.Mesh).isMesh) {
				const mesh = child as THREE.Mesh;
				const material = mesh.material as
					| THREE.MeshStandardMaterial
					| undefined;
				if (material?.color) {
					material.color.copy(color);
					if (material.emissive) {
						material.emissive.copy(color).multiplyScalar(0.28);
					}
				}
			}
		});
	}

	public removeObject(id: string) {
		const entry = this.objectsMap.get(id);
		if (!entry) return;

		if (this.selectedObjectId === id) {
			this.transformControls.detach();
			this.selectedObjectId = null;
			this.callbacks.onSelectObject(null);
		}

		this.objectGroup.remove(entry.model);
		this.disposeObjectHierarchy(entry.model);
		this.objectsMap.delete(id);
	}

	public selectObject(id: string | null) {
		if (!id) {
			this.transformControls.detach();
			this.selectedObjectId = null;
			this.callbacks.onSelectObject(null);
			return;
		}

		const entry = this.objectsMap.get(id);
		if (entry) {
			this.selectedObjectId = id;
			this.transformControls.attach(entry.model);
			this.callbacks.onSelectObject(entry.data);
		}
	}

	public setTransformMode(mode: "translate" | "rotate" | "scale") {
		this.transformControls.setMode(mode);
	}

	// --- Lighting Management ---

	/** Remove managed spotlights, their scene targets, and their shadow-map resources. */
	private removeAllLights(): void {
		for (const light of this.lightsMap.values()) {
			this.scene.remove(light);
			if (light.target.parent) {
				light.target.parent.remove(light.target);
			}
			// SpotLight.dispose() also disposes the shadow render target.
			light.dispose();
		}
		this.lightsMap.clear();
	}

	/** Dispose and remove all spotlight rig models. */
	private clearLightFixtures(): void {
		while (this.lightFixturesGroup.children.length > 0) {
			const child = this.lightFixturesGroup.children[0];
			this.lightFixturesGroup.remove(child);
			this.disposeObjectHierarchy(child);
		}
	}

	public setLights(lights: StudioLight[]) {
		// Clear old lights and fixture models
		this.removeAllLights();
		this.clearLightFixtures();

		for (const lightData of lights) {
			this.addOrUpdateLight(lightData);
		}
	}

	public addOrUpdateLight(data: StudioLight) {
		// Fall back to the original rig defaults only for non-finite values.
		// Zero is a meaningful value for penumbra/distance and must not be replaced.
		const distance = Number.isFinite(data.distance) ? data.distance : 30;
		const angle = Number.isFinite(data.angle) ? data.angle : 0.7;
		const penumbra = Number.isFinite(data.penumbra) ? data.penumbra : 0.2;
		const intensity =
			Number.isFinite(data.intensity) && data.intensity > 0
				? data.intensity
				: 0;
		const isEnabled = data.enabled === true;
		const shouldCastShadow = isEnabled && data.castShadow === true;

		let light = this.lightsMap.get(data.id);

		if (!light) {
			light = new THREE.SpotLight(
				new THREE.Color(data.color),
				intensity,
				distance,
				angle,
				penumbra,
				1.0,
			);
			light.shadow.mapSize.width = 2048;
			light.shadow.mapSize.height = 2048;
			light.shadow.camera.near = 0.5;
			light.shadow.camera.far = 30;
			light.shadow.bias = -0.0003;
			light.shadow.normalBias = 0.02;

			this.scene.add(light);
			this.lightsMap.set(data.id, light);

			// Add visual studio spotlight rig
			const fixture = createSpotlightRigModel(data.color);
			fixture.name = `Fixture_${data.id}`;
			this.lightFixturesGroup.add(fixture);
		}

		// A SpotLight aims at a separate Object3D; keep that target in the scene.
		if (!light.target.parent) {
			this.scene.add(light.target);
		}

		// Update all mutable parameters on the existing light object.
		light.color.set(data.color);
		light.intensity = isEnabled ? intensity : 0;
		light.visible = isEnabled;
		light.castShadow = shouldCastShadow;
		light.position.set(...data.position);
		light.target.position.set(...data.targetPosition);
		light.angle = data.angle;
		light.penumbra = data.penumbra;
		light.decay = this.flatLightFalloff ? 0 : 1.0;

		// Update fixture model position, lens colour and aim
		const fixture = this.lightFixturesGroup.getObjectByName(
			`Fixture_${data.id}`,
		) as THREE.Group;
		if (fixture) {
			fixture.position.set(data.position[0], 0, data.position[2]);
			this.updateFixtureLensColor(fixture, data.color);
			const head = fixture.getObjectByName("LightHead");
			if (head) {
				head.position.y = data.position[1];
				head.lookAt(
					data.targetPosition[0],
					data.targetPosition[1],
					data.targetPosition[2],
				);
			}
		}
	}

	/** Keep the visible fixture emitter in sync with the light's configured colour. */
	private updateFixtureLensColor(fixture: THREE.Group, colorHex: string): void {
		fixture.traverse((child) => {
			const mesh = child as THREE.Mesh;
			if (!mesh.isMesh || !mesh.material) return;

			const materials = Array.isArray(mesh.material)
				? mesh.material
				: [mesh.material];
			for (const material of materials) {
				if (material instanceof THREE.MeshBasicMaterial) {
					material.color.set(colorHex);
				}
			}
		});
	}

	/**
	 * Removes spotlight distance falloff so the projected shadow stays readable.
	 * Used by puzzle mode and by the PAGP dashboard's benchmark scene. The studio
	 * background and ambient fill remain identical to the other modes.
	 */
	public setFlatLightFalloff(enabled: boolean) {
		if (this.flatLightFalloff === enabled) return;
		this.flatLightFalloff = enabled;
		for (const light of this.lightsMap.values()) {
			light.decay = enabled ? 0 : 1.0;
		}
	}

	/** Enables capture timing even when no puzzle scorer is attached. */
	public setPerformanceMonitoring(enabled: boolean) {
		this.performanceMonitoring = enabled;
	}

	/**
	 * Enable or disable the reduced-ambient configuration used by the
	 * Multi-Light Studio. Disabling restores the exact values captured at
	 * construction, leaving Sandbox, Puzzle and Anamorphic modes unchanged.
	 *
	 * The shared PMREM environment texture is never removed or disposed; only
	 * Scene.environmentIntensity and the existing HemisphereLight are attenuated.
	 */
	public setMultiLightReducedAmbient(enabled: boolean): void {
		if (enabled) {
			this.hemiLight.intensity = Math.min(
				this.normalHemiIntensity,
				MULTI_LIGHT_HEMI_INTENSITY,
			);
			this.scene.environmentIntensity = Math.min(
				this.normalEnvironmentIntensity,
				MULTI_LIGHT_ENVIRONMENT_INTENSITY,
			);
		} else {
			this.hemiLight.intensity = this.normalHemiIntensity;
			this.scene.environmentIntensity = this.normalEnvironmentIntensity;
		}
	}

	// --- Camera Views & Anamorphic Sweet Spot ---

	public setCameraPreset(
		preset:
			| "orbit"
			| "wall_front"
			| "light_pov"
			| "top_down"
			| "anamorphic_peep"
			| "puzzle_overview",
	) {
		switch (preset) {
			case "orbit":
				this.animateCameraTo(
					new THREE.Vector3(4.5, 3.2, 5.5),
					new THREE.Vector3(0, 1.5, 0.5),
				);
				break;
			case "wall_front":
				// Orthographic-style view looking directly onto the projection screen from the front
				this.animateCameraTo(
					new THREE.Vector3(0, 2.4, -0.5),
					new THREE.Vector3(0, 2.4, 6.0),
				);
				break;
			case "light_pov": {
				// Place camera at Light 1's POV looking down the beam!
				const mainLight = this.lightsMap.values().next().value;
				if (mainLight) {
					const lPos = mainLight.position;
					this.animateCameraTo(
						new THREE.Vector3(lPos.x, lPos.y, lPos.z + 0.3),
						new THREE.Vector3(0, 2.2, 6.0),
					);
				}
				break;
			}
			case "top_down":
				this.animateCameraTo(
					new THREE.Vector3(0, 9.5, 0.5),
					new THREE.Vector3(0, 0, 0.5),
				);
				break;
			case "puzzle_overview":
				// Pull back far enough to frame the spotlight, the objects and the screen together.
				this.animateCameraTo(
					new THREE.Vector3(0, 6.2, -10.5),
					new THREE.Vector3(0, 2.0, 0.5),
				);
				break;
			case "anamorphic_peep":
				if (this.anamorphicSweetSpot) {
					this.animateCameraTo(
						this.anamorphicSweetSpot.pos,
						this.anamorphicSweetSpot.lookAt,
					);
				}
				break;
		}
	}

	public setAnamorphicSweetSpot(
		pos: [number, number, number],
		lookAt: [number, number, number],
	) {
		this.anamorphicSweetSpot = {
			pos: new THREE.Vector3(...pos),
			lookAt: new THREE.Vector3(...lookAt),
		};
	}

	private animateCameraTo(
		targetPos: THREE.Vector3,
		targetLookAt: THREE.Vector3,
	) {
		this.cameraTargetPos = targetPos.clone();
		this.cameraTargetLookAt = targetLookAt.clone();
	}

	// --- Silhouette Extraction for Puzzle Mode ---

	/**
	 * Captures the actual shadow projected onto the wall.
	 *
	 * A reference frame (wall lit, sculpture hidden) is compared with the live
	 * frame (wall + projected shadow). The difference is the real shadow mask,
	 * which is far more reliable than assuming "dark pixel = shadow" when the
	 * studio has ambient fill light.
	 */
	public captureShadowSilhouette(): Uint8Array {
		const currentRenderTarget = this.renderer.getRenderTarget();
		const previousBackground = this.scene.background;
		const previousFog = this.scene.fog;
		const previousClearColor = new THREE.Color();
		this.renderer.getClearColor(previousClearColor);
		const previousClearAlpha = this.renderer.getClearAlpha();

		const helper = this.transformControls.getHelper();
		const previousHelperVisible = helper.visible;
		const previousFixturesVisible = this.lightFixturesGroup.visible;
		const previousObjectsVisible = this.objectGroup.visible;
		const previousDecorVisibility = this.captureDecor.map(
			(object) => object.visible,
		);

		this.scene.background = new THREE.Color(0xffffff);
		this.scene.fog = null;
		this.renderer.setClearColor(0xffffff, 1);
		for (const object of this.captureDecor) object.visible = false;
		this.lightFixturesGroup.visible = false;
		helper.visible = false;

		try {
			// 1. Reference frame: the lit wall with no sculpture in front of it.
			this.objectGroup.visible = false;
			this.renderer.setRenderTarget(this.silhouetteRenderTarget);
			this.renderer.render(this.scene, this.silhouetteCamera);
			this.renderer.readRenderTargetPixels(
				this.silhouetteRenderTarget,
				0,
				0,
				this.silhouetteResolution,
				this.silhouetteResolution,
				this.silhouetteReferencePixels,
			);

			// 2. Live frame: the same wall with the sculpture's projected shadows.
			this.objectGroup.visible = true;
			this.renderer.render(this.scene, this.silhouetteCamera);
			this.renderer.readRenderTargetPixels(
				this.silhouetteRenderTarget,
				0,
				0,
				this.silhouetteResolution,
				this.silhouetteResolution,
				this.silhouettePixels,
			);

			// 3. Difference -> binary white-background / black-shadow mask.
			//    readRenderTargetPixels returns rows bottom-first, while the target
			//    canvas is top-first, so flip vertically before scoring/displaying.
			const width = this.silhouetteResolution;
			const totalPixels = width * width;
			for (let i = 0; i < totalPixels; i++) {
				const sourceIndex = i * 4;
				const sourceX = i % width;
				const sourceY = Math.floor(i / width);
				const destinationIndex =
					((width - 1 - sourceY) * width + sourceX) * 4;

				const referenceLuminance =
					0.2126 * this.silhouetteReferencePixels[sourceIndex] +
					0.7152 * this.silhouetteReferencePixels[sourceIndex + 1] +
					0.0722 * this.silhouetteReferencePixels[sourceIndex + 2];
				const currentLuminance =
					0.2126 * this.silhouettePixels[sourceIndex] +
					0.7152 * this.silhouettePixels[sourceIndex + 1] +
					0.0722 * this.silhouettePixels[sourceIndex + 2];

				// Only a genuine darkening caused by geometry counts as a shadow.
				const isShadow = referenceLuminance - currentLuminance > 6;
				const value = isShadow ? 0 : 255;
				this.silhouetteMaskPixels[destinationIndex] = value;
				this.silhouetteMaskPixels[destinationIndex + 1] = value;
				this.silhouetteMaskPixels[destinationIndex + 2] = value;
				this.silhouetteMaskPixels[destinationIndex + 3] = 255;
			}
		} finally {
			this.objectGroup.visible = previousObjectsVisible;
			this.lightFixturesGroup.visible = previousFixturesVisible;
			helper.visible = previousHelperVisible;
			this.captureDecor.forEach((object, index) => {
				object.visible = previousDecorVisibility[index];
			});
			this.scene.background = previousBackground;
			this.scene.fog = previousFog;
			this.renderer.setClearColor(previousClearColor, previousClearAlpha);
			this.renderer.setRenderTarget(currentRenderTarget);
		}

		// Copy so React always receives a fresh buffer (the internal one is reused).
		return this.silhouetteMaskPixels.slice();
	}

	// --- Raycasting / Object Selection ---

	private onPointerDown = (event: PointerEvent) => {
		// Only handle primary button clicks
		if (event.button !== 0) return;

		const rect = this.renderer.domElement.getBoundingClientRect();
		this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

		this.raycaster.setFromCamera(this.mouse, this.camera);
		const intersects = this.raycaster.intersectObjects(
			this.objectGroup.children,
			true,
		);

		if (intersects.length > 0) {
			// Find top-level model group in objectGroup
			let topMesh: THREE.Object3D | null = intersects[0].object;
			while (topMesh && topMesh.parent !== this.objectGroup) {
				topMesh = topMesh.parent;
			}
			if (topMesh && topMesh.userData.id) {
				this.selectObject(topMesh.userData.id);
				return;
			}
		}

		// If clicked empty space outside gizmo, deselect if not dragging
		if (!this.transformControls.dragging) {
			const gizmoIntersects = this.raycaster.intersectObjects(
				this.transformControls.getHelper().children,
				true,
			);
			if (gizmoIntersects.length === 0) {
				this.selectObject(null);
			}
		}
	};

	private onWindowResize = () => {
		if (!this.container || this.isDestroyed) return;
		const width = this.container.clientWidth;
		const height = this.container.clientHeight;

		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
	};

	// --- Snapshot Export ---

	public captureSnapshot(): string {
		// Render fresh frame and export data URL
		this.renderer.render(this.scene, this.camera);
		return this.renderer.domElement.toDataURL("image/png");
	}

	// --- PAGP performance telemetry ---

	private pollGpuRenderQueries() {
		if (!this.glContext || !this.gpuTimerExtension) return;
		const gl = this.glContext;
		const ext = this.gpuTimerExtension;
		const disjoint = Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT));

		while (
			this.pendingGpuQueries.length > 0 &&
			gl.getQueryParameter(
				this.pendingGpuQueries[0],
				gl.QUERY_RESULT_AVAILABLE,
			)
		) {
			const query = this.pendingGpuQueries.shift()!;
			if (!disjoint) {
				const nanoseconds = Number(
					gl.getQueryParameter(query, gl.QUERY_RESULT),
				);
				this.latestGpuRenderTimeMs = nanoseconds / 1_000_000;
			}
			gl.deleteQuery(query);
		}

		if (disjoint) {
			for (const query of this.pendingGpuQueries) gl.deleteQuery(query);
			this.pendingGpuQueries = [];
			this.latestGpuRenderTimeMs = null;
		}
	}

	private pushSample(samples: number[], value: number) {
		samples.push(value);
		if (samples.length > 180) samples.shift();
	}

	private emitPerformanceMetrics(
		now: number,
		frameTime: number,
		cpuTime: number,
		captureTime: number,
		shadowTime: number,
		drawCalls: number,
		triangles: number,
	) {
		if (frameTime > 0) this.pushSample(this.frameTimes, frameTime);
		this.pushSample(this.cpuTimes, cpuTime);
		this.pushSample(this.captureTimes, captureTime);
		this.pushSample(this.shadowTimes, shadowTime);
		this.pushSample(this.drawCalls, drawCalls);
		this.pushSample(this.triangles, triangles);

		if (
			!this.callbacks.onPerformanceUpdate ||
			now - this.lastPerformanceEmit < 500
		)
			return;
		if (this.frameTimes.length === 0) return;
		this.lastPerformanceEmit = now;

		const average = (values: number[]) =>
			values.length === 0
				? 0
				: values.reduce((sum, value) => sum + value, 0) / values.length;
		const sorted = [...this.frameTimes].sort((a, b) => a - b);
		const p95 =
			sorted[
				Math.min(
					sorted.length - 1,
					Math.floor((sorted.length - 1) * 0.95),
				)
			] ?? 0;
		const frameTimeAvgMs = average(this.frameTimes);

		this.callbacks.onPerformanceUpdate({
			fps:
				frameTimeAvgMs > 0
					? Math.round((1000 / frameTimeAvgMs) * 10) / 10
					: 0,
			frameTimeMs: Math.round(frameTime * 100) / 100,
			frameTimeAvgMs: Math.round(frameTimeAvgMs * 100) / 100,
			frameTimeMinMs: Math.round(sorted[0] * 100) / 100,
			frameTimeMaxMs: Math.round(sorted[sorted.length - 1] * 100) / 100,
			frameTimeP95Ms: Math.round(p95 * 100) / 100,
			cpuTimeMs: Math.round(average(this.cpuTimes) * 100) / 100,
			gpuRenderTimeMs:
				this.latestGpuRenderTimeMs === null
					? null
					: Math.round(this.latestGpuRenderTimeMs * 100) / 100,
			gpuTimingSource:
				this.latestGpuRenderTimeMs === null
					? "CPU fallback (no timer query)"
					: "WebGL2 timer query",
			shadowTimeMs: Math.round(average(this.shadowTimes) * 100) / 100,
			captureTimeMs: Math.round(average(this.captureTimes) * 100) / 100,
			drawCalls: Math.round(average(this.drawCalls)),
			triangles: Math.round(average(this.triangles)),
			sampleCount: this.frameTimes.length,
			timestamp: now,
		});
	}

	// --- Main Tick Loop ---

	private tick = (timestamp: number = performance.now()) => {
		if (this.isDestroyed) return;

		this.pollGpuRenderQueries();

		const frameStart = performance.now();
		const frameTime =
			this.lastFrameTimestamp > 0
				? timestamp - this.lastFrameTimestamp
				: 0;
		this.lastFrameTimestamp = timestamp;
		this.shadowSubmitAccumulator = 0;
		this.renderer.info.reset();

		// Camera preset animation with smooth damping
		if (this.cameraTargetPos && this.cameraTargetLookAt) {
			this.camera.position.lerp(this.cameraTargetPos, 0.08);
			this.cameraLookAtCurrent.lerp(this.cameraTargetLookAt, 0.08);
			this.controls.target.copy(this.cameraLookAtCurrent);
			this.camera.lookAt(this.cameraLookAtCurrent);

			if (
				this.camera.position.distanceTo(this.cameraTargetPos) < 0.04 &&
				this.cameraLookAtCurrent.distanceTo(this.cameraTargetLookAt) <
					0.04
			) {
				this.camera.position.copy(this.cameraTargetPos);
				this.cameraLookAtCurrent.copy(this.cameraTargetLookAt);
				this.controls.target.copy(this.cameraLookAtCurrent);
				this.cameraTargetPos = null;
				this.cameraTargetLookAt = null;
			}
		} else {
			this.controls.update();
		}
		const cpuUpdateMs = performance.now() - frameStart;

		// Render 3D Scene, optionally timed with a WebGL2 GPU timestamp query.
		const renderStart = performance.now();
		const gl = this.glContext;
		const ext = this.gpuTimerExtension;
		let query: WebGLQuery | null = null;
		if (gl && ext && this.pendingGpuQueries.length < 4) {
			query = gl.createQuery();
			if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
		}

		this.renderer.render(this.scene, this.camera);

		if (query && gl && ext) {
			gl.endQuery(ext.TIME_ELAPSED_EXT);
			this.pendingGpuQueries.push(query);
		}
		const renderSubmitMs = performance.now() - renderStart;

		// Periodic silhouette extraction (throttled to every 6 frames ~ 10Hz).
		let captureMs = 0;
		this.silhouetteCounter++;
		if (this.silhouetteCounter % 6 === 0) {
			const captureStart = performance.now();
			if (this.callbacks.onSilhouetteUpdate) {
				const pixels = this.captureShadowSilhouette();
				this.callbacks.onSilhouetteUpdate(
					pixels,
					this.silhouetteResolution,
					this.silhouetteResolution,
				);
			} else if (this.performanceMonitoring) {
				this.captureShadowSilhouette();
			}
			captureMs = performance.now() - captureStart;

			// Check anamorphic sweet spot accuracy if configured
			if (
				this.anamorphicSweetSpot &&
				this.callbacks.onAnamorphicAccuracyChange
			) {
				const dist = this.camera.position.distanceTo(
					this.anamorphicSweetSpot.pos,
				);
				// Angle deviation
				_vec3A
					.subVectors(
						this.anamorphicSweetSpot.lookAt,
						this.camera.position,
					)
					.normalize();
				this.camera.getWorldDirection(_vec3B);
				const angle = _vec3A.angleTo(_vec3B);

				// Distance factor + Angle factor
				const distFactor = Math.max(0, 1 - dist / 3.0);
				const angleFactor = Math.max(0, 1 - angle / 0.5);
				const accuracy = Math.round(distFactor * angleFactor * 100);
				this.callbacks.onAnamorphicAccuracyChange(accuracy);
			}
		}

		const renderInfo = this.renderer.info.render;
		this.emitPerformanceMetrics(
			performance.now(),
			frameTime,
			cpuUpdateMs + renderSubmitMs + captureMs,
			captureMs,
			this.shadowSubmitAccumulator,
			renderInfo.calls,
			renderInfo.triangles,
		);

		this.animationFrameId = requestAnimationFrame(this.tick);
	};

	private disposeObjectHierarchy(obj: THREE.Object3D) {
		obj.traverse((child) => {
			if ((child as THREE.Mesh).isMesh) {
				const mesh = child as THREE.Mesh;
				if (mesh.geometry) mesh.geometry.dispose();
				if (mesh.material) {
					if (Array.isArray(mesh.material)) {
						mesh.material.forEach((m) => m.dispose());
					} else {
						mesh.material.dispose();
					}
				}
			}
		});
	}

	public destroy() {
		this.isDestroyed = true;
		cancelAnimationFrame(this.animationFrameId);

		window.removeEventListener("resize", this.onWindowResize);
		this.renderer.domElement.removeEventListener(
			"pointerdown",
			this.onPointerDown,
		);

		this.removeAllLights();
		this.clearLightFixtures();

		this.transformControls.dispose();
		this.controls.dispose();
		this.silhouetteRenderTarget.dispose();
		if (this.glContext) {
			for (const query of this.pendingGpuQueries) {
				this.glContext.deleteQuery(query);
			}
			this.pendingGpuQueries = [];
		}
		this.renderer.dispose();

		if (this.renderer.domElement.parentElement) {
			this.renderer.domElement.parentElement.removeChild(
				this.renderer.domElement,
			);
		}
	}
}
