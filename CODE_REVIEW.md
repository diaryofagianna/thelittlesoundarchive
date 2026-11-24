# The Little Sound Archive — Code Review & Audius Player Migration

Review date: 24 November 2026

## Existing 3D and performance work retained

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
- Kept the Node test script for the existing utility test files.

## Audius streaming integration

- Replaced the former external music browser with `AudiusPanel.tsx`, including weekly trending tracks, text search, track artwork, artist metadata and a link to each Audius source page.
- Added `src/utils/audius.ts` for public read-only track search, trending catalog retrieval, streamability/gating filtering, safe source links and HTML media stream URLs.
- Removed the previous provider-specific URL parser, player component, Connect client, PKCE flow, OAuth callback handling, scopes, token/session storage and provider configuration.
- Added `VITE_AUDIUS_API_KEY` as the only provider configuration. It is a public client key; no API secret or user Bearer Token is used by this public catalog feature.
- Routed public track streams through the browser's `HTMLAudioElement` into the existing Web Audio graph where supported. The frequency visualizer can therefore read the live stream analyser rather than relying only on the procedural pulse.
- Connected the player dock's Play/Pause, Stop/reset, Previous/Next queue controls, elapsed/duration readout and volume slider to the external track.
- Preserved the built-in procedural audio path when users load records from the 3D shelf.
- Preserved artist/title attribution and a link to the Audius source. Public streamability is not treated as a blanket commercial or synchronization license; track rights must be reviewed individually.

## Audius API references

- Audius SDK / developer getting started: https://docs.audius.co/SDK
- Audius API reference: https://docs.audius.co/
- Audius API key and plan management: https://api.audius.co/plans
- Audius terms: https://audius.co/terms-of-service

## Release performance and Windows runner follow-up

- The first production build completed with Node 22.16 and Vite 8.3.8; the entry bundle was 1,158.54 KB minified (351.48 KB gzip), which triggered Vite's 500 KB chunk warning.
- The 3D ListeningRoomScene is now imported asynchronously after the intro screen, and AudiusPanel/CoverEditorModal are lazy-loaded when opened. This lets Vite/Rolldown emit separate async chunks instead of putting all of those modules into the initial entry chunk.
- Vite config uses `import.meta.dirname`, supported by the project's Node 22.16 runtime, instead of the legacy `__dirname` global.
- The dev/build/preview/test scripts call the Vite CLI and Node test runner through Node explicitly. This avoids the generic `bun: unknown error` observed when Bun 1.4.4 launched Vite and `tsx` on this Windows machine.

## Verification status

- All 20 TS/TSX source files passed a TypeScript 5.8 transpilation/syntax pass (0 syntax diagnostics).
- `src/utils/audius.ts` passed a focused strict TypeScript check.
- All 16 unit tests passed (Audius normalization/link safety, shelf utilities and visualizer math). They were run using Node 22.16's native TypeScript type-stripping with a temporary resolver for this project’s extensionless TypeScript imports.
- `npm install --ignore-scripts --no-audit --no-fund --no-package-lock` timed out in this environment and did not create `node_modules`.
- As a result, the repository's regular `npm run lint`, `npm test` and `npm run build` commands could not run here: `vite/client`, `tsx` and `vite` are unavailable without the dependencies. No dependency-resolved full-project typecheck or Vite production build is claimed.
- The project owner subsequently confirmed a successful local preview: Audius trending catalog populated and a public track streamed in the browser with the live visualizer indicator active. Actual speaker output and the full transport/edge-case matrix still need manual confirmation.

## Recommended local verification

```bash
bun install --frozen-lockfile
Copy-Item .env.example .env.local
# Add VITE_AUDIUS_API_KEY to .env.local
bun run lint
bun run test
bun run build
bun run preview
```

Then test trending/search, opening and closing the panel, Play/Pause, Stop then Play, Previous/Next, volume, elapsed/duration, spectrum response, switching back to the built-in shelf player, browser tab visibility and WebGL context restoration.
