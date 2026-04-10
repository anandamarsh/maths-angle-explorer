import { createLevelOneQuestion } from "../shared.ts";
import type { AngleQuestion } from "../types.ts";

/**
 * Standard Level 1 arithmetic: identify the target landmark angle directly.
 */
export function createLevelOneNormalQuestion(random: () => number = Math.random): AngleQuestion {
  return createLevelOneQuestion(random);
}
