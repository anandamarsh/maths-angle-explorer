# Angle Explorer — Specs

This folder is the **single source of truth** for the Angle Explorer game.
Reading every file here should give an LLM enough information to reconstruct
the entire codebase from scratch without inspecting source files.

---

## What this game is

An arcade-style maths game where the player rotates an SVG cannon to target angles
and fires at targets. The game moves from visual intuition (Level 1 — recognise the
angle type and aim by dragging) to calculation (Level 2 — compute missing angles in
complementary, supplementary, and complete-rotation sets).

Core features:
- **SVG cannon scene** — drag or type to aim, press Fire to shoot
- **Three round types** per level: Normal → Platinum → Monster
- **Three difficulty levels** (Level 1, 2, 3)
- **Session reporting** — PDF emailed at level completion
- **Demo video recording** — dev-only screen-record flow with intro/outro slides
- **Autopilot** — types answers directly, no canvas tapping
- **Cheat codes** — keyboard shortcuts for dev/testing
- **i18n** — multi-language support (new feature, see `i18n.md`)
- **Sound** — Web Audio API with extended angle-specific SFX
- **PWA** — installable, offline-capable

---

## Tech stack

| Layer | Choice |
|-------|--------|
| UI framework | React 19 (strict mode) |
| Language | TypeScript 5.9, strict mode |
| Bundler | Vite 8 + `@vitejs/plugin-react` |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Fonts | DSEG7Classic (numeric display) via `dseg` npm package |
| PDF | jsPDF 4 |
| Social sharing | react-share |
| Comments | disqus-react |
| API / email | Vercel serverless (`api/send-report.ts`) + Resend |
| Translation | OpenAI via `/api/translate` (planned — see `i18n.md`) |
| PWA | vite-plugin-pwa (Workbox) |
| Testing | Playwright |
| Dev server port | **4002** (hard-coded in `vite.config.ts`) |

---

## Directory structure

```
/
├── api/
│   └── send-report.ts        # Vercel serverless: email PDF via Resend
├── public/
│   ├── favicon.ico / favicon.svg
│   ├── apple-touch-icon.png
│   ├── icon-192.png / icon-512.png
│   ├── manifest.json
│   └── screenshots/
├── scripts/
│   └── stamp-manifest.mjs    # Stamps build hash into manifest.json
├── src/
│   ├── components/
│   │   ├── AutopilotIcon.tsx
│   │   ├── PhantomHand.tsx
│   │   ├── RotatePrompt.tsx
│   │   ├── SessionReportModal.tsx
│   │   └── Social.tsx
│   ├── game/
│   │   └── angles.ts         # Question generator for all levels
│   ├── hooks/
│   │   ├── useAutopilot.ts
│   │   └── useCheatCodes.ts
│   ├── report/
│   │   ├── generatePdf.ts
│   │   ├── sessionLog.ts
│   │   └── shareReport.ts
│   ├── screens/
│   │   └── ArcadeAngleScreen.tsx  # Main game screen (all state lives here)
│   ├── sound/
│   │   └── index.ts
│   ├── App.tsx
│   ├── geometry.ts            # SVG/angle math utilities
│   ├── index.css
│   ├── main.tsx
│   ├── texts.json             # UI strings (to be replaced by i18n system)
│   └── texts.ts              # Simple string helper (to be replaced by i18n)
├── tests/                     # Playwright tests
├── index.html
├── package.json
├── vite.config.ts
├── vercel.json
└── tsconfig.json / tsconfig.app.json / tsconfig.node.json
```

---

## Feature index

| Feature | Spec | Key files |
|---------|------|-----------|
| [Architecture & CSS](./architecture.md) | `specs/architecture.md` | `index.css`, `vite.config.ts`, `App.tsx`, `main.tsx` |
| [Game Loop](./game-loop.md) | `specs/game-loop.md` | `screens/ArcadeAngleScreen.tsx` |
| [Game Logic](./game-logic.md) | `specs/game-logic.md` | `game/angles.ts`, `geometry.ts` |
| [Canvas & SVG](./canvas.md) | `specs/canvas.md` | `screens/ArcadeAngleScreen.tsx`, `geometry.ts` |
| [Sound System](./sound-system.md) | `specs/sound-system.md` | `sound/index.ts` |
| [Session Reporting](./session-reporting.md) | `specs/session-reporting.md` | `report/` |
| [Demo Video Recording](./demo-video.md) | `specs/demo-video.md` | `hooks/useDemoRecorder.ts`, `components/DemoIntroOverlay.tsx`, `screens/ArcadeAngleScreen.tsx` |
| [Autopilot](./autopilot.md) | `specs/autopilot.md` | `hooks/useAutopilot.ts`, `components/PhantomHand.tsx`, `components/AutopilotIcon.tsx` |
| [Cheat Codes](./cheat-codes.md) | `specs/cheat-codes.md` | `hooks/useCheatCodes.ts` |
| [i18n](./i18n.md) | `specs/i18n.md` | `i18n/` (planned), `components/LanguageSwitcher.tsx` (planned) |
| [Deployment & PWA](./deployment.md) | `specs/deployment.md` | `vite.config.ts`, `vercel.json`, `public/manifest.json` |

---

## Curriculum mapping

| Level | NSW Stage | Code | Skill |
|-------|-----------|------|-------|
| 1 | Stage 2 (Years 3–4) | MA2-16MG | Identifies, describes, compares and classifies angles |
| 2 | Stage 3 (Years 5–6) | MA3-16MG | Measures and constructs angles; applies angle relationships to find unknowns |
| 3 | Stage 4 (Years 7–8) | MA4-18MG | Identifies and uses angle relationships including transversals |
