import { createLevelThreeNormalQuestion } from "./normal.ts";

export function createLevelThreePlatinumQuestion(random: () => number = Math.random) {
  return createLevelThreeNormalQuestion(random);
}
