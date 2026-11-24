# Mobile Responsive QA & Fix v1

Date: 2026-11-24
Project: The Little Sound Archive
Target: Vite / React / Three.js

## Changes

- Reflowed the top metadata and action area for narrow viewports; mobile actions use icon-first buttons with accessible labels.
- Simplified the header at widths up to 320 CSS px so secondary metadata does not crowd the 3D record.
- Increased mobile control targets to at least 44 CSS px.
- Made the bottom dock fit narrow widths, scroll vertically when its content is taller than the available mobile area, and keep section tabs horizontally scrollable.
- Added viewport-fit=cover, dynamic viewport sizing, and iOS top/bottom safe-area spacing.
- Kept the existing Three.js scene, camera resize observer, desktop layout, colors, and typography.

## Verification

Local production build and browser preview were tested with Chromium 159.0.8154.6 and Playwright mobile emulation (touch enabled, device scale factor 2).

| Viewport | Shelf | Player | Result |
| --- | --- | --- | --- |
| 275 × 598 | Pass | Pass | Pass |
| 320 × 568 | Pass | Pass | Pass |
| 320 × 720 | Pass | Pass | Pass |
| 360 × 780 | Pass | Pass | Pass |
| 375 × 812 | Pass | Pass | Pass |
| 390 × 844 | Pass | Pass | Pass |
| 430 × 932 | Pass | Pass | Pass |
| 1280 × 800 | Pass | Not part of mobile flow | Pass |

Assertions covered:
- No document-level horizontal overflow.
- Header actions and dock stay within viewport bounds.
- Mobile buttons meet a 44 CSS px minimum height.
- The Load record in player action opens Player mode.
- The last hardware section (Keys) is reachable by horizontally scrolling the section tabs.
- No browser JavaScript page errors during the checks.

## Build and test commands

- pnpm build — passed.
- pnpm lint — passed.
- pnpm test — 27 passed, 0 failed.
- git diff --check — passed.

The Vite production build reports the existing Three.js scene chunk is larger than 500 kB after minification. This warning was not introduced by the responsive changes and was left out of scope.

## Scope note

These are Chromium viewport and touch emulation checks. They do not replace final validation on physical iOS and Android devices, including real notch/home-indicator safe areas and native install prompts.
