# Deployment & PWA

---

## Environment variables

### `.env.local` (development)

```
RESEND_API_KEY=re_...              # email delivery via /api/send-report
EMAIL_FROM=noreply@yourdomain.com  # verified Resend sender address
VITE_AUTOPILOT_EMAIL=you@example.com  # email autopilot types in report modal
OPENAI_API_KEY=sk-...              # on-demand translation (when i18n is added)
```

`vite.config.ts` reads `.env.local` via Vite's `loadEnv()` and passes values to
`localApiPlugin()` for dev middleware. `VITE_AUTOPILOT_EMAIL` is also exposed to
the client bundle via Vite's `import.meta.env` (VITE_ prefix).

### Vercel (production)

Set in Vercel project settings:
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `OPENAI_API_KEY` (when i18n is added)

Do not expose `RESEND_API_KEY` or `EMAIL_FROM` to the client bundle (no `VITE_` prefix).

---

## Vercel config (`vercel.json`)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "frame-ancestors *" },
        { "key": "Permissions-Policy",      "value": "web-share=*" },
        { "key": "X-Frame-Options",         "value": "ALLOWALL" }
      ]
    }
  ]
}
```

These headers allow the game to be embedded in iframes from any origin (the parent
Interactive Maths shell uses iframes) and enable the Web Share API from within iframes.

---

## PWA (`public/manifest.json`)

```json
{
  "name": "Angle Explorer",
  "short_name": "Angles",
  "description": "An arcade-style interactive maths game for learning angles",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#020617",
  "theme_color": "#0d1b35",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

The manifest also includes extended metadata used by the Interactive Maths shell:
- `id` — unique game identifier
- `tags` — curriculum year tags (e.g. `["Year 3", "Year 4", ...]`)
- `subjects` — `["Maths"]`
- `skills` — angle skill labels per level
- `screenshots` — URL array for shell preview images

`scripts/stamp-manifest.mjs` adds a `buildHash` field before the production build
and removes it afterwards (so git always sees the clean version).

### Service worker

`vite-plugin-pwa` with `registerType: 'autoUpdate'` generates a Workbox service worker:
- Pre-caches all `*.{js,css,html,ico,png,svg,woff,woff2}` files
- Uses NetworkFirst for all HTTPS requests (10s timeout, falls back to cache)

---

## Rotate prompt (`src/components/RotatePrompt.tsx`)

Shown when: touch device in **portrait** orientation.

Renders a full-screen overlay with:
- Rotating phone SVG icon
- "Rotate your device" heading
- "Angle Explorer plays best in landscape mode" subtext

Attempts orientation lock on mount:
```ts
screen.orientation?.lock?.("landscape").catch(() => {})
```

If embedded in an iframe, posts a message to the parent:
```ts
window.parent.postMessage({ type: "request-landscape" }, "*");
```

---

## Build & deploy

```bash
npm run dev      # kill any process on :4002, start Vite dev server
npm run build    # stamp manifest → TypeScript check → Vite build → restore manifest
npm run preview  # serve dist/ locally
```

Push to main → Vercel auto-deploys. `api/send-report.ts` is deployed as a serverless
function alongside the static assets.

## Touch menu policy

During local development on `localhost`, `127.0.0.1`, or `::1`, the app leaves the
browser's standard right-click and long-press menus enabled so debugging tools and
normal inspect/copy workflows still work.

In production and any non-local host, the app disables the default `contextmenu`
surface and iOS touch callout on the game shell, while still allowing normal text
selection behavior inside editable controls.

---

## Icon requirements

| File | Size | Usage |
|------|------|-------|
| `public/favicon.ico` | any | browser tab |
| `public/favicon.svg` | scalable | browser tab (modern) + PDF header icon |
| `public/apple-touch-icon.png` | 180×180 | iOS home screen |
| `public/icon-192.png` | 192×192 | Android PWA |
| `public/icon-512.png` | 512×512 | PWA splash + PDF fallback |

The PDF generator tries `/favicon.svg` first, falls back to `/icon-512.png`.

---

## Social sharing

**Share button** (toolbar top-right):
- If `navigator.share` available → native share sheet with game URL
- Otherwise → opens the share drawer (react-share buttons: Twitter, Facebook,
  WhatsApp, LinkedIn)

Share URL: `https://interactive-maths.vercel.app/` (the shell launcher, not this game
directly — players discover games through the shell).

**Comments button** → opens DiscussIt drawer (embedded iframe).

**YouTube button**:
- rendered when `public/manifest.json` contains a valid `videoUrl`
- opens a centered modal with the embedded project walkthrough video
- shows a first-time dismissible speech bubble
- the bubble may appear above or below the icon depending on which position keeps it visible

---

## Playwright test config (`playwright.config.ts`)

```ts
{
  testDir: './tests',
  timeout: 120_000,   // 2 min — enough for autopilot to play 2 full levels
  use: {
    baseURL: 'http://localhost:4002',
    viewport: { width: 1280, height: 800 },
    headless: false,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4002',
    reuseExistingServer: !process.env.CI,
  },
}
```
