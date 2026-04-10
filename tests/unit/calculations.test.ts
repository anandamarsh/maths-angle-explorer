import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createLevelOneMonsterQuestion } from "../../src/calculations/level-1/monster.ts";
import { createLevelOneNormalQuestion } from "../../src/calculations/level-1/normal.ts";
import { createLevelOnePlatinumQuestion } from "../../src/calculations/level-1/platinum.ts";
import { createLevelTwoMonsterQuestion } from "../../src/calculations/level-2/monster.ts";
import { createLevelTwoNormalQuestion } from "../../src/calculations/level-2/normal.ts";
import { createLevelTwoPlatinumQuestion } from "../../src/calculations/level-2/platinum.ts";
import { buildSectorSet } from "../../src/calculations/shared.ts";

function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };
}

describe("Angle calculations", () => {
  it("creates a deterministic Level 1 landmark angle", () => {
    const question = createLevelOneNormalQuestion(() => 0);
    assert.equal(question.level, 1);
    assert.equal(question.answer, 30);
    assert.equal(question.hiddenAngleDeg, 30);
  });

  it("keeps Level 1 monster and platinum rounds on the same maths", () => {
    assert.equal(createLevelOneMonsterQuestion(() => 0).answer, 30);
    assert.equal(createLevelOnePlatinumQuestion(() => 0).answer, 30);
  });

  it("builds sector sets that preserve the requested total", () => {
    const sectors = buildSectorSet(180, 3, sequence([0, 0, 0]));
    assert.equal(sectors.reduce((sum, value) => sum + value, 0), 180);
    assert.ok(sectors.every((value) => value % 5 === 0));
  });

  it("creates a deterministic Level 2 missing-angle question", () => {
    const question = createLevelTwoNormalQuestion(sequence([0, 0, 0, 0, 0]));
    assert.equal(question.level, 2);
    assert.equal(question.totalContext, 90);
    assert.equal(question.answer, 70);
    assert.equal(question.hiddenAngleDeg, 70);
    assert.deepEqual(
      question.sectorArcs?.map((sector) => ({
        fromAngle: sector.fromAngle,
        toAngle: sector.toAngle,
        label: sector.label,
        missing: sector.missing,
      })),
      [
        { fromAngle: 0, toAngle: 70, label: "?", missing: true },
        { fromAngle: 70, toAngle: 90, label: "20°", missing: false },
      ],
    );
  });

  it("keeps Level 2 monster and platinum rounds on the same maths", () => {
    assert.equal(createLevelTwoMonsterQuestion(sequence([0, 0, 0, 0, 0])).answer, 70);
    assert.equal(createLevelTwoPlatinumQuestion(sequence([0, 0, 0, 0, 0])).answer, 70);
  });
});
