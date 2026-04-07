// src/report/testPdfData.ts — generates a test PDF with mock data for visual verification

import { generateSessionPdf } from "./generatePdf";
import type { SessionSummary, QuestionAttempt } from "./sessionLog";
import { getT } from "../i18n";

// Level 2 sector data helpers
function makeSectors(values: number[], unknownIdx: number) {
  let running = 0;
  return values.map((v, i) => {
    const from = running;
    running += v;
    return {
      fromAngle: from,
      toAngle: running,
      label: i === unknownIdx ? "?" : `${v}\u00b0`,
      missing: i === unknownIdx,
    };
  });
}

function makeDividers(values: number[]) {
  const divs: number[] = [0];
  let running = 0;
  for (const v of values) {
    running += v;
    divs.push(running);
  }
  return divs.filter(a => a < 360);
}

export async function generateTestPdf(): Promise<void> {
  const now = Date.now();

  // Build 12 mock attempts: 2 levels × (normal + monster + platinum) × 1 correct + 1 wrong
  const attempts: QuestionAttempt[] = [];
  let qNum = 0;

  // ── Level 1, Blackout (normal) ──────────────────────────────────────────────
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Aim the cannon at the correct angle.",
    level: 1,
    correctAnswer: 62,
    childAnswer: 62,
    isCorrect: true,
    timestamp: now,
    timeTakenMs: 8200,
    gamePhase: "normal",
  });
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Aim the cannon at the correct angle.",
    level: 1,
    correctAnswer: 135,
    childAnswer: 120,
    isCorrect: false,
    timestamp: now,
    timeTakenMs: 11500,
    gamePhase: "normal",
  });

  // ── Level 1, Monster ───────────────────────────────────────────────────────
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Aim the cannon at the correct angle.",
    level: 1,
    correctAnswer: 270,
    childAnswer: 270,
    isCorrect: true,
    timestamp: now,
    timeTakenMs: 6700,
    gamePhase: "monster",
  });
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Aim the cannon at the correct angle.",
    level: 1,
    correctAnswer: 315,
    childAnswer: 300,
    isCorrect: false,
    timestamp: now,
    timeTakenMs: 9100,
    gamePhase: "monster",
  });

  // ── Level 1, Platinum ──────────────────────────────────────────────────────
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Type the angle and fire blind.",
    level: 1,
    correctAnswer: 45,
    childAnswer: 45,
    isCorrect: true,
    timestamp: now,
    timeTakenMs: 5300,
    gamePhase: "platinum",
  });
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Type the angle and fire blind.",
    level: 1,
    correctAnswer: 180,
    childAnswer: 160,
    isCorrect: false,
    timestamp: now,
    timeTakenMs: 14200,
    gamePhase: "platinum",
  });

  // ── Level 2, Blackout (normal) ─────────────────────────────────────────────
  const l2n_vals = [50, 80, 50, 180]; // total 360, missing idx=1 (80)
  const l2n_sectors = makeSectors(l2n_vals, 1);
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Find the missing angle in the diagram.",
    level: 2,
    correctAnswer: 80,
    childAnswer: 80,
    isCorrect: true,
    timestamp: now,
    timeTakenMs: 12000,
    gamePhase: "normal",
    sectorArcs: l2n_sectors,
    dividerAngles: makeDividers(l2n_vals),
    totalContext: 360,
    startAngleDeg: 50,
    setKind: "COMPLETE",
  });
  const l2n2_vals = [30, 60, 90]; // total 180, missing idx=0 (30)
  const l2n2_sectors = makeSectors(l2n2_vals, 0);
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Find the missing angle in the diagram.",
    level: 2,
    correctAnswer: 30,
    childAnswer: 45,
    isCorrect: false,
    timestamp: now,
    timeTakenMs: 18500,
    gamePhase: "normal",
    sectorArcs: l2n2_sectors,
    dividerAngles: makeDividers(l2n2_vals),
    totalContext: 180,
    startAngleDeg: 0,
    setKind: "SUPPLEMENTARY",
  });

  // ── Level 2, Monster ───────────────────────────────────────────────────────
  // Simpler: [100, 105, 50, 70, 35] total=360, missing idx=4 (35)
  const l2m_v2 = [100, 105, 50, 70, 35];
  const l2m_sectors = makeSectors(l2m_v2, 4);
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Find the missing angle.",
    level: 2,
    correctAnswer: 35,
    childAnswer: 35,
    isCorrect: true,
    timestamp: now,
    timeTakenMs: 9800,
    gamePhase: "monster",
    sectorArcs: l2m_sectors,
    dividerAngles: makeDividers(l2m_v2),
    totalContext: 360,
    startAngleDeg: 325,
    setKind: "COMPLETE",
  });
  const l2m2_v = [30, 60]; // total=90, missing idx=1 (60)
  const l2m2_sectors = makeSectors(l2m2_v, 1);
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Find the missing angle.",
    level: 2,
    correctAnswer: 60,
    childAnswer: 50,
    isCorrect: false,
    timestamp: now,
    timeTakenMs: 15200,
    gamePhase: "monster",
    sectorArcs: l2m2_sectors,
    dividerAngles: makeDividers(l2m2_v),
    totalContext: 90,
    startAngleDeg: 30,
    setKind: "COMPLEMENTARY",
  });

  // ── Level 2, Platinum ──────────────────────────────────────────────────────
  const l2p_v = [120, 90, 150]; // total=360, missing idx=0 (120)
  const l2p_sectors = makeSectors(l2p_v, 0);
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Type the missing angle.",
    level: 2,
    correctAnswer: 120,
    childAnswer: 120,
    isCorrect: true,
    timestamp: now,
    timeTakenMs: 7600,
    gamePhase: "platinum",
    sectorArcs: l2p_sectors,
    dividerAngles: makeDividers(l2p_v),
    totalContext: 360,
    startAngleDeg: 0,
    setKind: "COMPLETE",
  });
  const l2p2_v = [40, 50, 90]; // total=180, missing idx=1 (50)
  const l2p2_sectors = makeSectors(l2p2_v, 1);
  qNum++;
  attempts.push({
    questionNumber: qNum,
    prompt: "Type the missing angle.",
    level: 2,
    correctAnswer: 50,
    childAnswer: 55,
    isCorrect: false,
    timestamp: now,
    timeTakenMs: 11800,
    gamePhase: "platinum",
    sectorArcs: l2p2_sectors,
    dividerAngles: makeDividers(l2p2_v),
    totalContext: 180,
    startAngleDeg: 40,
    setKind: "SUPPLEMENTARY",
  });

  const correct = attempts.filter(a => a.isCorrect).length;
  const summary: SessionSummary = {
    playerName: "Test Explorer",
    level: 2,
    date: new Date().toISOString(),
    startTime: now - 8 * 60 * 1000,
    endTime: now,
    totalQuestions: attempts.length,
    correctCount: correct,
    accuracy: Math.round((correct / attempts.length) * 100),
    normalEggs: 10,
    monsterEggs: 10,
    levelCompleted: true,
    monsterRoundCompleted: true,
    attempts,
  };

  const blob = await generateSessionPdf(summary, getT("en"));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "angle-explorer-test-report.pdf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
