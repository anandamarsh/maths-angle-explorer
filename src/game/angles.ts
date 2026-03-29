// ─── Angle game question generator ───────────────────────────────────────────
// Two active levels:
//
// Level 1 — free 360° aiming
// Level 2 — missing-angle sets that total 90°, 180°, or 360°

export interface KnownEgg {
  angleDeg: number; // angle from dino's right (maths convention, CCW)
  label: string;    // shown next to the egg in the scene
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
  // Level 3 multi-step (same as distance-calculator L3)
  promptLines?: [string, string, string];
  subAnswers?: [number, number, number];
  // Scene
  knownEggs: KnownEgg[];
  hiddenAngleDeg: number; // where the mystery egg is placed
  // Context shown in scene terrain
  totalContext: 90 | 180 | 360;
  startAngleDeg?: number;
  setKind?: "COMPLEMENTARY" | "SUPPLEMENTARY" | "COMPLETE";
  sectorArcs?: AngleSector[];
  dividerAngles?: number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sum(arr: number[]): number {
  return arr.reduce((acc, value) => acc + value, 0);
}

let _idCounter = 0;
function nextId(): string {
  return `q${++_idCounter}_${Date.now()}`;
}

// ─── Level 1 — The Gaze ───────────────────────────────────────────────────────
// A single target floats at a target angle. Aim and fire.

// 30°/45°/60°/90° and their reflections across all four quadrants
const L1_KEY_ANGLES = [
  30, 45, 60, 90,           // Q1
  120, 135, 150, 180,       // Q2 + straight
  210, 225, 240, 270,       // Q3
  300, 315, 330,            // Q4
];

export function makeL1Question(): AngleQuestion {
  const target = pick(L1_KEY_ANGLES);
  const prompt = "Drag the cannon to aim, then press Fire.";

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

// ─── Level 2 — Missing-angle sets ────────────────────────────────────────────
// A fixed-start cannon must sweep anticlockwise by the missing sector amount.

type L2SetType = {
  total: 90 | 180 | 360;
  kind: "COMPLEMENTARY" | "SUPPLEMENTARY" | "COMPLETE";
  minCount: number;
};

const L2_SET_TYPES: L2SetType[] = [
  { total: 90, kind: "COMPLEMENTARY", minCount: 2 },
  { total: 180, kind: "SUPPLEMENTARY", minCount: 2 },
  { total: 360, kind: "COMPLETE", minCount: 3 },
];

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function buildSectorSet(total: number, count: number): number[] {
  const totalUnits = total / 5;
  const minUnits = 4; // 20°
  let remaining = totalUnits - minUnits * count;
  const units = Array.from({ length: count }, () => minUnits);
  for (let i = 0; i < count - 1; i++) {
    const extra = randomInt(0, remaining);
    units[i] += extra;
    remaining -= extra;
  }
  units[count - 1] += remaining;
  return units
    .map((u) => u * 5)
    .sort(() => Math.random() - 0.5);
}

export function makeL2Question(): AngleQuestion {
  let setType: L2SetType;
  let count: number;
  let sectors: number[];
  let unknownIdx: number;
  let startAngleDeg: number;
  let answer: number;
  let hiddenAngleDeg: number;

  do {
    setType = pick(L2_SET_TYPES);
    const maxCount = Math.min(5, Math.floor(setType.total / 10));
    count = randomInt(setType.minCount, maxCount);
    sectors = buildSectorSet(setType.total, count);
    unknownIdx = randomInt(0, count - 2); // keep the target before the final boundary
    startAngleDeg = sum(sectors.slice(0, unknownIdx));
    answer = sectors[unknownIdx];
    hiddenAngleDeg = startAngleDeg + answer;
  } while (answer < 30);

  let running = 0;
  const sectorArcs: AngleSector[] = sectors.map((value, idx) => {
    const fromAngle = running;
    const toAngle = running + value;
    running = toAngle;
    return {
      fromAngle,
      toAngle,
      label: idx === unknownIdx ? "?" : `${value}°`,
      missing: idx === unknownIdx,
    };
  });

  const dividerAngles = Array.from(new Set([0, ...sectorArcs.map((s) => s.toAngle)])).filter((a) => a < 360);
  const prompt = "Find the missing angle. Drag the cannon to aim, then press Fire.";

  return {
    id: nextId(),
    level: 2,
    prompt,
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

export function makeL3Question(): AngleQuestion {
  return makeL2Question();
}

// Convenience dispatcher
export function makeQuestion(level: 1 | 2 | 3): AngleQuestion {
  if (level === 1) return makeL1Question();
  return makeL2Question();
}

export function makeMonsterL3Question(): AngleQuestion {
  return makeL2Question();
}
