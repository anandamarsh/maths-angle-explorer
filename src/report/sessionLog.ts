// src/report/sessionLog.ts

import type { AngleSector } from "../game/angles";

export interface QuestionAttempt {
  questionNumber: number;
  prompt: string;
  level: 1 | 2 | 3;
  correctAnswer: number;      // correct angle in degrees
  childAnswer: number | null; // typed angle (null if aim-only shot)
  isCorrect: boolean;
  timestamp: number;
  timeTakenMs: number;
  gamePhase: "normal" | "monster" | "platinum";
  // Level 2 sector data (for PDF diagram)
  sectorArcs?: AngleSector[];
  dividerAngles?: number[];
  totalContext?: 90 | 180 | 360;
  startAngleDeg?: number;
  setKind?: "COMPLEMENTARY" | "SUPPLEMENTARY" | "COMPLETE";
}

export interface SessionSummary {
  playerName: string;
  level: 1 | 2 | 3;
  date: string;
  startTime: number;
  endTime: number;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;               // 0-100
  normalEggs: number;
  monsterEggs: number;
  levelCompleted: boolean;
  monsterRoundCompleted: boolean;
  attempts: QuestionAttempt[];
}

// --- Module-level state (NOT React state) ---

let _attempts: QuestionAttempt[] = [];
let _questionStartTime: number = Date.now();
let _sessionStartTime: number = Date.now();
let _questionCounter: number = 0;

export function startSession() {
  _attempts = [];
  _questionCounter = 0;
  _sessionStartTime = Date.now();
  startQuestionTimer();
}

export function startQuestionTimer() {
  _questionStartTime = Date.now();
}

export function logAttempt(attempt: Omit<QuestionAttempt, "questionNumber" | "timeTakenMs" | "timestamp">) {
  _questionCounter++;
  _attempts.push({
    ...attempt,
    questionNumber: _questionCounter,
    timestamp: Date.now(),
    timeTakenMs: Date.now() - _questionStartTime,
  });
  _questionStartTime = Date.now();
}

export function buildSummary(opts: {
  playerName: string;
  level: 1 | 2 | 3;
  normalEggs: number;
  monsterEggs: number;
  levelCompleted: boolean;
  monsterRoundCompleted: boolean;
}): SessionSummary {
  const correctCount = _attempts.filter(a => a.isCorrect).length;
  return {
    playerName: opts.playerName,
    level: opts.level,
    date: new Date().toISOString(),
    startTime: _sessionStartTime,
    endTime: Date.now(),
    totalQuestions: _attempts.length,
    correctCount,
    accuracy: _attempts.length > 0 ? Math.round((correctCount / _attempts.length) * 100) : 0,
    normalEggs: opts.normalEggs,
    monsterEggs: opts.monsterEggs,
    levelCompleted: opts.levelCompleted,
    monsterRoundCompleted: opts.monsterRoundCompleted,
    attempts: [..._attempts],
  };
}

export function clearSession() {
  _attempts = [];
  _questionCounter = 0;
}

export function getAttemptCount() {
  return _attempts.length;
}
