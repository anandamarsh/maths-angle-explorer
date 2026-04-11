import { createLevelThreeNormalQuestion } from "./normal.ts";

export function createLevelThreeMonsterQuestion(random: () => number = Math.random) {
  return createLevelThreeNormalQuestion(random);
}
