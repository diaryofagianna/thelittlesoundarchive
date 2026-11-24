# The Little Sound Archive

An interactive 3D archive of records, tapes and listening objects, with a browser-based Spotify Connect remote.

## Requirements

- Node.js 22.12+ (or a compatible current Vite 8 runtime)
- Bun (recommended because this repository includes `bun.lock`), or npm

## Install and run locally

```bash
bun install
cp .env.example .env.local
# Set VITE_SPOTIFY_CLIENT_ID if you want to enable Spotify Connect
bun run dev
```

The Vite development server runs at `http://127.0.0.1:3000/`. To use npm instead, run `npm install`, then `npm run dev`.

## Scripts

| Script | Command | Purpose |
|---|---|---|
| dev | `vite --port=3000 --host=0.0.0.0` | Local development server |
| build | `vite build` | Production build into `dist/` |
| preview | `vite preview` | Preview the production build |
| lint | `tsc --noEmit` | TypeScript check |
| test | `tsx --test src/utils/*.test.ts` | Run unit tests |

## Spotify Connect setup

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Copy its **Client ID**. This browser-only app uses Authorization Code with PKCE; do **not** create, add or expose a Client Secret.
3. Add the exact redirect URI to the app's Redirect URI allowlist. For local development, use `http://127.0.0.1:3000/`. For a deployment, add the exact HTTPS callback URL for that deployment.
4. Set the environment variables in `.env.local` locally, or in the hosting provider's environment-variable settings:

   ```dotenv
   VITE_SPOTIFY_CLIENT_ID=your_client_id
   VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/
   ```

5. Open Spotify on a device, start playback, then open the app's Spotify panel, connect your account and select an available Connect device.

The OAuth app requests `user-read-playback-state` and `user-modify-playback-state`. Tokens are held in the current browser tab's `sessionStorage`. Do not commit `.env.local` or any real credentials.

## Spotify playback modes

- **Spotify Connect Remote** sends Play/Pause, Previous/Next and supported volume commands to the selected Spotify Connect device. The selected device remains the audio output; the browser is a remote control.
- **Spotify Embed** is a separate fallback player and does not route the 3D hardware controls.
- Local procedural audio is separate from Spotify playback. Spotify audio timing must not drive platter/reel motion, meters, progress or visualizers.

Spotify playback-control and transfer endpoints require an eligible Premium account. Development Mode access and policy restrictions may apply; verify the current Spotify Developer Dashboard requirements before sharing the app or using it commercially.

## 3D diagnostics

The renderer limits pixel ratio/drawing-buffer size, pauses when the page is hidden or WebGL is unavailable, shares reusable shelf-shadow resources and respects reduced-motion preferences. Press **G** to toggle the diagnostics overlay (FPS, DPR, draw calls, triangles, geometries and textures).

## Deployment

This is a Vite project; use `npm run build` or `bun run build` and publish the generated `dist/` directory. Configure the two Spotify environment variables in the deployment platform and register the exact deployed redirect URI in the Spotify Developer Dashboard.
