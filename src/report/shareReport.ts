// src/report/shareReport.ts

import { generateSessionPdf } from "./generatePdf";
import { getT } from "../i18n";
import type { TFunction } from "../i18n/types";
import type { SessionSummary } from "./sessionLog";

const SITE_URL = "https://www.seemaths.com";
const GAME_NAME = "Angle Explorer";
const SENDER_NAME = "Angle Explorer";
const CURRICULUM_INDEX_URL =
  "https://www.educationstandards.nsw.edu.au/wps/portal/nesa/k-10/learning-areas/mathematics/mathematics-k-10";
const CURRICULUM_BY_LEVEL = {
  1: {
    stageLabel: "Stage 2 (Years 3-4) NSW Curriculum",
    code: "MA2-16MG",
    description: "Identifies, describes, compares and classifies angles.",
    syllabusUrl:
      "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=29",
  },
  2: {
    stageLabel: "Stage 3 (Years 5-6) NSW Curriculum",
    code: "MA3-16MG",
    description:
      "Measures and constructs angles, and applies angle relationships to find unknown angles.",
    syllabusUrl:
      "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=40",
  },
  3: {
    stageLabel: "Stage 4 (Years 7-8) NSW Curriculum",
    code: "MA4-18MG",
    description:
      "Identifies and uses angle relationships, including those related to transversals, to solve problems.",
    syllabusUrl:
      "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=52",
  },
} as const;

function getReportFileName(summary: SessionSummary): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = (summary.playerName || "explorer")
    .toLowerCase()
    .replace(/\s+/g, "-");
  return `angle-report-${name}-${stamp}.pdf`;
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  const lastDigit = day % 10;
  if (lastDigit === 1) return "st";
  if (lastDigit === 2) return "nd";
  if (lastDigit === 3) return "rd";
  return "th";
}

function formatSessionDate(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-AU", { month: "short" });
  const weekday = date.toLocaleDateString("en-AU", { weekday: "short" });
  return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
}

function formatSessionTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDurationMinutes(startTime: number, endTime: number): string {
  const minutes = Math.max(1, Math.round((endTime - startTime) / 60000));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(summary: SessionSummary, t: TFunction): string {
  const curriculum = CURRICULUM_BY_LEVEL[Math.min(summary.level, 3) as 1 | 2 | 3];
  const scoreLine = `${summary.correctCount}/${summary.totalQuestions}`;
  const accuracy = `${summary.accuracy}%`;
  const sessionTime = formatSessionTime(summary.startTime);
  const sessionDate = formatSessionDate(summary.startTime);
  const durationText = formatDurationMinutes(summary.startTime, summary.endTime);
  const curriculumText = `${curriculum.code} - ${curriculum.description}`;

  const greeting = escapeHtml(t("email.greeting"));
  const body = escapeHtml(
    t("email.bodyIntro", {
      game: GAME_NAME,
      time: sessionTime,
      date: sessionDate,
      duration: durationText,
      score: scoreLine,
      accuracy,
    }),
  );
  const curriculumLine = escapeHtml(
    t("email.curriculumIntro", {
      stage: curriculum.stageLabel,
      curriculum: curriculumText,
    }),
  );
  const regards = escapeHtml(t("email.regards"));

  return `
    <p>${greeting}</p>
    <p>${body}</p>
    <p>${curriculumLine}</p>
    <p>${regards}<br />${escapeHtml(GAME_NAME)}<br /><a href="${escapeHtml(SITE_URL)}">${escapeHtml(SITE_URL)}</a></p>
  `;
}

function getEmailMetadata(summary: SessionSummary) {
  const curriculum = CURRICULUM_BY_LEVEL[Math.min(summary.level, 3) as 1 | 2 | 3];
  return {
    gameName: GAME_NAME,
    senderName: SENDER_NAME,
    siteUrl: SITE_URL,
    sessionTime: formatSessionTime(summary.startTime),
    sessionDate: formatSessionDate(summary.startTime),
    durationText: formatDurationMinutes(summary.startTime, summary.endTime),
    stageLabel: curriculum.stageLabel,
    curriculumCode: curriculum.code,
    curriculumDescription: curriculum.description,
    curriculumUrl: curriculum.syllabusUrl,
    curriculumIndexUrl: CURRICULUM_INDEX_URL,
  };
}

async function buildReportBlob(summary: SessionSummary, t: TFunction): Promise<Blob> {
  return generateSessionPdf(summary, t);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to encode report."));
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Invalid report encoding."));
        return;
      }
      const [, base64 = ""] = reader.result.split(",", 2);
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export async function downloadReport(summary: SessionSummary, locale = "en"): Promise<void> {
  const t = getT(locale);
  const blob = await buildReportBlob(summary, t);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getReportFileName(summary);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareReport(summary: SessionSummary, locale = "en"): Promise<boolean> {
  const t = getT(locale);
  const blob = await buildReportBlob(summary, t);
  const fileName = getReportFileName(summary);
  const file = new File([blob], fileName, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data?: ShareData) => boolean;
  };

  const shareData: ShareData = {
    files: [file],
    title: `${summary.playerName || "Explorer"}'s Angle Explorer Report`,
    text: `Check out this maths session report! Score: ${summary.correctCount}/${summary.totalQuestions} (${summary.accuracy}%)`,
  };

  if (typeof nav.share === "function" && typeof nav.canShare === "function") {
    try {
      if (nav.canShare(shareData)) {
        await nav.share(shareData);
        return true;
      }
    } catch (err) {
      if ((err as DOMException).name === "AbortError") {
        return false;
      }
    }
  }

  await downloadReport(summary, locale);
  return true;
}

export async function emailReport(
  summary: SessionSummary,
  email: string,
  locale = "en",
): Promise<void> {
  const t = getT(locale);
  const blob = await buildReportBlob(summary, t);
  const emailSubject = t("email.subject");
  const emailHtml = buildEmailHtml(summary, t);

  const response = await fetch("/api/send-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email.trim(),
      pdfBase64: await blobToBase64(blob),
      playerName: summary.playerName || "Explorer",
      correctCount: summary.correctCount,
      totalQuestions: summary.totalQuestions,
      accuracy: summary.accuracy,
      ...getEmailMetadata(summary),
      reportFileName: getReportFileName(summary),
      emailSubject,
      emailHtml,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || "Failed to send report email.");
  }
}

export function canNativeShare(): boolean {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function") {
    return false;
  }
  try {
    const dummyFile = new File([new Blob(["test"])], "test.pdf", { type: "application/pdf" });
    return nav.canShare({ files: [dummyFile] });
  } catch {
    return false;
  }
}
