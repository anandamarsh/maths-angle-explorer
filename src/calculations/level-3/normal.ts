import type { AngleQuestion } from "../types.ts";

const LEVEL_THREE_ANGLES = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const;

export function createLevelThreeNormalQuestion(random: () => number = Math.random): AngleQuestion {
  const target =
    LEVEL_THREE_ANGLES[Math.floor(random() * LEVEL_THREE_ANGLES.length)] ?? 30;

  return {
    id: `l3-normal-${Math.random().toString(36).slice(2, 9)}`,
    level: 3,
    prompt: "Defend the cannon and shoot the incoming soldier.",
    answer: target,
    knownEggs: [],
    hiddenAngleDeg: target,
    totalContext: 360,
    startAngleDeg: 0,
  };
}
