# ShadowPlay

ShadowPlay is an interactive 3D shadow sculpting and optical illusion studio. It turns a virtual stage, a set of lights, and a projection wall into a hands-on way to explore geometry, perspective, and shadow behavior. Arrange objects, move lights, and shape the shadows they cast, or use the built-in challenges to test what you have learned.

## Features

- **Sandbox:** Free-form scene editing with movable objects, adjustable lights, camera presets, and transform gizmos.
- **Shadow Puzzles:** Fifteen levels that ask you to recreate a target shadow by positioning objects and lights. Each attempt is scored with intersection-over-union and shape validation.
- **Anamorphic Illusions:** Nine scenes made of scattered 3D fragments that resolve into a single image only from the correct sweet-spot viewpoint. Camera alignment is scored in real time.
- **Multi-Light Studio:** Overlapping colored lights with RGB/CMY presets and challenges about how colored light combines and how blocked light changes the result.
- **Performance Lab (PAGP):** Live frame and GPU telemetry plus a benchmark comparing CPU shadow-mask scoring against a WebGPU compute shader.
- **Learning Aids:** In-app concept explainers and a WebXR roadmap panel.
- **Scene Tools:** Screenshot capture, scene import/export as JSON, snapping transforms, and keyboard shortcuts.

## Controls

- Drag to orbit the camera; scroll to zoom.
- Select an object to translate, rotate, or scale it with `T`, `R`, and `S`.
- `Delete` removes the selected object; `Escape` deselects it.

## Tech

React 19, TypeScript, Three.js, Vite, Tailwind CSS, WebGL2, and optional WebGPU compute.
