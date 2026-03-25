# Angle Explorer — Deep Build Plan
*For handoff to a new Cursor session (claude-sonnet)*

---

## Project Overview

**Repo**: https://github.com/anandamarsh/maths-angle-explorer  
**Live (after GH Pages deploys)**: https://anandamarsh.github.io/maths-angle-explorer/  
**Local dev**: `npm run dev` → http://localhost:4002/  
**Shell app**: http://localhost:4000/ (interactive-maths, port 4000) — iframes this game via `manifest.json` discovery  

**Stack**: React 19, TypeScript, Vite 8, Tailwind CSS v4, SVG (no canvas), no external game libraries  
**Style**: Dark navy (`#020617`) background, sky-blue (`#38bdf8`) accents — matches the shell app and the existing distance calculator game  

---

## Why This Game Exists

Built for **Jai Anand (age ~11)** who completed IXL skill Y.5 (complementary, supplementary, vertical, adjacent angles) and made **13 errors in Pattern 1**: diagram problems where 3+ rays meet at a vertex and you must **add the known angle parts first, then subtract from 90° or 180°**. His consistent mistake: grabbing the nearest visible number rather than computing the residual.

The game builds the **mental model before the test** through a draggable ray mechanic. The core insight: Jai needs to *feel* that parts fill a fixed total, not just calculate it.

---

## Core Mechanic — "The Blade"

Every level is built around an **SVG-based draggable ray** that rotates around a central vertex like a Swiss Army knife blade opening.

**Technical implementation**:
- SVG `<line>` elements from a central vertex (e.g. cx=240, cy=300 on a 480×400 canvas)
- One **fixed spine ray** pointing right (0°, always horizontal)  
- One or more **draggable blade rays** that rotate on `pointerdown` / `pointermove` / `pointerup`
- Angle = `Math.atan2(dy, dx)` converted to degrees, clamped 0–180° (or 0–360° in Level 6)
- **Snap zones**: within ±3° of 90° or 180°, the ray snaps and locks with a brief CSS scale animation + a Web Audio API tone
- **Arc rendering**: SVG `<path>` arc between the two bounding rays using `largeArcFlag` based on angle > 180°
- **Live angle label**: SVG `<text>` positioned mid-arc, updates every frame

**Key helper functions to write** (in `src/geometry.ts`):
```typescript
angleBetweenRays(ax, ay, bx, by): number   // degrees 0–360
polarToXY(cx, cy, angle, length): {x, y}   // ray endpoint
arcPath(cx, cy, r, startAngle, endAngle): string  // SVG arc d attr
snapAngle(angle, targets, threshold): number  // snap to 90/180/270/360
```

---

## File Structure to Build

```
src/
  App.tsx                  ← Level select screen (hello world exists)
  main.tsx                 ← SW registration (exists)
  index.css                ← Tailwind import (exists)
  geometry.ts              ← All angle math helpers (TO BUILD)
  sound.ts                 ← Web Audio API tones/snaps (TO BUILD)
  components/
    RayCanvas.tsx           ← Core SVG blade mechanic (TO BUILD — most important)
    AngleArc.tsx            ← Arc + label between two rays (TO BUILD)
    AngleLabel.tsx          ← Floating degree readout (TO BUILD)
    SumStrip.tsx            ← Running "34° + 56° = 90°" bar (TO BUILD)
  levels/
    Level1.tsx              ← Full sweep — angle type recognition (TO BUILD)
    Level2.tsx              ← Complementary (90°) (TO BUILD)
    Level3.tsx              ← Supplementary (180°) (TO BUILD)
    Level4.tsx              ← Adjacent fan — multi-ray (TO BUILD — Jai's problem)
    Level5.tsx              ← Vertical angles at a cross (TO BUILD)
    Level6.tsx              ← Reflex + full turn (TO BUILD)
  eggs/
    WhiteEgg.tsx            ← Free-drag exploration wrapper (TO BUILD)
    GoldenEgg.tsx           ← Static diagram, input only (TO BUILD)
    PredictThenDrag.tsx     ← Bridge: type guess, then drag to verify (TO BUILD)
```

---

## Level Specifications

### Level 1 — The Full Sweep
**White egg**: Single draggable blade from 0°→360°. As it enters each zone, a label appears:
- 0°–89°: "Acute" (blue)
- 90° snap: "Right Angle ✓" + corner square symbol
- 91°–179°: "Obtuse" (purple)
- 180° snap: "Straight Line ✓" + flat line
- 181°–359°: "Reflex" (orange)
- 360° snap: "Full Turn ✓" + circle

**Golden egg**: Multiple-choice classification. Show a static SVG angle, 4 options (Acute / Right / Obtuse / Straight / Reflex). 5 questions per session.

### Level 2 — Complementary
**White egg**:  
1. First, sweep blade to 90° (snaps). Right angle corner appears.  
2. A second, smaller blade appears *inside* the 90° sector — draggable.  
3. Two live labels: `α°` and `(90−α)°`. SumStrip shows `α + (90−α) = 90`.  
4. Questions: "Set the blade so α = 34°" — must drag to within ±1°.

**Golden egg**: "Angle = 34°. What is its complement?" — type box. 5 questions, including 1 decimal (e.g. 34.5°).

### Level 3 — Supplementary
**White egg**:  
- Full horizontal straight line (180° span shown with a flat arc).  
- One draggable divider ray.  
- SumStrip: `α + β = 180` live.  
- Questions: "Set the divider so one angle is 110°."

**Golden egg**: Three-ray diagram (matching Jai's IXL problems exactly). Two angles labelled, find the third. **5 questions, including 1 with decimals.** This directly targets his error pattern.

### Level 4 — Adjacent Fan ⭐ (Jai's core problem)
**White egg**:  
- Straight line (180° base).  
- **Two** movable blades — three sectors.  
- All three angle labels update live.  
- SumStrip always shows `α + β + γ = 180`.  
- Questions: Two sectors locked with labels. Drag the free blade to the correct position.

**Golden egg**: Static fan diagrams with 3–4 rays. Some labelled, find the unknown.  
**Deliberately include**:
- A trap question where the unknown *looks like* it equals a visible number but is actually the sum of two others (targeting Jai's "grab nearest number" habit)  
- Decimal values  
- One question where the outer span is 90° not 180°  

**5 questions minimum.**

### Level 5 — Vertical Angles
**White egg**:  
- Two lines crossing (full X). Four sectors.  
- Drag one line — the **opposite pair** glows and pulses together.  
- Text appears: "Opposite angles are ALWAYS equal."  
- Questions: "Make the top angle 40°. What is the bottom angle?" — must type without dragging.

**Golden egg**: Crossing lines, two angles labelled (one pair), find both unknowns.  
Include one question where the answer is purely vertical (no arithmetic — recognition only).

### Level 6 — Reflex & Full Turn
**White egg**:  
- Blade sweeps past 180° into reflex.  
- **Two** arcs shown simultaneously: the small angle (white) and the reflex (orange).  
- Both labels update: `α` and `360−α`.  
- At 360°, full circle animation.

**Golden egg**: Reflex angle given (e.g. 250°), find the non-reflex partner. Or vice versa.

---

## Egg Structure (Per Level)

Each level component should render three phases in order:

```
WhiteEgg → PredictThenDrag → GoldenEgg
```

**WhiteEgg**: `canDrag=true`, arc visible, SumStrip visible, snap feedback on  
**PredictThenDrag**: Static diagram shown. Input box. User types. Then "Verify" button unlocks blade. Drag confirms/corrects.  
**GoldenEgg**: `canDrag=false`, no arc, no SumStrip. Just the SVG diagram and an input box.  

Score tracking: correct/total per phase. Persisted in `useState` bubbled up to App.

---

## SumStrip Component

The SumStrip is a horizontal bar at the bottom of the canvas showing:

```
[ 46° ]  +  [ 26° ]  =  [ 72° ]  of  180°
```

- Each known-angle chip glows its colour
- The `=` total chip shows the sum of known parts
- "of 180°" (or "of 90°") anchors the total
- When parts sum to exactly the total: the bar turns green + pulse

This is the single most important UI element — it forces Jai to see the add-first logic.

---

## Sound Design (sound.ts)

Use Web Audio API (no files). Key sounds:
- `playSnap()` — short click, 800Hz for 50ms (right angle or straight line snap)
- `playCorrect()` — rising two-tone (C5→E5), 150ms each
- `playWrong()` — falling buzz, 200Hz, 200ms
- `playTick(angle)` — subtle tick every 10° during drag (angle/10 maps to pitch 200–800Hz)

---

## Deployment

- **Dev**: `npm run dev` → localhost:4002  
- **Production**: GitHub Actions (`.github/workflows/deploy.yml`) deploys `dist/` to `gh-pages` branch on every push to `main`  
- **Live URL**: https://anandamarsh.github.io/maths-angle-explorer/  
- **Shell integration**: The interactive-maths shell fetches `manifest.json` from the root URL and iframes the game. `games.json` already includes this game's URL.  

---

## What's Already Done (hello world state)

- [x] Vite + React + TS + Tailwind wired up  
- [x] Port 4002, `strictPort: true`  
- [x] `base: '/maths-angle-explorer/'` for GH Pages  
- [x] `App.tsx` shows a level-select screen with all 6 levels listed (disabled, "soon")  
- [x] `manifest.json` with full game description, SVG icon, tags, skills  
- [x] `sw.js` service worker stub  
- [x] GitHub repo created: https://github.com/anandamarsh/maths-angle-explorer  
- [x] GH Actions deploy workflow committed  
- [x] Added to `interactive-maths` `games.json` (production) and `games-local.json` (local dev)  

---

## Suggested Build Order for Next Session

1. **`src/geometry.ts`** — write and test all math helpers first  
2. **`src/components/RayCanvas.tsx`** — single draggable blade + vertex + spine + snap  
3. **`src/components/AngleArc.tsx`** + **`AngleLabel.tsx`** — wire to RayCanvas  
4. **`src/sound.ts`** — snap + correct + wrong tones  
5. **`src/components/SumStrip.tsx`** — the key teaching strip  
6. **`src/levels/Level2.tsx`** — Complementary, simplest real level  
7. **`src/eggs/WhiteEgg.tsx`**, **`GoldenEgg.tsx`**, **`PredictThenDrag.tsx`** — wrappers  
8. Wire Level 2 fully end-to-end with all three phases  
9. Level 3 (Supplementary) — reuses all components, just different total  
10. Level 4 (Adjacent Fan) — add second draggable blade  
11. Level 1 (Full Sweep) — extend blade to 360°, add type labels  
12. Level 5 (Vertical) — two crossing lines  
13. Level 6 (Reflex) — dual arc display  
14. App.tsx — unlock levels as previous is completed, persist progress  

---

## Key Design Decisions to Honour

- **No timer** — deliberate thinking is the goal  
- **No vocabulary labels during gameplay** — teach through visual, not text  
- **SumStrip always visible in white-egg mode** — it's the core habit-builder  
- **Snap at 90° and 180° feels physical** — use scale animation + sound  
- **Vertical angle "cheat code" moment** — make it feel like a discovery, not a rule  
- **Mobile-first SVG** — touch events + pointer events, not just mouse  
- **Dark navy background** matching shell app: `#020617`  

---

## Jai's Error Pattern (for reference when designing Level 4 questions)

From IXL Y.5 analysis (13 wrong questions in this pattern):

| Sub-pattern | Example | Jai's mistake |
|---|---|---|
| Add-before-subtract | z: 46° + 26° on a line | Answered 108 (did 180−72) instead of 72 |
| Grab nearest label | 26°+j+49° on a line | Answered 75 (grabbed 26+49) instead of 180−75=105 |
| Wrong total selected | 50°+30°+q, vertical angle | Answered 100 (used 180−80) instead of 80 |
| Decimal subtraction slip | 180−167.5 | Answered 22.5 instead of 12.5 |

Golden eggs in Level 4 should include at least one of each sub-pattern.
