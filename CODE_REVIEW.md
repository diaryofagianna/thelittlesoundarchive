# The Little Sound Archive — Code Review & 3D Scene Update

Review date: 24 November 2026

## Changes made

- Reused a single shelf-shadow geometry and material instead of creating new GPU resources for every record whenever the shelf is rebuilt.
- Reduced cassette draw calls by batching reel teeth and case screws with `THREE.InstancedMesh`.
- Capped renderer pixel ratio and drawing-buffer pixel count to reduce avoidable high-DPI GPU work; the software-rendering fallback uses a lower cap.
- Added a `ResizeObserver` path so the renderer follows container-size changes, not only browser-window resize events.
- Suspended the render loop while the page is hidden or WebGL context is lost, then resumes on visibility/context restoration.
- Removed GPU-sync polling from the software-rendering scheduler; it now uses a bounded timer instead.
- Disposed the PMREM environment target and shared shelf-shadow resources during scene teardown.
- Guarded custom-cover image decoding against stale asynchronous results.
- Added an optional diagnostics overlay toggled with **G** (FPS, DPR, draw calls, triangles, geometries, textures).
- Disabled pointer parallax when the OS requests reduced motion.
- Removed a duplicate stop call from the Escape-key handler.
- Added an `npm test` script for the existing Node test files.

## Spotify Connect integration

- Added Spotify Authorization Code with PKCE for a browser-only SPA. The frontend uses a public Client ID and no Client Secret; OAuth state, verifier, access token and refresh token are scoped to the current browser tab session.
- Added the `user-read-playback-state` and `user-modify-playback-state` scopes and official Web API calls for available devices, playback-state read, transfer playback, Play/Pause, Previous/Next and volume.
- Added device selection, restricted-device handling, device refresh, token refresh and user-facing errors for expired sessions, missing playback devices, unsupported volume, rate limits and denied playback commands.
- Routed the actual 3D CD, cassette and vinyl hardware controls plus the bottom transport dock to the selected Spotify Connect device when remote-control mode is enabled. Stop maps to Pause because there is no Stop-and-reset Player endpoint.
- Debounced volume-slider/knob commands to avoid flooding the remote volume endpoint. Leaving the 3D room does not pause music on the external Spotify device.
- Kept the Spotify Embed player as an independent fallback; it is not the same as Connect remote mode and does not route hardware buttons.
- Kept Spotify mode separate from the local procedural audio state. Do not drive platter/reel motion, VU/spectrum meters, progress or scene animation from Spotify audio or playback timing: Spotify's Developer Policy prohibits synchronization of recordings with visual media.
- Added `.env.example` and setup documentation for `VITE_SPOTIFY_CLIENT_ID` and an exact allowlisted `VITE_SPOTIFY_REDIRECT_URI`. No Spotify credentials are prefilled; each deployment must be registered in the Spotify Developer Dashboard.

### Spotify Connect verification notes

- Spotify integration code uses browser PKCE and the official Web API endpoints; device selection is explicit and the app does not silently transfer playback to an inactive device during panel refresh.
- Full real-account verification requires the owner's Spotify Developer app, allowlisted redirect URI, Premium account, an available Connect device and valid Development Mode user access. The current environment had no installed npm dependencies or configured Spotify app, so live playback was not tested.
- Spotify Development Mode limits and policy constraints are described in the README; do not treat this personal Development Mode prototype as an approved commercial streaming integration.

## Verification

- All 21 TypeScript/TSX source files passed a TypeScript transpilation/syntax pass (0 syntax errors).
- `src/utils/spotifyConnect.ts` passed a standalone strict TypeScript check.
- All existing unit tests: 17 passed, 0 failed (shelf navigation/math, Spotify link parsing and visualizer math).
- Full-project `tsc --noEmit` and the Vite production build could not be completed because project dependencies were not present and dependency installation timed out. No claim is made that a dependency-resolved build or live Spotify/browser/WebGL test passed.

## Recommended local verification

```bash
npm install
npm run lint
npm test
npm run build
```

Then test the shelf filters, record selection, CD/cassette/vinyl player controls, cover replacement, tab hide/show, browser resize, reduced-motion preference, and WebGL context restoration. Press **G** to inspect live renderer counters.

## Technical references

- Three.js responsive rendering and drawing-buffer pixel budgeting: https://threejs.org/manual/pages/responsive.html
- Three.js resource disposal: https://threejs.org/manual/pages/how-to-dispose-of-objects.html
- Three.js `InstancedMesh` API (reduces draw calls for repeated geometry/material): https://threejs.org/docs/pages/InstancedMesh.html
- Three.js WebGLRenderer diagnostics/shadow-map controls: https://threejs.org/docs/pages/WebGLRenderer.html
- React Three Fiber performance guidance (object reuse, instancing, frame-loop updates): https://r3f.docs.pmnd.rs/advanced/pitfalls

- Spotify Authorization Code with PKCE: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- Spotify Get Available Devices: https://developer.spotify.com/documentation/web-api/reference/get-a-users-available-devices
- Spotify Transfer Playback: https://developer.spotify.com/documentation/web-api/reference/transfer-a-users-playback
- Spotify Developer Policy: https://developer.spotify.com/policy
