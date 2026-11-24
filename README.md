# The Little Sound Archive

An interactive 3D archive of records, tapes and listening objects, with a browser-based Audius music browser and streaming player.

## Requirements

- Node.js 22.12+ (or a compatible current Vite 8 runtime)
- Bun (recommended because this repository includes `bun.lock`), or npm

## Install and run locally

```bash
bun install --frozen-lockfile
cp .env.example .env.local
```

Create a free Audius API key at [Audius API Plans](https://api.audius.co/plans), then set it in `.env.local`:

```dotenv
VITE_AUDIUS_API_KEY=your_public_api_key
```

Start the development server:

```bash
bun run dev
```

The Vite development server runs at `http://127.0.0.1:3000/`. To use npm instead, run `npm install`, then `npm run dev`.

## Audius integration

- The app uses Audius' public read-only catalog API to show weekly trending tracks and search for tracks.
- Publicly streamable, non-gated tracks are loaded directly into the browser with the Audius track-stream endpoint.
- No listener sign-in or OAuth flow is required for public track search and playback. Account actions such as favorites or uploads are not part of this implementation.
- Play/Pause, Stop/reset, Previous/Next within the current search result queue, progress/time display and volume are wired to the browser audio element.
- The stream is routed through the existing Web Audio graph where the browser permits it, so the frequency visualizer reads the actual stream signal. The local procedural demo remains available when a user loads a record from the shelf.
- Track artwork, artist attribution and a link to the Audius source are shown when the API provides them.

### API key and rate limits

The Audius API key used here is a **public client key** and is exposed in the browser bundle by design. The Audius developer documentation currently lists the Free API plan as 10 requests per second and 500,000 requests per month. Check the Audius dashboard for the current plan and limits before launch.

Never put an Audius API secret or user Bearer Token in `VITE_*` variables, frontend code, or a committed file. This project does not need a user token for public catalog search and playback.

### Music rights and attribution

Audius is a catalog and streaming source, not a blanket license for every recording. Artists retain rights and individual tracks can have different licensing and availability settings. The app filters out tracks marked non-streamable or stream-gated, shows the artist and links to the source, but **that does not prove that a track is licensed for every use**. Before using music in promotional, monetized, synchronized or other public/commercial contexts, review the specific track's license and obtain permission where required. Do not download or re-host tracks as part of this integration.

## Scripts

| Script | Command | Purpose |
|---|---|---|
| dev | `node ./node_modules/vite/bin/vite.js --port=3000 --host=0.0.0.0` | Local development server |
| build | `node ./node_modules/vite/bin/vite.js build` | Production build into `dist/` |
| preview | `node ./node_modules/vite/bin/vite.js preview` | Preview the production build |
| lint | `tsc --noEmit` | TypeScript check |
| test | `node --import tsx --test src/utils/audius.test.ts src/utils/shelfMath.test.ts src/utils/visualizerMath.test.ts` | Run unit tests with Node's test runner |

## 3D diagnostics

The Three.js scene, Audius catalog panel and cover editor are loaded as asynchronous chunks; the scene starts after the intro screen. The renderer limits pixel ratio/drawing-buffer size, pauses when the page is hidden or WebGL is unavailable, shares reusable shelf-shadow resources and respects reduced-motion preferences. Press **G** to toggle the diagnostics overlay (FPS, DPR, draw calls, triangles, geometries and textures).

## Deployment

This is a Vite project; use `bun run build` or `npm run build` and publish the generated `dist/` directory. Set `VITE_AUDIUS_API_KEY` in the deployment platform's build-time environment variables. The public API key is bundled into frontend assets, so never use a secret or user token for this variable.
