# Architecture & CSS System

## Entry point

**`index.html`** — single-page app shell:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0d1b35" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Angle Explorer" />
    <title>Angle Explorer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**`src/main.tsx`** — React 19 strict mode mount:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
```

**`src/App.tsx`** — renders two components at root level:
```tsx
import ArcadeAngleScreen from "./screens/ArcadeAngleScreen";
import RotatePrompt from "./components/RotatePrompt";

export default function App() {
  return (
    <>
      <RotatePrompt />
      <ArcadeAngleScreen />
    </>
  );
}
```

`RotatePrompt` overlays a portrait-mode warning on touch devices in portrait orientation.
`ArcadeAngleScreen` owns all game state and renders itself.

Note: unlike the template, there is no `I18nProvider` wrapper yet. When i18n is added
it will wrap both components here. See `specs/i18n.md`.

---

## TypeScript config

`tsconfig.json` references `tsconfig.app.json` and `tsconfig.node.json`.

`tsconfig.app.json` key settings:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "jsx": "react-jsx"
  }
}
```

---

## Vite config (`vite.config.ts`)

```ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
```

Key config:
- `base: '/'`
- Dev server: `port: 4002, strictPort: true`
- `npm run dev` script pre-kills any process on port 4002 before starting
- Plugins: react, tailwindcss, `localApiPlugin()`, VitePWA

**`localApiPlugin(env)`** — custom Vite plugin that reads env vars via `loadEnv` and
mounts one dev middleware route mirroring the Vercel serverless function:
- `POST /api/send-report` → calls Resend

Note: `/api/translate` is not yet present (will be added with i18n feature).

**VitePWA** config:
```ts
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
  manifest: false,  // manifest.json is manually managed in public/
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    runtimeCaching: [{
      urlPattern: /^https:\/\//,
      handler: 'NetworkFirst',
      options: { cacheName: 'external-cache', networkTimeoutSeconds: 10 },
    }],
  },
})
```

---

## Package scripts

```json
"dev":      "lsof -ti :4002 | xargs kill -9 2>/dev/null; vite"
"prebuild": "node scripts/stamp-manifest.mjs stamp"
"build":    "tsc -b && vite build"
"postbuild":"node scripts/stamp-manifest.mjs restore"
"lint":     "eslint ."
"preview":  "vite preview"
```

`stamp-manifest.mjs` writes a `buildHash` into `public/manifest.json` before the
production build, then restores the original after. This fingerprints the PWA for
cache busting without committing dynamic values to git.

---

## CSS system (`src/index.css`)

### Font setup

```css
@import "tailwindcss";

@font-face {
  font-family: 'DSEG7Classic';
  src: url('dseg/fonts/DSEG7-Classic/DSEG7Classic-Regular.woff2') format('woff2'), ...;
  font-weight: 400;
}
@font-face {
  font-family: 'DSEG7Classic';
  src: url('dseg/fonts/DSEG7-Classic/DSEG7Classic-Bold.woff2') format('woff2'), ...;
  font-weight: 700;
}

:root {
  font-family: "Courier New", "Lucida Console", monospace;
  color: #f8fafc;
  background: #020617;
}
body { margin: 0; }
#root { min-height: 100svh; }
```

### Keyframe animations

| Name | Description | Usage |
|------|-------------|-------|
| `bounce-in` | scale 0.3→1.08→1, opacity 0→1 | modal entry |
| `shake` | horizontal ±8px wobble | wrong answer |
| `pop` | scale 1→1.18→1 | button press |
| `float` | vertical ±8px sine, 3s | tutorial hint |
| `ripple-expand` | scale 0→1, opacity 0.9→0 | (unused in this game) |
| `autopilot-blink` | opacity 0.3↔1, cyan glow 0→14px, 2s | autopilot robot icon |
| `pulse-ring` | scale pulsing | fire-button hint ring |
| `explode-ring` | scale 0→2.5, opacity 1→0 | shot explosion |
| `explode-core` | scale 1→0, opacity 1→0 | explosion center |
| `tutorial-fire-grow` | scale 0→1 entry animation | fire button hint |
| `tutorial-fire-pulse` | gentle scale pulse, 1.05s | fire button hint |
| `flash-correct` | green screen flash | correct shot feedback |
| `flash-wrong` | red screen flash | wrong shot feedback |
| `cannon-recoil` | backward nudge animation | cannon fires |

### Arcade utility classes

**.font-arcade** — monospace with 0.06em letter spacing.

**.arcade-grid** — dark grid background (22×22px, white lines at 6% opacity).
Used on the outermost game container div.

**.arcade-panel** — game widget panel:
```css
border: 4px solid rgba(255,255,255,0.7);
border-radius: 14px;
background: rgba(15, 23, 42, 0.97);
box-shadow: 0 0 0 4px rgba(15,23,42,0.8), 0 18px 40px rgba(0,0,0,0.3);
```

**.digital-meter** — DSEG7 numeric display style:
```css
font-family: 'DSEG7Classic', "Courier New", monospace;
font-weight: 700;
letter-spacing: 0.12em;
text-shadow: 0 0 14px rgba(103,232,249,0.6);
font-variant-numeric: tabular-nums lining-nums;
```

**.arcade-button** — orange pill button with yellow border:
```css
border: 3px solid #fef08a;
border-radius: 9999px;
background: linear-gradient(180deg, #f97316, #ea580c);
color: white;
font-weight: 900;
letter-spacing: 0.1em;
text-transform: uppercase;
```

### Social CSS

All social CSS classes (`.social-launchers`, `.social-drawer`, `.social-share-drawer`,
`.social-comments-drawer`, `.social-backdrop`, `.social-new-comment`, etc.) are
defined in `index.css` — not via Tailwind. See `specs/deployment.md` for social wiring.

---

## Key constants (defined in `ArcadeAngleScreen.tsx`)

```ts
const IS_DEV = import.meta.env.DEV;
const ANSWER_CHEAT_CODE = "197879";
const AUTOPILOT_EMAIL = import.meta.env.VITE_AUTOPILOT_EMAIL ?? "amarsh.anand@gmail.com";
const IS_LOCALHOST_DEV = IS_DEV && ['localhost','127.0.0.1','::1'].includes(location.hostname);

// SVG canvas dimensions
const W = 480;                // SVG viewBox width
const H = 340;                // SVG viewBox height
const CX = 240;               // cannon pivot X
const CY = 170;               // cannon pivot Y
const BEAM_LEN = 150;         // aiming ray length (px in SVG units)
const EGG_RADIUS = 130;       // (legacy) orbit radius for egg positions

// Animation timings
const DEPLOY_MS = 900;        // target deploy animation
const SHOT_MS = 380;          // shot travel base duration
const SPIN_MS = 600;          // cannon spin animation
const HIT_RESOLVE_MS = 1000;  // pause after hit/miss before next round
const ROUND_ANNOUNCE_MS = 4200; // monster/platinum announcement display time

// Aiming tolerances
const ANGLE_HIT_TOL = 7.5;   // degrees — drag/snap hit tolerance
const TYPED_TOL = 0.55;       // degrees — typed answer must be within ±0.55° of correct

// Game structure
const LEVEL_TARGET_COUNT = 10; // questions per level (from texts.json rounds.targetCount)
const AUTOPILOT_STAGE_TARGET = 5; // autopilot plays only 5 questions per stage
```
