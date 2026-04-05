// src/components/SessionReportModal.tsx

import { useState } from "react";
import { useIsMobileLandscape } from "../hooks/useMediaQuery";
import type { SessionSummary } from "../report/sessionLog";
import { downloadReport, shareReport } from "../report/shareReport";

function LevelCompleteReportActions({
  summary,
  isMobileLandscape,
}: {
  summary: SessionSummary;
  isMobileLandscape: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const totalEggs = summary.normalEggs + summary.monsterEggs;
  const canEmailReport = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shareEmail.trim());

  async function handleShare() {
    setGenerating(true);
    try {
      await shareReport(summary);
    } catch (error) {
      console.error("Report share failed:", error);
    } finally {
      setGenerating(false);
    }
  }

  async function handleEmailDraft() {
    if (!canEmailReport || generating) return;
    setGenerating(true);
    try {
      await downloadReport(summary);
      const subject = `${summary.playerName || "Explorer"}'s Angle Explorer Report`;
      const body = [
        "Hi,",
        "",
        "I've attached the latest Angle Explorer report.",
        "",
        `Score: ${summary.correctCount}/${summary.totalQuestions}`,
        `Accuracy: ${summary.accuracy}%`,
        `Eggs Collected: ${totalEggs}`,
      ].join("\n");
      window.location.href = `mailto:${encodeURIComponent(
        shareEmail.trim(),
      )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (error) {
      console.error("Email draft failed:", error);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto mt-5 w-full max-w-xl">
      {!isMobileLandscape && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-emerald-300/20 bg-slate-800/70 px-3 py-3">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              Score
            </div>
            <div className="mt-1 text-xl font-black text-emerald-300 md:text-2xl">
              {summary.correctCount}/{summary.totalQuestions}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-slate-800/70 px-3 py-3">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              Accuracy
            </div>
            <div className="mt-1 text-xl font-black text-yellow-300 md:text-2xl">
              {summary.accuracy}%
            </div>
          </div>
          <div className="rounded-2xl border border-fuchsia-300/20 bg-slate-800/70 px-3 py-3">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              Eggs
            </div>
            <div className="mt-1 text-xl font-black text-fuchsia-300 md:text-2xl">
              {totalEggs}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={generating}
          className="arcade-button min-w-0 shrink-0 px-3 py-3 text-sm md:px-5 md:text-base"
          style={{
            borderColor: "#fbbf24",
            opacity: generating ? 0.6 : 1,
            cursor: generating ? "not-allowed" : "pointer",
          }}
        >
          {generating ? "Creating..." : "Share Report"}
        </button>
        <input
          type="email"
          value={shareEmail}
          onChange={(event) => setShareEmail(event.target.value)}
          placeholder="parent@email.com"
          className="min-w-0 flex-1 rounded-2xl border-2 border-cyan-300 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-200"
        />
        <button
          type="button"
          onClick={handleEmailDraft}
          disabled={!canEmailReport || generating}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400 text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:opacity-100"
          aria-label="Email report"
          title={canEmailReport ? "Download the report and open an email draft" : "Enter an email address"}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13" />
            <path d="m22 2-7 20-4-9-9-4Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface Props {
  summary: SessionSummary;
  level: number;
  onClose: () => void;
  onNextLevel?: () => void;
}

export default function SessionReportModal({ summary, level, onClose, onNextLevel }: Props) {
  const isMobileLandscape = useIsMobileLandscape();

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(15,23,42,0.985) 0%, rgba(2,6,23,0.995) 78%)",
      }}
    >
      <div
        className={`arcade-panel w-full text-center ${
          isMobileLandscape
            ? "h-full max-w-none rounded-none border-0 p-6 overflow-y-auto"
            : "max-w-3xl p-6 md:p-10"
        }`}
        style={{
          background: isMobileLandscape
            ? "rgba(15, 23, 42, 0.97)"
            : "rgba(15, 23, 42, 0.8)",
          border: isMobileLandscape ? "none" : undefined,
        }}
      >
        <div className="text-4xl font-black uppercase tracking-[0.18em] text-yellow-300 md:text-5xl">
          Level {level} Complete!
        </div>
        <div className="mt-2 text-base font-bold text-purple-300 md:text-lg">
          Platinum Round Crushed!
        </div>
        <div className="mt-4 flex items-center justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <svg
              key={i}
              viewBox="0 0 512 512"
              width={isMobileLandscape ? "18" : "24"}
              height={isMobileLandscape ? "18" : "24"}
              style={{
                filter:
                  "drop-shadow(0 0 6px rgba(250,204,21,0.95)) drop-shadow(0 0 14px rgba(251,191,36,0.6))",
              }}
            >
              <path
                d="M256 16C166 16 76 196 76 316c0 90 60 180 180 180s180-90 180-180c0-120-90-300-180-300z"
                fill="#facc15"
                stroke="#fbbf24"
                strokeWidth="18"
              />
              <ellipse
                cx="190"
                cy="150"
                rx="35"
                ry="60"
                fill="#fef08a"
                opacity="0.4"
                transform="rotate(-20 190 150)"
              />
            </svg>
          ))}
        </div>

        <LevelCompleteReportActions
          summary={summary}
          isMobileLandscape={isMobileLandscape}
        />

        <div className="mt-6 flex flex-col items-center gap-3">
          {level < 2 && onNextLevel && (
            <button
              onClick={onNextLevel}
              className="arcade-button px-8 py-4 text-base md:text-lg"
            >
              Next Level
            </button>
          )}
          <button
            onClick={onClose}
            className="arcade-button px-8 py-4 text-base md:text-lg"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
