# Fluid-Audio Architecture, Pipelines, and Implementation Notes

This document is a high-signal reference for the fluid simulation application, focusing on architecture, dataflow, extension points, and actionable notes for future development. It intentionally avoids restating self-documenting code.

## High-level overview

- **Two-browser modes**
  - **Server mode** (`?mode=server`): Runs the WebGL2 renderer, audio capture/analysis, app orchestration, and optional recording.
  - **HUD mode** (`?mode=hud`): Runs a dat.GUI control surface with MIDI support. Communicates with Server via `BroadcastChannel`.

- **Core loop (Server)**
  - Capture audio via Web Audio → `AnalyserNode` → GPU `AudioTexture` (1×N, R32F).
  - Generate a 1×W color strip via `ColorTexture`.
  - Run selected app: emit color/velocity fields → feed the fluid solver.
  - Fluid solver runs divergence, pressure iterations, gradient subtraction, and advection for velocity and dye, then renders dye to screen.
  - Optionally capture frames to MP4.

```mermaid
flowchart LR
  subgraph UI
    HUD[HUD (dat.GUI + MIDI)]
  end

  subgraph App
    Soak[SoakApp]
    Grid[GridApp]
    Hist[HistApp]
  end

  subgraph Media
    AC[(AudioContext)] --> AN[AnalyserNode]
    AN --> AT[AudioTexture (1xN R32F)]
    CT[ColorTexture (1xW RGBA)]
  end

  HUD <--->|BroadcastChannel| Server

  Server[Server (WebGL2)] --> |select| Soak
  Server --> |select| Grid
  Server --> |select| Hist
  Server --> CT
  Server --> AT

  subgraph Fluid
    E[Emitter(s): color/velocity buffers]
    D[(Dye RGBA16F ping-pong)]
    V[(Velocity RG16F ping-pong)]
    Div[(Divergence R16F)]
    P[(Pressure R16F ping-pong)]
  end

  Soak --> E
  E --> |blend| D & V
  D & V --> |advect| V
  V --> |advect| D
  V --> |divergence| Div --> |Jacobi| P --> |subtract grad| V
  D --> |render to screen| Server

  Server -->|optional| Rec[MP4 Recorder]
```

## Entry points and boot

- `index.html`: loads `static/src/main.js` and vendor libs.
- `static/src/main.js`: selects module by `?mode` param and calls `run()`.
  - `?mode=server` → `static/src/server.js`.
  - `?mode=hud` → `static/src/hud.js`.

## Inter-process UI messaging

- `BroadcastChannel` abstraction in `static/src/channel.js` provides `SendChannel` and `RecieveChannel`.
- HUD requests props, displays sliders/buttons, maps MIDI to props, and sends changes back to Server.
- Server aggregates props from active app and subsystems and broadcasts to HUD.

## Rendering, apps, and composition

- `static/src/server.js` (class `Server`)
  - Initializes WebGL2, viewport, audio, `AudioTexture`, `ColorTexture`.
  - App registry: `SoakApp`, `GridApp`, `HistApp`. Default: `SoakApp`.
  - Per-frame: update audio/color textures → `app.execute(...)` → optional MP4 frame capture → schedule next frame.
  - Props: combines app props + audio/color props; HUD reflects live params.

- App contracts
  - Each app exposes `PROPS` and `execute({timestamp, params, audioPowerTexture, colorTexture})`.
  - Apps compose emitters and the fluid solver as needed.

- `SoakApp`: audio-reactive jets into the fluid
  - `apps/soak/soakApp.js` composes `JetEmitter` + `FluidApp`.
  - Execution: update emitter → blend into `FluidApp` inputs → run fluid substeps → render dye.

- `GridApp` and `HistApp`: overlay visualizations
  - Read-only visual layers; each has minimal `PROPS` and uses `ShaderProgram` with simple fragment shaders.

## Audio pipeline → GPU texture

- Microphone capture via `navigator.mediaDevices.getUserMedia({audio:true})`.
- `AnalyserNode` with smoothing + `fftSize` feeds `AudioTexture`.
- `AudioTexture` writes a 1×N R32F texture of normalized magnitudes and applies windowed selection/gain in a shader.

## Color pipeline → GPU texture

- `ColorTexture` samples a source image strip and scrolls vertically; exposes X window [start,length] and Y drift prop.

## Fluid solver (semi-Lagrangian)

- Implemented in `static/src/shaders/fluid/fluid.js` (`class FluidApp`). Key buffers:
  - `dyeBuffer`: RGBA16F ping-pong (color/density).
  - `velocityBuffer`: RG16F ping-pong (2D velocity field).
  - `divergence`: R16F.
  - `pressure`: R16F ping-pong.

- Per substep:
  - Compute `divergence(velocity)`.
  - Jacobi iterate pressure for N steps.
  - Subtract gradient from velocity.
  - Advect velocity by velocity with global decay.
  - Advect dye by velocity with global decay.
  - Before stepping, blend-in emitter color/velocity contributions using additive blending.

## Emitters

- `JetEmitter` (audio-reactive perimeter/spiral jets)
  - Produces two textures per frame: `colorBuffer` (RGBA16F) and `velocityBuffer` (RG16F).
  - Internally: generates instance data (location, per-jet radii, per-jet color, per-jet velocity vector). Radii and vectors are modulated by `AudioTexture`.
  - Uses `SplatShader` to efficiently place many circular contributions via instancing, with configurable blending.

- `SimpleEmitterKernel` (single circular jet) and `RingEmitter` (ring-shaped disturbance) offer simpler building blocks.

- `BlackWhiteEmitter` (debug/simple pattern) for testing.

## Props and controls (HUD + MIDI)

- Server aggregates `PROPS` arrays emitted by the active app and subsystems into a single prop list and sends to HUD.
- HUD builds dat.GUI controllers for each prop, enables MIDI, and maps MIDI sliders/buttons to props (mapping defined in `hud.js`).

Key props used in the default `Soak` flow (names as in code):

- Fluid solver
  - `GlobalAlphaDecay`: dye decay during advection.
  - `GlobalSpeedDecay`: velocity decay during advection.
  - `PRESSURE_STEPS`, `SUBSTEPS`, `DT`, `SIM_SCALE` (in Server’s `FLUID_PARAMS`).

- Emitter (JetEmitter)
  - `JetCount`, `JetColorAlpha`, `JetSourceSize`, `JetLength`, `JetSpeed`, `JetRotate`, `PerimeterRotate`, `PerimeterRadius`, `SpiralLoops`, `SpiralInward`.

- Grid overlay
  - `BlockAlpha`, `GridSize`, `BlockCount`, `BlockMargin`, `BlockBlur`.

- Audio and color
  - `AudioStart`, `AudioLength`, `AudioGain`.
  - `ColorXStart`, `ColorXLength`, `ColorYDrift`.

Also see `README.md` for a friendly mapping of many of these knobs.

## GL utilities

- `static/src/glHelper.js` (`GLHelper`)
  - FBO creation, program creation, uniform inference, and an execution helper. Used widely by non-fluid modules.

- `static/src/shaders/fluid/gl.js` (`ShaderProgram` + helpers for the fluid stack)
  - Lightweight program wrapper optimized for full-screen passes; includes aspect-ratio handling and simple blending/clear.

## Recording

- `Mp4Recorder` uses WebCodecs + `mp4-muxer` to produce a single MP4 with optional microphone audio. Frames are captured from the canvas at a fixed FPS in the render loop.

## Extension points and recipes

- Add a new app
  - Create `class YourApp { PROPS = [...]; execute({timestamp, params, audioPowerTexture, colorTexture}) { ... } }`.
  - Register in `Server.apps` and set `selectedApp`.
  - If your app needs the fluid, compose emitters and `FluidApp` like `SoakApp`.

- Add a new emitter to `SoakApp`
  - Implement an emitter that writes to `colorBuffer` (RGBA16F) and `velocityBuffer` (RG16F) and expose its `PROPS`.
  - In `SoakApp.execute`, blend emitter buffers into `FluidApp` via `updateColor` and `updateVelocity` before stepping.

- Add a new prop appearing in HUD
  - Extend a module’s `PROPS` with `[name, defaultValue]`.
  - Ensure the Server collects these (it concatenates active app + media props) and re-sends via `sendProps()`.
  - HUD will auto-create sliders; MIDI mapping is auto-assigned in `hud.js` (`sortedSliderKeys` / `sortedButtonKeys`).

- Use AudioTexture in a shader
  - Sample `uAudioSource` or a filtered copy with `uStart`, `uLength`, `uGain` in your fragment shader. Keep in mind the texture is linear in frequency bins.

- Recording considerations
  - Start/stop via HUD buttons (mapped to `Server.onHudRequestRecordStart/Stop`).
  - Avoid overly high FPS or canvas sizes to keep encoder real-time.

## Performance notes

- Texture formats: RGBA16F for dye, RG16F for velocity, R16F for divergence/pressure, R32F for audio texture.
- Extensions: `EXT_color_buffer_float`, `OES_texture_float_linear` are requested.
- Cost knobs: `SIM_SCALE`, `PRESSURE_STEPS`, `SUBSTEPS`.
- Blending: color uses ONE, ONE_MINUS_SRC_ALPHA; velocity uses ONE, ONE for accumulation.
- Keep `JET_COUNT`, `BLOCK_MAX`, and FFT size reasonable to avoid fragment pressure.

## Known issues and suggested fixes

- Undefined var used in resize callback
  - File: `static/src/server.js`
```js
// inside _onResize():
if (typeof this.app.resize === "function") {
  this.app.resize({ width: w, height: h, dpr }); // dpr is undefined
}
```
  Fix: pass `window.devicePixelRatio` or omit until needed.

- `SimpleJetApp.execute` uses an undefined `fluidParams`
  - File: `static/src/apps/simpleJetApp.js`
```js
this.fluid.execute({
  dt: fluidParams.DT,              // should be this.fluidParams.DT
  subSteps: fluidParams.SUBSTEPS,  // should be this.fluidParams.SUBSTEPS
  pressureSteps: fluidParams.PRESSURE_STEPS,
  ...
})
```
  Fix: store `fluidParams` on `this` in constructor and reference `this.fluidParams`.

- `audioNetwork.loadAudioDeviceSource` constructs constraints with an undefined key
  - File: `static/src/media/audioNetwork.js`
```js
let constraint = { audio: true }
if (deviceId != null) {
  constraint[audio] = { deviceId: { exact: deviceId } } // 'audio' identifier is wrong
}
```
  Fix: `constraint.audio = { deviceId: { exact: deviceId } }`.

- `Mp4Recorder.onAudioAddChunk` calls a misspelled muxer method
  - File: `static/src/media/mp4Recorder.js`
```js
onAudioAddChunk(chunk, meta) {
  this.muxer.addAudioCHunk(chunk, meta) // typo: addAudioCHunk
}
```
  Fix: `addAudioChunk`.

- GLSL version/style mismatch in fluid shader module vs WebGL2 context
  - File: `static/src/shaders/fluid/fluid.js` uses ES 1.00 style (`attribute`, `varying`) with no `#version`.
  - The rest of the app uses `#version 300 es` and `in/out` in many places.
  - Standardize on ES 300: add `#version 300 es`, convert `attribute`→`in`, `varying`→`out/in`, and define explicit outputs.

- Color asset may be missing
  - File: `static/src/media/colorTexture.js` loads `/static/images/color.jpg`. Ensure the image exists in the repo or adjust path.

- Optional: `AudioTexture` computes `min/max` from `audioBuffer` which is not populated (uses `byteFrequencyData` instead). Not harmful; remove unused vars for clarity.

- Recording audio source
  - `Mp4Recorder` expects `audioSource.mediaStream` when `audioSource` is a `MediaStreamAudioSourceNode`. Some browsers expose `mediaStream`, others may not; be prepared to pass the original `MediaStream` explicitly if needed.

## Future improvements

- Fluid fidelity: vorticity confinement, viscosity, proper boundary conditions, MacCormack advection.
- Resolution scaling: dynamic `SIM_SCALE` based on device performance.
- Resize support: plumb size changes into apps (recreate FBOs on resize).
- Preset system: save/load prop sets; MIDI map export/import.
- Robustness: unify GLSL versions; guard optional subsystems; route build-time errors to HUD.

## File map (key modules)

- Entry/UI: `index.html`, `static/src/main.js`, `static/src/hud.js`, `static/src/channel.js`
- Server/render loop: `static/src/server.js`
- Fluid: `static/src/shaders/fluid/fluid.js`, `static/src/shaders/fluid/gl.js`
- Emitters: `static/src/apps/soak/jetEmitter.js`, `static/src/emitters/simpleEmitter.js`, `static/src/emitters/ringEmitter.js`, `static/src/apps/soak/blackWhiteEmitter.js`
- Visual apps: `static/src/apps/soak/soakApp.js`, `static/src/apps/gridApp.js`, `static/src/apps/histApp.js`
- Media: `static/src/media/audioTexture.js`, `static/src/media/colorTexture.js`, `static/src/media/audioNetwork.js`, `static/src/media/mp4Recorder.js`
- GL utils: `static/src/glHelper.js`, `static/src/shaders/fluid/gl.js`
- Server runtime: `server.py` (HTTPS local server with self-signed cert)

## Quick dev notes

- Start server: `python server.py` then open `https://localhost:PORT?mode=server` and `?mode=hud` in separate tabs.
- Click canvas to start audio (permission prompt) and rendering.
- If recording: ensure secure context (HTTPS) and that WebCodecs are available.