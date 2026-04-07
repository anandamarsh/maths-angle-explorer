# Game Logic

**Files:**
- `src/game/angles.ts` — question generator
- `src/geometry.ts` — SVG/angle math utilities

---

## Angle convention

Used consistently throughout this project:

```
0°   = pointing right  (positive x)
90°  = pointing UP     (negative y in SVG — y-axis is flipped)
180° = pointing left
270° = pointing down
Angles increase counter-clockwise (standard maths convention).
```

SVG has y increasing downward, so angles are negated when converting between SVG
pointer coordinates and maths angles.

---

## `AngleQuestion` interface

```ts
export interface AngleQuestion {
  id: string;
  level: 1 | 2 | 3;
  prompt: string;           // shown in question box during aiming
  answer: number;           // correct angle in degrees
  knownEggs: KnownEgg[];   // (legacy) known angle markers
  hiddenAngleDeg: number;  // where the target is placed on the scene
  totalContext: 90 | 180 | 360;  // total angle for L2 sets
  // Level 2 fields
  startAngleDeg?: number;
  setKind?: "COMPLEMENTARY" | "SUPPLEMENTARY" | "COMPLETE";
  sectorArcs?: AngleSector[];
  dividerAngles?: number[];
}

export interface AngleSector {
  fromAngle: number;
  toAngle: number;
  label?: string;   // e.g. "45°" or "?"
  missing?: boolean; // true for the sector the player must find
}

export interface KnownEgg {
  angleDeg: number;
  label: string;
}
```

---

## Level 1 — The Gaze

**File:** `makeL1Question()`

A single target floats at a target angle. The player drags or types to match it.

```ts
const L1_KEY_ANGLES = [
  30, 45, 60, 90,           // Q1
  120, 135, 150, 180,       // Q2 + straight
  210, 225, 240, 270,       // Q3
  300, 315, 330,            // Q4
];

export function makeL1Question(): AngleQuestion {
  const target = pick(L1_KEY_ANGLES);
  return {
    id: nextId(),
    level: 1,
    prompt: texts.levels["1"].prompts.normal,
    answer: target,
    knownEggs: [],
    hiddenAngleDeg: target,
    totalContext: 360,
  };
}
```

The targets are landmark angles (multiples of 30° and 45°), spread across all four
quadrants. This teaches the student to recognise ACUTE, OBTUSE, STRAIGHT, and REFLEX
angles by sight.

---

## Level 2 — Missing-Angle Sets

**File:** `makeL2Question()`

A set of sectors totalling 90°, 180°, or 360°. One sector is unknown. The player
must calculate the missing angle from the others.

```ts
type L2SetType = {
  total: 90 | 180 | 360;
  kind: "COMPLEMENTARY" | "SUPPLEMENTARY" | "COMPLETE";
  minCount: number;
};

const L2_SET_TYPES: L2SetType[] = [
  { total: 90,  kind: "COMPLEMENTARY", minCount: 2 },
  { total: 180, kind: "SUPPLEMENTARY", minCount: 2 },
  { total: 360, kind: "COMPLETE",      minCount: 3 },
];
```

### `buildSectorSet(total, count): number[]`

Generates `count` random sector sizes that sum to `total`. All sizes are multiples of 5°.
Minimum sector size: 20° (4 units of 5°). The last sector absorbs remaining units.
Sectors are randomly shuffled after generation.

```ts
function buildSectorSet(total: number, count: number): number[] {
  const totalUnits = total / 5;
  const minUnits = 4;  // 20°
  let remaining = totalUnits - minUnits * count;
  const units = Array.from({ length: count }, () => minUnits);
  for (let i = 0; i < count - 1; i++) {
    const extra = randomInt(0, remaining);
    units[i] += extra;
    remaining -= extra;
  }
  units[count - 1] += remaining;
  return units.map(u => u * 5).sort(() => Math.random() - 0.5);
}
```

### `makeL2Question()` — full algorithm

```ts
export function makeL2Question(): AngleQuestion {
  let setType, count, sectors, unknownIdx, startAngleDeg, answer;

  do {
    setType = pick(L2_SET_TYPES);
    const maxCount = Math.min(5, Math.floor(setType.total / 10));
    count = randomInt(setType.minCount, maxCount);
    sectors = buildSectorSet(setType.total, count);
    unknownIdx = randomInt(0, count - 2);   // not the last sector
    startAngleDeg = sum(sectors.slice(0, unknownIdx));
    answer = sectors[unknownIdx];
    hiddenAngleDeg = startAngleDeg + answer;
  } while (answer < 30);  // reject tiny answers (too easy to guess)

  // Build sector arcs for SVG rendering
  let running = 0;
  const sectorArcs: AngleSector[] = sectors.map((value, idx) => ({
    fromAngle: running,
    toAngle: (running += value, running),
    label: idx === unknownIdx ? "?" : `${value}°`,
    missing: idx === unknownIdx,
  }));

  const dividerAngles = Array.from(
    new Set([0, ...sectorArcs.map(s => s.toAngle)])
  ).filter(a => a < 360);

  return {
    id: nextId(),
    level: 2,
    prompt: texts.levels["2"].prompts.normal,
    answer,
    knownEggs: [],
    hiddenAngleDeg,
    totalContext: setType.total,
    startAngleDeg,
    setKind: setType.kind,
    sectorArcs,
    dividerAngles,
  };
}
```

---

## Level 3

`makeL3Question()` currently returns `makeL2Question()`. Level 3 is planned as a
less-scaffolded variant (no sector arcs shown) but is not yet differentiated.

---

## Dispatcher

```ts
export function makeQuestion(level: 1 | 2 | 3): AngleQuestion {
  if (level === 1) return makeL1Question();
  return makeL2Question();  // Level 2 and 3 share logic for now
}
```

---

## `geometry.ts` — math utilities

### `pointerToAngle(cx, cy, svgX, svgY): number`
Converts a pointer position on the SVG relative to the cannon pivot into a maths angle
in degrees [0, 360). Flips SVG y-axis (dy = -(svgY - cy)).

### `polarToXY(cx, cy, angleDeg, length): { x, y }`
Converts a maths angle + radius into SVG coordinates. Used for all ray/target positions.

### `arcPath(cx, cy, r, startAngle, endAngle): string`
Builds an SVG arc path string going CCW from startAngle to endAngle (maths convention).
Uses `sweepFlag=0` for correct CCW visual result with flipped y-axis.

### `spanCCW(fromAngle, toAngle): number`
Returns the angular span going CCW from fromAngle to toAngle, result in [0, 360).

### `snapAngle(angle, targets, threshold): number`
If `angle` is within `threshold` degrees of any target, returns the nearest target.
Otherwise returns `angle` unchanged. Used for angle snapping during drag.

### `midAngleCCW(fromAngle, toAngle): number`
Returns the mid-angle between two rays going CCW. Used to position arc labels.

### `fmt(n): string`
Rounds to one decimal place. Used for display labels.

### `clamp(value, min, max): number`
Standard clamp.

---

## Angle type classification

```ts
function getAngleType(deg: number): { label: string; color: string } {
  const a = ((deg % 360) + 360) % 360; // normalise to [0, 360)
  if (a < 0.5 || a > 359.5) return { label: "ZERO",        color: "#64748b" };
  if (Math.abs(a - 90)  < 2) return { label: "RIGHT ANGLE", color: "#22c55e" };
  if (Math.abs(a - 180) < 2) return { label: "STRAIGHT",    color: "#a78bfa" };
  if (a > 180)               return { label: "REFLEX",       color: "#f97316" };
  if (a < 90)                return { label: "ACUTE",        color: "#38bdf8" };
  return                            { label: "OBTUSE",       color: "#c084fc" };
}
```

The label and its colour update live as the player drags the cannon.

---

## Texts (`src/texts.json` and `src/texts.ts`)

Currently, all UI strings are stored in `texts.json` and accessed via a simple
`formatText(template, values)` helper in `texts.ts`:

```ts
export function formatText(template: string, values: Record<string, TextValue>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}
```

This will be replaced by the full i18n system. See `specs/i18n.md`.

Key text paths:
- `texts.levels["1"].prompts.normal` — Level 1 question prompt
- `texts.levels["2"].prompts.normal` — Level 2 question prompt
- `texts.levels["1"].angleTypes.*` — angle type labels (ACUTE, OBTUSE, etc.)
- `texts.levels["2"].setKinds.*` — set kind labels and sublabels
- `texts.rounds.monster.*` — monster round strings
- `texts.rounds.platinum.*` — platinum round strings
- `texts.generic.*` — shared strings (buttons, hints, etc.)
