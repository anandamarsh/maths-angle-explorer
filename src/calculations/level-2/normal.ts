import { createLevelTwoQuestion } from "../shared.ts";
import type { AngleQuestion } from "../types.ts";

/**
 * Standard Level 2 arithmetic: solve the missing sector in a 90, 180, or 360
 * degree set.
 */
export function createLevelTwoNormalQuestion(random: () => number = Math.random): AngleQuestion {
  return createLevelTwoQuestion(random);
}
