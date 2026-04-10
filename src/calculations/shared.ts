import { texts } from "../texts.ts";
import type { AngleQuestion, AngleSector } from "./types.ts";

const L1_KEY_ANGLES = [
  30, 45, 60, 90,
  120, 135, 150, 180,
  210, 225, 240, 270,
  300, 315, 330,
] as const;

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

let idCounter = 0;

export function pick<T>(arr: readonly T[], random: () => number = Math.random): T {
  return arr[Math.floor(random() * arr.length)];
}

export function randomInt(min: number, max: number, random: () => number = Math.random): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function sum(values: number[]): number {
  return values.reduce((accumulator, value) => accumulator + value, 0);
}

export function createQuestionId(): string {
  idCounter += 1;
  return `q${idCounter}_${Date.now()}`;
}

/**
 * Builds a set of sectors that always totals the requested angle. Every sector is
 * a multiple of 5 degrees so the child always sees friendly classroom values.
 */
export function buildSectorSet(
  total: number,
  count: number,
  random: () => number = Math.random,
): number[] {
  const totalUnits = total / 5;
  const minUnits = 4;
  let remaining = totalUnits - minUnits * count;
  const units = Array.from({ length: count }, () => minUnits);
  for (let i = 0; i < count - 1; i += 1) {
    const extra = randomInt(0, remaining, random);
    units[i] += extra;
    remaining -= extra;
  }
  units[count - 1] += remaining;

  const degrees = units.map((value) => value * 5);
  for (let i = degrees.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [degrees[i], degrees[j]] = [degrees[j], degrees[i]];
  }
  return degrees;
}

export function createLevelOneQuestion(random: () => number = Math.random): AngleQuestion {
  const target = pick(L1_KEY_ANGLES, random);
  return {
    id: createQuestionId(),
    level: 1,
    prompt: texts.levels["1"].prompts.normal,
    answer: target,
    knownEggs: [],
    hiddenAngleDeg: target,
    totalContext: 360,
  };
}

export function createLevelTwoQuestion(random: () => number = Math.random): AngleQuestion {
  let setType: L2SetType;
  let count: number;
  let sectors: number[];
  let unknownIdx: number;
  let startAngleDeg: number;
  let answer: number;
  let hiddenAngleDeg: number;

  do {
    setType = pick(L2_SET_TYPES, random);
    const maxCount = Math.min(5, Math.floor(setType.total / 10));
    count = randomInt(setType.minCount, maxCount, random);
    sectors = buildSectorSet(setType.total, count, random);
    unknownIdx = randomInt(0, count - 2, random);
    startAngleDeg = sum(sectors.slice(0, unknownIdx));
    answer = sectors[unknownIdx];
    hiddenAngleDeg = startAngleDeg + answer;
  } while (answer < 30);

  let running = 0;
  const sectorArcs: AngleSector[] = sectors.map((value, index) => {
    const fromAngle = running;
    const toAngle = running + value;
    running = toAngle;
    return {
      fromAngle,
      toAngle,
      label: index === unknownIdx ? "?" : `${value}°`,
      missing: index === unknownIdx,
    };
  });

  const dividerAngles = Array.from(new Set([0, ...sectorArcs.map((sector) => sector.toAngle)])).filter(
    (angle) => angle < 360,
  );

  return {
    id: createQuestionId(),
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
