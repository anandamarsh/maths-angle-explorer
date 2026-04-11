# Game Logic

**Primary facade:** `src/game/angles.ts`

Angle Explorer now stores its mathematical question generators under
`src/calculations/` so each level and round can be reviewed independently.

## Folder structure

```text
src/
  calculations/
    level-1/
      normal.ts
      monster.ts
      platinum.ts
    level-2/
      normal.ts
      monster.ts
      platinum.ts
    shared.ts
    types.ts
  game/
    angles.ts
```

The game has two playable levels. Each level exposes three round files so the
folder structure matches the real round flow:
- `normal`
- `monster`
- `platinum`

Where two rounds currently share the same maths, the dedicated file still exists
and delegates explicitly.

## Core types

`src/calculations/types.ts` owns the stable question contracts:

```ts
export interface KnownEgg {
  angleDeg: number;
  label: string;
}

export interface AngleSector {
  fromAngle: number;
  toAngle: number;
  label?: string;
  missing?: boolean;
}

export interface AngleQuestion {
  id: string;
  level: 1 | 2 | 3;
  prompt: string;
  answer: number;
  promptLines?: [string, string, string];
  subAnswers?: [number, number, number];
  knownEggs: KnownEgg[];
  hiddenAngleDeg: number;
  totalContext: 90 | 180 | 360;
  startAngleDeg?: number;
  setKind?: "COMPLEMENTARY" | "SUPPLEMENTARY" | "COMPLETE";
  sectorArcs?: AngleSector[];
  dividerAngles?: number[];
}

export type GameRound = "normal" | "monster" | "platinum";
```

## Shared calculation helpers

`src/calculations/shared.ts` owns the reviewable deterministic helpers:

```ts
export function pick<T>(items: T[], random?: () => number): T
export function randomInt(min: number, max: number, random?: () => number): number
export function buildSectorSet(total: number, count: number, random?: () => number): number[]
export function createQuestionId(): string
```

These helpers make it possible to unit-test the angle maths with controlled
random values.

## Level and round calculators

### Level 1

```ts
export function createLevelOneNormalQuestion(random?: () => number): AngleQuestion
export function createLevelOneMonsterQuestion(random?: () => number): AngleQuestion
export function createLevelOnePlatinumQuestion(random?: () => number): AngleQuestion
```

Current maths:
- choose one landmark angle from the Level 1 set
- answer equals the hidden target angle

`monster.ts` and `platinum.ts` currently reuse the same landmark-angle rules as
`normal.ts`.

### Level 2

```ts
export function createLevelTwoNormalQuestion(random?: () => number): AngleQuestion
export function createLevelTwoMonsterQuestion(random?: () => number): AngleQuestion
export function createLevelTwoPlatinumQuestion(random?: () => number): AngleQuestion
```

Current maths:
- choose a complementary, supplementary, or complete-angle set
- build sectors in multiples of `5°`
- hide one sector before the last divider
- answer equals the missing sector size

`monster.ts` and `platinum.ts` currently reuse the same missing-angle maths as
`normal.ts`.

## Facade contract

`src/game/angles.ts` continues to export the screen-facing API:

```ts
export function makeL1Question(): AngleQuestion
export function makeL2Question(): AngleQuestion
export function makeL3Question(): AngleQuestion
export function makeMonsterL3Question(): AngleQuestion
export function makeQuestion(level: 1 | 2 | 3, round?: GameRound): AngleQuestion
```

Compatibility notes:
- `makeL3Question()` remains an alias for the Level 2 normal calculator because
  the current game still shares that maths.
- `makeMonsterL3Question()` remains an alias for the Level 2 monster calculator.

## Test strategy

Unit tests live under:

```text
tests/unit/calculations.test.ts
```

They verify:
- Level 1 deterministic angle selection
- sector-set totals and `5°` increments
- deterministic Level 2 missing-angle generation
- round dispatch for normal, monster, and platinum

Playwright continues to verify the full interactive game flow.

## Input and cheat-code contract

Angle Explorer is the benchmark for future keypad-based games:

- the same cheat-code buffer is shared between global keyboard input and keypad
  button taps
- `198081` clears the typed answer and starts continuous autopilot
- `197879` reveals/fills the correct answer and fires it
- cheat trigger digits are swallowed instead of lingering in the answer display

## Demo mode contract

Angle Explorer follows the same demo contract as the other See Maths games:

- `?demo=1` enables demo mode and persists it in `localStorage`
- `?demo=0` disables demo mode and clears the stored flag
- if the query parameter is absent, the stored demo flag is reused so refreshes
  and installed-PWA relaunches stay in the same mode
- See Maths is expected to forward the `demo` query parameter when launching
  the game

While demo mode is enabled:
- the game shows a persistent `Demo Mode` banner
- star target drops to `2`
- the correct angle is visible without needing the answer cheat code
- the level-complete modal tells testers to leave a comment and email the
  report to themselves
