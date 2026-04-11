import { createLevelOneMonsterQuestion } from "../calculations/level-1/monster.ts";
import { createLevelOneNormalQuestion } from "../calculations/level-1/normal.ts";
import { createLevelOnePlatinumQuestion } from "../calculations/level-1/platinum.ts";
import { createLevelTwoMonsterQuestion } from "../calculations/level-2/monster.ts";
import { createLevelTwoNormalQuestion } from "../calculations/level-2/normal.ts";
import { createLevelTwoPlatinumQuestion } from "../calculations/level-2/platinum.ts";
import { createLevelThreeMonsterQuestion } from "../calculations/level-3/monster.ts";
import { createLevelThreeNormalQuestion } from "../calculations/level-3/normal.ts";
import { createLevelThreePlatinumQuestion } from "../calculations/level-3/platinum.ts";
import type { AngleQuestion, AngleSector, GameRound, KnownEgg } from "../calculations/types.ts";

/**
 * Stable screen-facing facade. The actual question maths now lives under
 * `src/calculations/`, split by level and round.
 */
function gameplayLevel(level: 1 | 2 | 3): 1 | 2 | 3 {
  if (level === 2) return 3;
  if (level === 3) return 2;
  return 1;
}

export function makeL1Question(): AngleQuestion {
  return createLevelOneNormalQuestion();
}

export function makeL2Question(): AngleQuestion {
  return createLevelTwoNormalQuestion();
}

export function makeL3Question(): AngleQuestion {
  return createLevelThreeNormalQuestion();
}

export function makeMonsterL3Question(): AngleQuestion {
  return createLevelThreeMonsterQuestion();
}

export function makeQuestion(level: 1 | 2 | 3, round: GameRound = "normal"): AngleQuestion {
  const effectiveLevel = gameplayLevel(level);

  if (effectiveLevel === 1) {
    if (round === "monster") {
      return createLevelOneMonsterQuestion();
    }
    if (round === "platinum") {
      return createLevelOnePlatinumQuestion();
    }
    return createLevelOneNormalQuestion();
  }

  if (effectiveLevel === 2) {
    if (round === "monster") {
      return createLevelTwoMonsterQuestion();
    }
    if (round === "platinum") {
      return createLevelTwoPlatinumQuestion();
    }
    return createLevelTwoNormalQuestion();
  }

  if (round === "monster") {
    return createLevelThreeMonsterQuestion();
  }
  if (round === "platinum") {
    return createLevelThreePlatinumQuestion();
  }
  return createLevelThreeNormalQuestion();
}

export type { AngleQuestion, AngleSector, GameRound, KnownEgg };
