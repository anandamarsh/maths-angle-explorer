// src/report/shareReport.ts

import { generateSessionPdf } from "./generatePdf";
import type { SessionSummary } from "./sessionLog";

function getReportFileName(summary: SessionSummary): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = (summary.playerName || "explorer")
    .toLowerCase()
    .replace(/\s+/g, "-");
  return `angle-report-${name}-${stamp}.pdf`;
}

async function buildReportBlob(summary: SessionSummary): Promise<Blob> {
  return generateSessionPdf(summary);
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

export async function downloadReport(summary: SessionSummary): Promise<void> {
  const blob = await buildReportBlob(summary);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getReportFileName(summary);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareReport(summary: SessionSummary): Promise<boolean> {
  const blob = await buildReportBlob(summary);
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

  await downloadReport(summary);
  return true;
}

export async function emailReport(
  summary: SessionSummary,
  email: string,
): Promise<void> {
  const blob = await buildReportBlob(summary);
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
      totalEggs: summary.normalEggs + summary.monsterEggs,
      reportFileName: getReportFileName(summary),
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
