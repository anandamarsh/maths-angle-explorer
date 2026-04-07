// src/report/generatePdf.ts

import { jsPDF } from "jspdf";
import type { SessionSummary, QuestionAttempt } from "./sessionLog";
import type { TFunction, TranslationKey } from "../i18n/types";

// --- Color palette ---

const COLORS = {
  headerBg: "#f1f5f9",
  headerBorder: "#cbd5e1",
  correctBg: "#f0fdf4",
  correctBorder: "#22c55e",
  correctDark: "#16a34a",
  wrongBg: "#fff5f5",
  wrongBorder: "#ef4444",
  accentPurple: "#a855f7",
  textDark: "#1e293b",
  textMuted: "#64748b",
};

// --- Curriculum metadata (mirrors manifest teachesLevels) ---

const CURRICULUM_LEVELS = [
  {
    code: "MA2-16MG",
    stageKey: "pdf.curriculum.stage2",
    syllabusUrl: "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=29",
    descriptionKey: "pdf.curriculum.desc2",
    levelDescKey: "pdf.curriculum.levelDesc1",
  },
  {
    code: "MA3-16MG",
    stageKey: "pdf.curriculum.stage3",
    syllabusUrl: "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=40",
    descriptionKey: "pdf.curriculum.desc3",
    levelDescKey: "pdf.curriculum.levelDesc2",
  },
  {
    code: "MA4-18MG",
    stageKey: "pdf.curriculum.stage4",
    syllabusUrl: "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=52",
    descriptionKey: "pdf.curriculum.desc4",
    levelDescKey: "pdf.curriculum.levelDesc3",
  },
] as const satisfies ReadonlyArray<{
  code: string;
  stageKey: TranslationKey;
  syllabusUrl: string;
  descriptionKey: TranslationKey;
  levelDescKey: TranslationKey;
}>;

// --- Unicode font loading ---

const UNICODE_FONT_MAP: Partial<Record<string, string>> = {
  hi: "/fonts/NotoSansDevanagari-Regular.ttf",
  zh: "/fonts/ArialUnicode.ttf",
  en: "/fonts/NotoSans-Regular.ttf",
};

async function loadFontBase64(locale: string): Promise<{ name: string; base64: string } | null> {
  const url = UNICODE_FONT_MAP[locale] ?? "/fonts/NotoSans-Regular.ttf";
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    // Efficient base64 encoding — process in chunks to avoid O(n²) string concat
    const bytes = new Uint8Array(buf);
    const CHUNK = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const name = locale === "hi" ? "NotoSansDevanagari" : locale === "zh" ? "ArialUnicode" : "NotoSans";
    return { name, base64: btoa(binary) };
  } catch {
    return null;
  }
}

// --- Text sanitiser ---

function sanitize(text: string, useUnicode = false): string {
  if (useUnicode) {
    return text.replace(/\u2192/g, "\u2192").replace(/\u2013/g, "-").replace(/\u2014/g, "-");
  }
  return text
    .replace(/°/g, "\u00b0")
    .replace(/\u2192/g, "->")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/[^\x00-\xFF]/g, "?");
}

// --- Helpers ---

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// --- Icon loader ---

async function loadIconBase64(): Promise<string | null> {
  try {
    const svgRes = await fetch("/favicon.svg");
    if (svgRes.ok) {
      const svgText = await svgRes.text();
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const size = 512;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
    }
    const pngRes = await fetch("/icon-512.png");
    const pngBlob = await pngRes.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(pngBlob);
    });
  } catch {
    return null;
  }
}

// --- Star decorator ---

function drawStar(doc: jsPDF, cx: number, cy: number, outerR: number, innerR: number, color: string) {
  const pts = 5;
  const verts: [number, number][] = [];
  for (let i = 0; i < pts * 2; i++) {
    const angle = (i * Math.PI / pts) - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    verts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  const lines: number[][] = verts.slice(1).map((pt, i) => [pt[0] - verts[i][0], pt[1] - verts[i][1]]);
  lines.push([verts[0][0] - verts[verts.length - 1][0], verts[0][1] - verts[verts.length - 1][1]]);
  doc.setFillColor(color);
  doc.lines(lines, verts[0][0], verts[0][1], [1, 1], "F", true);
}

// --- Level 1 angle diagram: vertex + two rays + arc + labels, centered in box ---

function drawLevel1AngleDiagram(
  doc: jsPDF,
  attempt: QuestionAttempt,
  x: number,
  y: number,
  width: number,
  height: number,
  mainFont: string,
) {
  // Light background
  doc.setFillColor("#f8fafc");
  doc.roundedRect(x, y, width, height, 3, 3, "F");
  doc.setDrawColor("#e2e8f0");
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 3, 3, "S");

  const correctAngle = attempt.correctAnswer;
  const userAngle = !attempt.isCorrect && attempt.childAnswer !== null ? attempt.childAnswer : null;

  const correctRad = (correctAngle * Math.PI) / 180;
  const cosA = Math.cos(correctRad);
  const sinA = Math.sin(correctRad);

  // Arc radius as fraction of ray length
  const ARC_FRAC = 0.38;
  // Correct label: just beyond arc at midpoint direction
  const LABEL_FRAC = ARC_FRAC + 0.20;
  // User (wrong) label: placed AT the tip of the user ray (beyond all arcs → never overlaps)
  const USER_LABEL_TIP_FRAC = 1.12;

  const midRad = (correctAngle / 2) * Math.PI / 180;

  // --- Build normalized bounding box including all elements ---
  const normPts: Array<[number, number]> = [
    [0, 0],
    [1, 0],                                                            // base ray tip
    [cosA, -sinA],                                                     // correct ray tip
    [LABEL_FRAC * Math.cos(midRad), -LABEL_FRAC * Math.sin(midRad)], // correct label
  ];
  for (let i = 0; i <= 8; i++) {
    const a = (correctAngle * i / 8) * Math.PI / 180;
    normPts.push([ARC_FRAC * Math.cos(a), -ARC_FRAC * Math.sin(a)]);
  }

  if (userAngle !== null) {
    const uRad = userAngle * Math.PI / 180;
    const cosU = Math.cos(uRad), sinU = Math.sin(uRad);
    normPts.push([cosU, -sinU]);
    // User label is placed at the tip of the user ray (slightly beyond)
    normPts.push([USER_LABEL_TIP_FRAC * cosU, -USER_LABEL_TIP_FRAC * sinU]);
    for (let i = 0; i <= 6; i++) {
      const a = (userAngle * i / 6) * Math.PI / 180;
      normPts.push([ARC_FRAC * 0.65 * Math.cos(a), -ARC_FRAC * 0.65 * Math.sin(a)]);
    }
  }

  const allNX = normPts.map(p => p[0]);
  const allNY = normPts.map(p => p[1]);
  const minNX = Math.min(...allNX), maxNX = Math.max(...allNX);
  const minNY = Math.min(...allNY), maxNY = Math.max(...allNY);
  const spanX = Math.max(maxNX - minNX, 0.01);
  const spanY = Math.max(maxNY - minNY, 0.01);

  const fitPad = 8;
  const fitW = width - 2 * fitPad;
  const fitH = height - 2 * fitPad;
  const L = Math.min(fitW / spanX, fitH / spanY, 26);

  const bboxCX = (minNX + maxNX) / 2;
  const bboxCY = (minNY + maxNY) / 2;
  const vx = x + width / 2 - bboxCX * L;
  const vy = y + height / 2 - bboxCY * L;

  const arcR = ARC_FRAC * L;
  const ARC_SEGS = 32;

  function drawArc(fromDeg: number, toDeg: number, r: number, color: string, lw: number) {
    doc.setDrawColor(color);
    doc.setLineWidth(lw);
    for (let i = 0; i < ARC_SEGS; i++) {
      const a1 = (fromDeg + (toDeg - fromDeg) * (i / ARC_SEGS)) * Math.PI / 180;
      const a2 = (fromDeg + (toDeg - fromDeg) * ((i + 1) / ARC_SEGS)) * Math.PI / 180;
      doc.line(
        vx + r * Math.cos(a1), vy - r * Math.sin(a1),
        vx + r * Math.cos(a2), vy - r * Math.sin(a2),
      );
    }
  }

  // ~20% lighter than #334155: mix toward white by 20%
  const DARK = "#5c6777";
  const RED = "#ef4444";

  if (userAngle !== null) {
    drawArc(0, userAngle, arcR * 0.65, RED, 0.5);
  }
  drawArc(0, correctAngle, arcR, DARK, 0.8);

  doc.setDrawColor(DARK);
  doc.setLineWidth(0.9);
  doc.line(vx, vy, vx + L, vy);

  doc.setDrawColor(DARK);
  doc.setLineWidth(0.9);
  doc.line(vx, vy, vx + L * cosA, vy - L * sinA);

  if (userAngle !== null) {
    const uRad = userAngle * Math.PI / 180;
    doc.setDrawColor(RED);
    doc.setLineWidth(0.6);
    doc.line(vx, vy, vx + L * Math.cos(uRad), vy - L * Math.sin(uRad));
  }

  doc.setFillColor(DARK);
  doc.circle(vx, vy, 0.9, "F");

  // Correct angle label — just beyond arc at midpoint direction
  const lx = vx + LABEL_FRAC * L * Math.cos(midRad);
  const ly = vy - LABEL_FRAC * L * Math.sin(midRad);
  doc.setFontSize(7);
  doc.setFont(mainFont, "bold");
  doc.setTextColor(DARK);
  doc.text(`${correctAngle}\u00b0`, lx, ly, { align: "center" });

  // Wrong answer label — at tip of user ray, never overlaps arcs or correct label
  if (userAngle !== null) {
    const uRad = userAngle * Math.PI / 180;
    const ulx = vx + USER_LABEL_TIP_FRAC * L * Math.cos(uRad);
    const uly = vy - USER_LABEL_TIP_FRAC * L * Math.sin(uRad);
    doc.setFontSize(6);
    doc.setFont(mainFont, "normal");
    doc.setTextColor(RED);
    doc.text(`${userAngle}\u00b0`, ulx, uly, { align: "center" });
  }
}

// --- Level 2 sector diagram ---

function drawLevel2SectorDiagram(
  doc: jsPDF,
  attempt: QuestionAttempt,
  x: number,
  y: number,
  width: number,
  height: number,
  mainFont: string,
) {
  // Always light background — consistent with Level 1 style
  doc.setFillColor("#f8fafc");
  doc.roundedRect(x, y, width, height, 3, 3, "F");
  doc.setDrawColor("#e2e8f0");
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 3, 3, "S");

  const cx = x + width / 2;
  const cy = y + height / 2;
  const r = Math.min(width, height) * 0.32;

  const sectorArcs = attempt.sectorArcs;

  if (!sectorArcs || sectorArcs.length === 0) {
    doc.setFontSize(7);
    doc.setFont(mainFont, "bold");
    doc.setTextColor("#f59e0b");
    doc.text(`${attempt.correctAnswer}\u00b0`, cx, cy + 1, { align: "center" });
    return;
  }

  const ARC_SEGS = 20;
  // Arc drawn at 72% of r; labels between arc and ray tips
  const arcFrac = 0.72;
  // Label at 88% of r — between arc (72%) and ray tips (100%), close to arc
  const labelFrac = 0.88;

  // Light theme colors (consistent across all phases)
  const dividerColor = "#475569";
  const knownArcColor = "#6b7280";
  const missingArcColor = "#f59e0b";
  const knownLabelColor = "#1e293b";
  const missingLabelColor = "#d97706";

  // Draw sector arcs and divider rays
  for (const sector of sectorArcs) {
    const isMissing = !!sector.missing;
    const arcColor = isMissing ? missingArcColor : knownArcColor;
    const arcR = r * arcFrac;

    // Sector arc
    doc.setDrawColor(arcColor);
    doc.setLineWidth(0.5);
    for (let i = 0; i < ARC_SEGS; i++) {
      const a1 = (sector.fromAngle + (sector.toAngle - sector.fromAngle) * (i / ARC_SEGS)) * Math.PI / 180;
      const a2 = (sector.fromAngle + (sector.toAngle - sector.fromAngle) * ((i + 1) / ARC_SEGS)) * Math.PI / 180;
      doc.line(
        cx + arcR * Math.cos(a1), cy - arcR * Math.sin(a1),
        cx + arcR * Math.cos(a2), cy - arcR * Math.sin(a2),
      );
    }

    // Divider rays
    doc.setDrawColor(dividerColor);
    doc.setLineWidth(0.5);
    const fromRad = (sector.fromAngle * Math.PI) / 180;
    const toRad = (sector.toAngle * Math.PI) / 180;
    doc.line(cx, cy, cx + r * Math.cos(fromRad), cy - r * Math.sin(fromRad));
    doc.line(cx, cy, cx + r * Math.cos(toRad), cy - r * Math.sin(toRad));

    // Label — placed between arc and ray tips (labelFrac = 0.88), at sector midpoint angle
    const midAngle = (sector.fromAngle + sector.toAngle) / 2;
    const midRad = (midAngle * Math.PI) / 180;
    const lDist = r * labelFrac;
    const lx = cx + lDist * Math.cos(midRad);
    const ly = cy - lDist * Math.sin(midRad);
    doc.setFontSize(5.5);
    doc.setFont(mainFont, "bold");
    doc.setTextColor(isMissing ? missingLabelColor : knownLabelColor);
    doc.text(sector.label ?? "", lx, ly, { align: "center" });
  }

  // Center dot
  doc.setFillColor("#475569");
  doc.circle(cx, cy, 0.5, "F");
}

// --- Diagram dispatcher ---

function drawAngleDiagram(
  doc: jsPDF,
  attempt: QuestionAttempt,
  x: number,
  y: number,
  width: number,
  height: number,
  mainFont: string,
) {
  if (attempt.level === 2 || attempt.level === 3) {
    drawLevel2SectorDiagram(doc, attempt, x, y, width, height, mainFont);
  } else {
    drawLevel1AngleDiagram(doc, attempt, x, y, width, height, mainFont);
  }
}

// --- Main PDF generation ---

export async function generateSessionPdf(summary: SessionSummary, t: TFunction, locale = "en"): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const margin = 15;
  const contentW = pageW - margin * 2;              // 180
  let curY = margin;

  // Load Unicode font for non-Latin scripts
  const fontData = await loadFontBase64(locale);
  const unicodeFont = fontData?.name ?? null;
  if (fontData && unicodeFont) {
    const fileName = `${unicodeFont}-Regular.ttf`;
    doc.addFileToVFS(fileName, fontData.base64);
    doc.addFont(fileName, unicodeFont, "normal");
    doc.addFont(fileName, unicodeFont, "bold");
    doc.setFont(unicodeFont, "normal");
  }

  const useUnicode = unicodeFont !== null;
  const mainFont = unicodeFont ?? "helvetica";

  const iconBase64 = await loadIconBase64();

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER BANNER
  // ═══════════════════════════════════════════════════════════════════════════

  const bannerH = 28;
  doc.setFillColor(COLORS.headerBg);
  doc.roundedRect(margin, curY, contentW, bannerH, 4, 4, "F");
  doc.setDrawColor(COLORS.headerBorder);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, curY, contentW, bannerH, 4, 4, "S");

  const iconSize = 20;
  const iconPad = 4;
  const iconX = margin + iconPad;
  const iconY = curY + (bannerH - iconSize) / 2;

  if (iconBase64) {
    doc.addImage(iconBase64, "PNG", iconX, iconY, iconSize, iconSize);
  }

  const titleColX = margin + iconPad + iconSize + 4;
  const titleColW = (margin + contentW) - titleColX - iconPad;
  const titleCX = titleColX + titleColW / 2;

  doc.setTextColor(COLORS.textDark);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text("Angle Explorer", titleCX, curY + 11, { align: "center" });

  const line2Y = curY + 21;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  const dateStr = sanitize(formatDate(summary.date), false);
  const bannerLeft = summary.playerName
    ? `${summary.playerName}  ·  ${dateStr}`
    : dateStr;
  doc.text(bannerLeft, titleColX, line2Y);
  doc.text(
    `${formatTime(summary.startTime)} - ${formatTime(summary.endTime)}`,
    margin + contentW - iconPad, line2Y, { align: "right" }
  );

  doc.setFontSize(9);
  doc.setFont(mainFont, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(t("pdf.sessionReport", { level: summary.level }), titleCX, line2Y, { align: "center" });

  curY += bannerH + 14;

  // ═══════════════════════════════════════════════════════════════════════════
  // NSW MATHEMATICS CURRICULUM
  // ═══════════════════════════════════════════════════════════════════════════

  const curr = CURRICULUM_LEVELS[Math.min(summary.level - 1, CURRICULUM_LEVELS.length - 1)];
  const currStageLabel = t(curr.stageKey);
  const currDescription = t(curr.descriptionKey);
  const currLevelDesc = t(curr.levelDescKey);
  const currLineH = 4.8;
  const GREEN = "#16a34a";
  const CURR_BLUE = "#1e40af";

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  const pillText = curr.code;
  const pillPadX = 3;
  const pillH = 5;
  const pillW = doc.getTextWidth(pillText) + pillPadX * 2;

  doc.setFontSize(8);
  doc.setFont(mainFont, "normal");
  const stageW = doc.getTextWidth(sanitize(currStageLabel, useUnicode));
  const descAvailW = contentW - pillW - 4 - stageW - 4;
  const descWrapped = doc.splitTextToSize(sanitize(currDescription, useUnicode), descAvailW);

  // Title
  doc.setFontSize(9);
  doc.setFont(mainFont, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(t("pdf.nswCurriculum"), margin, curY);
  curY += 5.5 + 3.5;

  // Pill + stage + description row
  const pillTopY = curY - pillH + 1.5;
  doc.setFillColor(GREEN);
  doc.roundedRect(margin, pillTopY, pillW, pillH, 1.5, 1.5, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#ffffff");
  doc.text(pillText, margin + pillPadX, curY);

  const rowH = Math.max(pillH, descWrapped.length * currLineH) + 1;
  doc.link(margin, pillTopY, contentW, rowH, { url: curr.syllabusUrl });

  const stageX = margin + pillW + 4;
  doc.setFontSize(8);
  doc.setFont(mainFont, "normal");
  doc.setTextColor(CURR_BLUE);
  doc.text(sanitize(currStageLabel, useUnicode), stageX, curY);
  doc.text(descWrapped, stageX + stageW + 4, curY);
  curY += Math.max(pillH + 1, descWrapped.length * currLineH) + 3.5;

  // Objective line — with extra gap below before the round lines
  doc.setFontSize(8);
  doc.setFont(mainFont, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(t("pdf.objective"), margin, curY);
  const objLabelW = doc.getTextWidth(t("pdf.objective")); // measure with mainFont while it's still active
  doc.setFont("helvetica", "normal");
  doc.setFont(mainFont, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    sanitize(currLevelDesc, useUnicode),
    margin + objLabelW + 2, curY
  );
  curY += currLineH + 3;  // extra gap after Objective

  // Blackout Round
  doc.setFont(mainFont, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(t("pdf.blackoutRound"), margin, curY);
  doc.setFont(mainFont, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    t("pdf.blackoutDesc"),
    margin + doc.getTextWidth(t("pdf.blackoutRound")) + 2, curY
  );
  curY += currLineH;

  // Monster Round
  doc.setFont(mainFont, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(t("pdf.monsterRound"), margin, curY);
  doc.setFont(mainFont, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    t("pdf.monsterDesc"),
    margin + doc.getTextWidth(t("pdf.monsterRound")) + 2, curY
  );
  curY += currLineH;

  // Platinum Round
  doc.setFont(mainFont, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(t("pdf.platinumRound"), margin, curY);
  doc.setFont(mainFont, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    t("pdf.platinumDesc"),
    margin + doc.getTextWidth(t("pdf.platinumRound")) + 2, curY
  );
  curY += 8;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE BOXES
  // ═══════════════════════════════════════════════════════════════════════════

  const boxW = (contentW - 8) / 3;
  const boxH = 18;

  const scoreColor = "#1d4ed8";
  const scoreBg = "#eff6ff";
  doc.setFillColor(scoreBg);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(scoreColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont(mainFont, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(t("pdf.scoreLabel"), margin + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont(mainFont, "bold");
  doc.setTextColor(scoreColor);
  doc.text(`${summary.correctCount} / ${summary.totalQuestions}`, margin + boxW / 2, curY + 13.5, { align: "center" });

  const box2X = margin + boxW + 4;
  const accColor = summary.accuracy >= 80 ? "#16a34a" : summary.accuracy >= 50 ? "#f59e0b" : "#dc2626";
  const accBg = summary.accuracy >= 80 ? "#f0fdf4" : summary.accuracy >= 50 ? "#fffbeb" : "#fff5f5";
  doc.setFillColor(accBg);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(accColor);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont(mainFont, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(t("pdf.accuracyLabel"), box2X + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont(mainFont, "bold");
  doc.setTextColor(accColor);
  doc.text(`${summary.accuracy}%`, box2X + boxW / 2, curY + 13.5, { align: "center" });

  const box3X = margin + (boxW + 4) * 2;
  doc.setFillColor("#faf5ff");
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(COLORS.accentPurple);
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont(mainFont, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(t("pdf.timeLabel"), box3X + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont(mainFont, "bold");
  doc.setTextColor(COLORS.accentPurple);
  doc.text(formatDuration(summary.endTime - summary.startTime), box3X + boxW / 2, curY + 13.5, { align: "center" });

  curY += boxH + 7;

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTEMPT STARS ROW
  // ═══════════════════════════════════════════════════════════════════════════

  const starStep = 6;
  const starOuterR = 2.5, starInnerR = 1.1;
  const maxPerRow = Math.floor(contentW / starStep);
  const starRowH = starOuterR * 2 + 3;

  for (let rowStart = 0; rowStart < summary.attempts.length; rowStart += maxPerRow) {
    const rowAttempts = summary.attempts.slice(rowStart, rowStart + maxPerRow);
    const rowWidth = rowAttempts.length * starStep;
    let starX = margin + (contentW - rowWidth) / 2 + starStep / 2;
    const starCY = curY + starOuterR;

    for (const attempt of rowAttempts) {
      let color: string;
      if (!attempt.isCorrect) {
        color = "#ef4444";
      } else if (attempt.gamePhase === "platinum") {
        color = "#94a3b8";
      } else if (attempt.gamePhase === "monster") {
        color = "#facc15";
      } else {
        color = "#d1d5db";
      }
      drawStar(doc, starX, starCY, starOuterR, starInnerR, color);
      starX += starStep;
    }
    curY += starRowH;
  }

  curY += 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTION CARDS
  // ═══════════════════════════════════════════════════════════════════════════

  const cardHeaderH = 10;
  const stripeW = 3;
  const cardGap = 5;
  const cardLeft = margin + cardGap;
  const cardRight = margin + contentW;
  const cardContentW = cardRight - cardLeft;

  const diagramW = 52;
  const diagramH = 52;

  for (const attempt of summary.attempts) {
    const cardBodyH = diagramH + 8;
    const estimatedCardH = cardHeaderH + cardBodyH;

    curY += cardGap;

    if (curY + estimatedCardH > pageH - margin) {
      doc.addPage();
      curY = margin + cardGap;
    }

    const cardBorderColor = attempt.isCorrect ? COLORS.correctBorder : COLORS.wrongBorder;
    const cardBg = attempt.isCorrect ? COLORS.correctBg : COLORS.wrongBg;

    // Card header
    doc.setFillColor(cardBg);
    doc.rect(cardLeft, curY, cardContentW, cardHeaderH, "F");

    const stripeH = cardHeaderH + cardBodyH;
    doc.setFillColor(cardBorderColor);
    doc.rect(cardLeft, curY, stripeW, stripeH, "F");

    doc.setFontSize(10);
    doc.setFont(mainFont, "bold");
    doc.setTextColor(COLORS.textDark);
    doc.text(`Q${attempt.questionNumber}`, cardLeft + stripeW + 3, curY + 6.8);

    const timeStr = formatDuration(attempt.timeTakenMs);
    doc.setFontSize(7);
    doc.setFont(mainFont, "normal");
    const timeW2 = doc.getTextWidth(timeStr);

    doc.setFontSize(9);
    doc.setFont(mainFont, "bold");
    const icon = attempt.isCorrect ? t("pdf.correct") : t("pdf.wrong");
    const iconW = doc.getTextWidth(icon);
    const groupRight = pageW - margin - 4;
    const groupStart = groupRight - iconW - 3 - timeW2;

    doc.setTextColor(cardBorderColor);
    doc.text(icon, groupStart, curY + 6.8);

    doc.setFontSize(7);
    doc.setFont(mainFont, "normal");
    doc.setTextColor(COLORS.textMuted);
    doc.text(timeStr, groupRight, curY + 6.8, { align: "right" });

    curY += cardHeaderH;

    // Diagram
    const bodyPad = 4;
    const diagramX = cardLeft + stripeW + 4;
    drawAngleDiagram(doc, attempt, diagramX, curY + bodyPad, diagramW, diagramH, mainFont);

    // Text area — NO prompt, just phase badge + answers
    const textX = diagramX + diagramW + 5;
    let textY = curY + bodyPad + 8;

    // Phase badge
    if (attempt.gamePhase === "platinum") {
      doc.setFontSize(6.5);
      doc.setFont(mainFont, "bold");
      doc.setTextColor("#94a3b8");
      doc.text(t("pdf.platinumBadge"), textX, textY);
      textY += 6;
    } else if (attempt.gamePhase === "monster") {
      doc.setFontSize(6.5);
      doc.setFont(mainFont, "bold");
      doc.setTextColor("#a855f7");
      doc.text(t("pdf.monsterBadge"), textX, textY);
      textY += 6;
    }

    // Your answer
    doc.setFontSize(8);
    doc.setFont(mainFont, "normal");
    doc.setTextColor(attempt.isCorrect ? COLORS.correctDark : COLORS.wrongBorder);
    const givenLabel = attempt.childAnswer !== null
      ? t("pdf.yourAnswer", { value: attempt.childAnswer })
      : t("pdf.yourAnswerAimed");
    doc.text(givenLabel, textX, textY);
    textY += 5;

    // Correct angle
    doc.setFont(mainFont, "normal");
    doc.setTextColor(COLORS.textDark);
    doc.text(t("pdf.correctAngle", { value: attempt.correctAnswer }), textX, textY);

    curY += cardBodyH;

    doc.setDrawColor("#e2e8f0");
    doc.setLineWidth(0.3);
    doc.line(cardLeft, curY, cardRight, curY);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENCOURAGEMENT SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  curY += cardGap;

  if (curY + 40 > pageH - margin) {
    doc.addPage();
    curY = margin;
  }

  const encStripH = 32;
  doc.setFillColor("#ede9fe");
  doc.roundedRect(margin, curY, contentW, encStripH, 4, 4, "F");

  const starCY = curY + encStripH / 2 - 2;
  drawStar(doc, margin + 11, starCY - 3, 5, 2.2, "#facc15");
  drawStar(doc, margin + 20, starCY + 4, 3.5, 1.5, "#fbbf24");
  drawStar(doc, margin + 9, starCY + 6, 2.5, 1.1, "#fde68a");

  const rEdge = margin + contentW;
  drawStar(doc, rEdge - 11, starCY - 3, 5, 2.2, "#facc15");
  drawStar(doc, rEdge - 20, starCY + 4, 3.5, 1.5, "#fbbf24");
  drawStar(doc, rEdge - 9, starCY + 6, 2.5, 1.1, "#fde68a");

  doc.setFontSize(13);
  doc.setFont(mainFont, "bold");
  doc.setTextColor(COLORS.accentPurple);
  const encouragement =
    summary.accuracy >= 90 ? t("pdf.encourage90") :
    summary.accuracy >= 70 ? t("pdf.encourage70") :
    summary.accuracy >= 50 ? t("pdf.encourage50") :
                             t("pdf.encourageBelow");
  doc.text(encouragement, pageW / 2, curY + 13, { align: "center" });

  const wrongAttempts = summary.attempts.filter(a => !a.isCorrect);
  if (wrongAttempts.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont(mainFont, "normal");
    doc.setTextColor(COLORS.textMuted);
    doc.text(
      t("pdf.tip"),
      pageW / 2, curY + 22, { align: "center" }
    );
  }

  doc.setFontSize(7);
  doc.setTextColor("#94a3b8");
  doc.text(t("pdf.footer"), pageW / 2, pageH - 8, { align: "center" });
  doc.text("https://www.seemaths.com", pageW / 2, pageH - 4, { align: "center" });

  return doc.output("blob");
}
