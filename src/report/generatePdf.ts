// src/report/generatePdf.ts

import { jsPDF } from "jspdf";
import type { SessionSummary, QuestionAttempt } from "./sessionLog";

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

// --- Angle indicator diagram ---

function drawAngleDiagram(
  doc: jsPDF,
  attempt: QuestionAttempt,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  // Dark background
  doc.setFillColor("#0f172a");
  doc.roundedRect(x, y, width, height, 3, 3, "F");
  doc.setDrawColor("#334155");
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 3, 3, "S");

  const cx = x + width / 2;
  const cy = y + height / 2 - 2;
  const r = Math.min(width, height) * 0.35;

  // Circle outline
  doc.setDrawColor("#1e3a5f");
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, r, "S");

  // Zero reference line (east, dashed-style via short segments)
  doc.setDrawColor("#475569");
  doc.setLineWidth(0.3);
  doc.line(cx, cy, cx + r, cy);

  // Helper to draw a ray at an angle (maths convention: 0=east, CCW)
  function drawRay(angleDeg: number, color: string, lineWidth: number, label: string, labelColor: string) {
    const rad = (angleDeg * Math.PI) / 180;
    const ex = cx + r * Math.cos(rad);
    const ey = cy - r * Math.sin(rad); // SVG y-axis is flipped
    doc.setDrawColor(color);
    doc.setLineWidth(lineWidth);
    doc.line(cx, cy, ex, ey);

    // Arrowhead
    const headLen = 1.5;
    const angle1 = rad + (2.8);
    const angle2 = rad - (2.8);
    doc.line(ex, ey, ex + headLen * Math.cos(angle1), ey - headLen * Math.sin(angle1));
    doc.line(ex, ey, ex + headLen * Math.cos(angle2), ey - headLen * Math.sin(angle2));

    // Label outside circle
    const labelR = r + 4;
    const lx = cx + labelR * Math.cos(rad);
    const ly = cy - labelR * Math.sin(rad);
    doc.setFontSize(5.5);
    doc.setTextColor(labelColor);
    doc.text(label, lx, ly, { align: "center" });
  }

  // Draw correct angle ray (gold)
  drawRay(attempt.correctAnswer, "#fbbf24", 0.8, `${attempt.correctAnswer}°`, "#fbbf24");

  // Draw child's answer ray (if typed and different from correct)
  if (attempt.childAnswer !== null) {
    const diff = Math.abs(attempt.childAnswer - attempt.correctAnswer);
    const isDifferent = diff > 1;
    if (isDifferent) {
      drawRay(attempt.childAnswer, attempt.isCorrect ? "#22c55e" : "#ef4444", 0.5,
        `${attempt.childAnswer}°`, attempt.isCorrect ? "#22c55e" : "#ef4444");
    }
  }

  // Center dot
  doc.setFillColor("#94a3b8");
  doc.circle(cx, cy, 0.8, "F");

  // Legend below
  const legendY = y + height - 4;
  doc.setFontSize(4.5);
  doc.setTextColor("#fbbf24");
  doc.text("■ target", x + 4, legendY);
  if (attempt.childAnswer !== null) {
    doc.setTextColor(attempt.isCorrect ? "#22c55e" : "#ef4444");
    doc.text("■ yours", x + 18, legendY);
  }
}

// --- Main PDF generation ---

export async function generateSessionPdf(summary: SessionSummary): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const margin = 15;
  const contentW = pageW - margin * 2;              // 180
  let curY = margin;

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
  doc.text(formatDate(summary.date), titleColX, line2Y);
  doc.text(
    `${formatTime(summary.startTime)} - ${formatTime(summary.endTime)}`,
    margin + contentW - iconPad, line2Y, { align: "right" }
  );

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(`Session Report (Level ${summary.level})`, titleCX, line2Y, { align: "center" });

  curY += bannerH + 10;

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME DESCRIPTION
  // ═══════════════════════════════════════════════════════════════════════════

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text("Angles & Geometry", margin, curY);
  curY += 5.5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text("Objective:", margin, curY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    "Aim the cannon at the correct angle and fire to hit the target.",
    margin + doc.getTextWidth("Objective:") + 2, curY
  );
  curY += 8;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE BOXES
  // ═══════════════════════════════════════════════════════════════════════════

  const boxW = (contentW - 8) / 3;
  const boxH = 18;

  // Score - blue
  const scoreColor = "#1d4ed8";
  const scoreBg = "#eff6ff";
  doc.setFillColor(scoreBg);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(scoreColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text("Score", margin + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(scoreColor);
  doc.text(`${summary.correctCount} / ${summary.totalQuestions}`, margin + boxW / 2, curY + 13.5, { align: "center" });

  // Accuracy - color coded
  const box2X = margin + boxW + 4;
  const accColor = summary.accuracy >= 80 ? "#16a34a" : summary.accuracy >= 50 ? "#f59e0b" : "#dc2626";
  const accBg = summary.accuracy >= 80 ? "#f0fdf4" : summary.accuracy >= 50 ? "#fffbeb" : "#fff5f5";
  doc.setFillColor(accBg);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(accColor);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text("Accuracy", box2X + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accColor);
  doc.text(`${summary.accuracy}%`, box2X + boxW / 2, curY + 13.5, { align: "center" });

  // Time - purple
  const box3X = margin + (boxW + 4) * 2;
  doc.setFillColor("#faf5ff");
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(COLORS.accentPurple);
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text("Total Time", box3X + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.accentPurple);
  doc.text(formatDuration(summary.endTime - summary.startTime), box3X + boxW / 2, curY + 13.5, { align: "center" });

  curY += boxH + 7;

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTEMPT EGGS ROW
  // ═══════════════════════════════════════════════════════════════════════════

  const eggRx = 2.2, eggRy = 3, eggStep = 6;
  const maxPerRow = Math.floor(contentW / eggStep);
  const eggRowH = eggRy * 2 + 3;

  for (let rowStart = 0; rowStart < summary.attempts.length; rowStart += maxPerRow) {
    const rowAttempts = summary.attempts.slice(rowStart, rowStart + maxPerRow);
    const rowWidth = rowAttempts.length * eggStep;
    let eggX = margin + (contentW - rowWidth) / 2 + eggStep / 2;
    const eggCY = curY + eggRy;

    for (const attempt of rowAttempts) {
      if (!attempt.isCorrect) {
        doc.setFillColor("#ef4444");
        doc.setDrawColor("#dc2626");
      } else {
        doc.setFillColor("#facc15");
        doc.setDrawColor("#f59e0b");
      }
      doc.ellipse(eggX, eggCY, eggRx, eggRy, "FD");
      eggX += eggStep;
    }
    curY += eggRowH;
  }

  curY += 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTION CARDS with angle diagrams
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

    // Card header background
    doc.setFillColor(cardBg);
    doc.rect(cardLeft, curY, cardContentW, cardHeaderH, "F");

    // Left colour stripe (full card height)
    const stripeH = cardHeaderH + cardBodyH;
    doc.setFillColor(cardBorderColor);
    doc.rect(cardLeft, curY, stripeW, stripeH, "F");

    // Q number
    const qLabel = `Q${attempt.questionNumber}`;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.textDark);
    doc.text(qLabel, cardLeft + stripeW + 3, curY + 6.8);

    // CORRECT / WRONG + time
    const timeStr = formatDuration(attempt.timeTakenMs);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const timeW2 = doc.getTextWidth(timeStr);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const icon = attempt.isCorrect ? "CORRECT" : "WRONG";
    const iconW = doc.getTextWidth(icon);

    const groupRight = pageW - margin - 4;
    const groupStart = groupRight - iconW - 3 - timeW2;

    doc.setTextColor(cardBorderColor);
    doc.text(icon, groupStart, curY + 6.8);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.textMuted);
    doc.text(timeStr, groupRight, curY + 6.8, { align: "right" });

    curY += cardHeaderH;

    // Card body: angle diagram (left) + question text (right)
    const bodyPad = 4;
    const diagramX = cardLeft + stripeW + 4;

    // Draw angle diagram
    drawAngleDiagram(doc, attempt, diagramX, curY + bodyPad, diagramW, diagramH);

    // Question and answer text (right of diagram)
    const textX = diagramX + diagramW + 5;
    const textW = cardRight - textX - 4;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.textDark);
    const promptLines = doc.splitTextToSize(attempt.prompt, textW);
    doc.text(promptLines, textX, curY + bodyPad + 4);

    let textY = curY + bodyPad + 4 + promptLines.length * 4.5 + 3;

    // Phase badge
    if (attempt.gamePhase === "monster") {
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor("#a855f7");
      doc.text("⚡ MONSTER ROUND", textX, textY);
      textY += 5;
    }

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(attempt.isCorrect ? COLORS.correctDark : COLORS.wrongBorder);
    const givenLabel = attempt.childAnswer !== null
      ? `Your answer: ${attempt.childAnswer}°`
      : "Your answer: (aimed)";
    doc.text(givenLabel, textX, textY);
    textY += 4.5;

    doc.setTextColor(COLORS.textDark);
    doc.text(`Correct angle: ${attempt.correctAnswer}°`, textX, textY);

    curY += cardBodyH;

    // Separator
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
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.accentPurple);
  const encouragement =
    summary.accuracy >= 90 ? "Amazing work! You're an angle master!" :
    summary.accuracy >= 70 ? "Great job! Your aim is getting sharper!" :
    summary.accuracy >= 50 ? "Nice effort! Keep practising those angles!" :
                             "Good try! Every shot teaches you something new!";
  doc.text(encouragement, pageW / 2, curY + 13, { align: "center" });

  const wrongAttempts = summary.attempts.filter(a => !a.isCorrect);
  if (wrongAttempts.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.textMuted);
    doc.text("Tip: Look at the angle diagram — remember 90° is a right angle, 180° is a straight line.", pageW / 2, curY + 22, { align: "center" });
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor("#94a3b8");
  doc.text("Generated by Interactive Maths - Angle Explorer", pageW / 2, pageH - 8, { align: "center" });
  doc.text("https://interactive-maths.vercel.app", pageW / 2, pageH - 4, { align: "center" });

  return doc.output("blob");
}
