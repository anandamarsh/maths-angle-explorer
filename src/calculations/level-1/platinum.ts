import type { AngleQuestion } from "../types.ts";
import { createLevelOneNormalQuestion } from "./normal.ts";

/**
 * The platinum round currently reuses the same Level 1 angle-selection maths as
 * the normal round. The dedicated file keeps that boundary explicit.
 */
export function createLevelOnePlatinumQuestion(random: () => number = Math.random): AngleQuestion {
  return createLevelOneNormalQuestion(random);
}
