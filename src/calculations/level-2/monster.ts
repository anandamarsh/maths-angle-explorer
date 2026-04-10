import type { AngleQuestion } from "../types.ts";
import { createLevelTwoNormalQuestion } from "./normal.ts";

/**
 * The monster round currently reuses the same missing-angle maths as the normal
 * round. The dedicated file keeps that boundary explicit.
 */
export function createLevelTwoMonsterQuestion(random: () => number = Math.random): AngleQuestion {
  return createLevelTwoNormalQuestion(random);
}
