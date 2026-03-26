// ─── Angle game question generator ───────────────────────────────────────────
// Three levels, each generating randomised AngleQuestion objects.
//
// Level 1 — The Gaze:        aim the dino at a target angle (acute/right/obtuse/straight/reflex)
// Level 2 — Right-Angle Nest: find the complement  (90 − α)
// Level 3 — Rocky Ridge:     find the unknown on a 180° line, targeting Jai's error patterns

export interface KnownEgg {
  angleDeg: number; // angle from dino's right (maths convention, CCW)
  label: string;    // shown next to the egg in the scene
}

export interface AngleQuestion {
  id: string;
  level: 1 | 2 | 3;
  prompt: string;
  answer: number;
  // Level 3 multi-step (same as distance-calculator L3)
  promptLines?: [string, string, string];
  subAnswers?: [number, number, number];
  // Scene
  knownEggs: KnownEgg[];
  hiddenAngleDeg: number; // where the mystery egg is placed
  // Context shown in scene terrain
  totalContext: 90 | 180 | 360;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

let _idCounter = 0;
function nextId(): string {
  return `q${++_idCounter}_${Date.now()}`;
}

// ─── Level 1 — The Gaze ───────────────────────────────────────────────────────
// A single target floats at a target angle. Aim and fire.

const L1_KEY_ANGLES = [-150, -135, -120, -90, -60, -45, -30, 30, 45, 60, 90, 120, 135, 150, 180];

export function makeL1Question(): AngleQuestion {
  const target = pick(L1_KEY_ANGLES);
  const prompt = "Target spotted. Rotate and shoot.";

  return {
    id: nextId(),
    level: 1,
    prompt,
    answer: target,
    knownEggs: [],
    hiddenAngleDeg: target,
    totalContext: 360,
  };
}

// ─── Level 2 — Right-Angle Nest ───────────────────────────────────────────────
// Egg A is visible at α°. Egg B is hidden at (90 − α)°.

export function makeL2Question(): AngleQuestion {
  // α between 8° and 82° (leave room for visible arc)
  const useDecimal = Math.random() < 0.25;
  const base = 8 + Math.floor(Math.random() * 74);
  const alpha = useDecimal ? round1(base + 0.5) : base;
  const beta = round1(90 - alpha);

  const prompt = `Target A locked at ${alpha}°. RIGHT ANGLE spread. Find target B!`;

  return {
    id: nextId(),
    level: 2,
    prompt,
    answer: beta,
    knownEggs: [{ angleDeg: alpha, label: `${alpha}°` }],
    hiddenAngleDeg: beta,
    totalContext: 90,
  };
}

// ─── Level 3 — Rocky Ridge ────────────────────────────────────────────────────
// Three eggs on a 180° straight ridge. Two known, one hidden.
// Deliberately targets Jai's four error patterns:
//   1. Add-before-subtract (unknown last, both knowns shown)
//   2. Grab-nearest (unknown in the MIDDLE — Jai's main trap)
//   3. Decimal slip
//   4. Single known (two-step: 180 − α)

export type L3Pattern = "add-last" | "grab-middle" | "decimal" | "single";

// Bank of nice question seeds that always produce clean diagrams
const L3_SEEDS: {
  pattern: L3Pattern;
  sectors: [number, number, number]; // a, b, c where a+b+c = 180
  unknownIdx: 0 | 1 | 2;
}[] = [
  // add-last — unknown is the rightmost sector
  { pattern: "add-last",   sectors: [46, 26, 108], unknownIdx: 2 },
  { pattern: "add-last",   sectors: [50, 30, 100], unknownIdx: 2 },
  { pattern: "add-last",   sectors: [35, 45,  100], unknownIdx: 2 },
  { pattern: "add-last",   sectors: [70, 40,  70],  unknownIdx: 2 },
  // grab-middle — unknown is the centre sector (Jai's primary trap)
  { pattern: "grab-middle", sectors: [26, 105, 49], unknownIdx: 1 },
  { pattern: "grab-middle", sectors: [40,  80, 60], unknownIdx: 1 },
  { pattern: "grab-middle", sectors: [55,  65, 60], unknownIdx: 1 },
  { pattern: "grab-middle", sectors: [30, 110, 40], unknownIdx: 1 },
  // decimal slip — at least one decimal
  { pattern: "decimal", sectors: [90,   77.5, 12.5], unknownIdx: 2 },
  { pattern: "decimal", sectors: [34.5, 33.5, 112],  unknownIdx: 2 },
  { pattern: "decimal", sectors: [75.5, 44.5, 60],   unknownIdx: 1 },
  { pattern: "decimal", sectors: [22.5, 112,  45.5], unknownIdx: 0 },
  // single-known variant (only one sector given, two-step)
  { pattern: "single", sectors: [167.5, 0, 12.5],   unknownIdx: 2 },
  { pattern: "single", sectors: [0, 142, 38],        unknownIdx: 0 },
];

// Randomised L3 seeds — pick from the bank but vary which known eggs are labeled
export function makeL3Question(): AngleQuestion {
  const seed = pick(L3_SEEDS);
  const [a, b, c] = seed.sectors;
  const unknownIdx = seed.unknownIdx;

  // Divider angles from spine (0°):
  //   ray1 at a°, ray2 at (a+b)°, boundary at 180°
  const div1 = a;
  const div2 = a + b;

  // Build known egg list (everything except the unknown sector's midpoint)
  const midAngles = [a / 2, a + b / 2, a + b + c / 2];
  const sectorValues = [a, b, c];

  const unknownLabel = ["z", "j", "x"][unknownIdx % 3];

  const knownEggs: KnownEgg[] = sectorValues
    .map((val, i) => ({ angleDeg: midAngles[i], label: `${val}°` }))
    .filter((_, i) => i !== unknownIdx);

  const hiddenAngleDeg = midAngles[unknownIdx];
  const answer = sectorValues[unknownIdx];

  // Build multi-step prompt (distance-calculator L3 style)
  // Step 1: identify the known sectors
  // Step 2: add them
  // Step 3: subtract from 180
  const knownSectors = sectorValues.filter((_, i) => i !== unknownIdx);
  const knownSum = round1(knownSectors.reduce((s, v) => s + v, 0));

  let promptLines: [string, string, string];
  let subAnswers: [number, number, number];

  if (knownSectors.length === 2) {
    promptLines = [
      `Known angles: ${knownSectors[0]}° + ${knownSectors[1]}° = ?`,
      `Ridge total: 180° − ${knownSum}° = ?`,
      `So ${unknownLabel} = ?`,
    ];
    subAnswers = [knownSum, answer, answer];
  } else {
    // single known (pattern "single")
    const k = knownSectors[0];
    promptLines = [
      `Known angle: ${k}°`,
      `Ridge total: 180° − ${k}° = ?`,
      `So ${unknownLabel} = ?`,
    ];
    subAnswers = [k, answer, answer];
  }

  const prompt = `Find egg ${unknownLabel} on the ridge! (${knownSectors.join(" + ")} + ${unknownLabel} = 180)`;

  return {
    id: nextId(),
    level: 3,
    prompt,
    answer,
    promptLines,
    subAnswers,
    knownEggs,
    // The boulder hides the mystery egg — place it at its midpoint angle
    hiddenAngleDeg,
    // For scene: ray dividers
    totalContext: 180,
    // Extra info for scene rendering
    ...{ div1, div2 },
  } as AngleQuestion & { div1: number; div2: number };
}

// Convenience dispatcher
export function makeQuestion(level: 1 | 2 | 3): AngleQuestion {
  if (level === 1) return makeL1Question();
  if (level === 2) return makeL2Question();
  return makeL3Question();
}

// ─── Monster-round variants (harder) ─────────────────────────────────────────
// For L3 monster rounds: always use grab-middle or decimal patterns

const MONSTER_L3_SEEDS = L3_SEEDS.filter(
  (s) => s.pattern === "grab-middle" || s.pattern === "decimal"
);

export function makeMonsterL3Question(): AngleQuestion {
  const seed = pick(MONSTER_L3_SEEDS);
  const [a, b, c] = seed.sectors;
  const unknownIdx = seed.unknownIdx;
  const div1 = a;
  const div2 = a + b;
  const midAngles = [a / 2, a + b / 2, a + b + c / 2];
  const sectorValues = [a, b, c];
  const unknownLabel = ["z", "j", "x"][unknownIdx % 3];
  const knownEggs: KnownEgg[] = sectorValues
    .map((val, i) => ({ angleDeg: midAngles[i], label: `${val}°` }))
    .filter((_, i) => i !== unknownIdx);
  const hiddenAngleDeg = midAngles[unknownIdx];
  const answer = sectorValues[unknownIdx];
  const knownSectors = sectorValues.filter((_, i) => i !== unknownIdx);
  const knownSum = round1(knownSectors.reduce((s, v) => s + v, 0));
  const promptLines: [string, string, string] = [
    `Known angles: ${knownSectors[0]}° + ${knownSectors[1]}° = ?`,
    `Ridge total: 180° − ${knownSum}° = ?`,
    `So ${unknownLabel} = ?`,
  ];
  const subAnswers: [number, number, number] = [knownSum, answer, answer];
  return {
    id: nextId(),
    level: 3,
    prompt: `Find ${unknownLabel} on the ridge!`,
    answer,
    promptLines,
    subAnswers,
    knownEggs,
    hiddenAngleDeg,
    totalContext: 180,
    ...{ div1, div2 },
  } as AngleQuestion & { div1: number; div2: number };
}
