import type { AngleQuestion } from "../types.ts";
import { createLevelTwoNormalQuestion } from "./normal.ts";

/**
 * The platinum round currently reuses the same missing-angle maths as the normal
 * round. The dedicated file keeps that boundary explicit.
 */
export function createLevelTwoPlatinumQuestion(random: () => number = Math.random): AngleQuestion {
  return createLevelTwoNormalQuestion(random);
}
