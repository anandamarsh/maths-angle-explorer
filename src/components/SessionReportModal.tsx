// src/components/SessionReportModal.tsx

import { useEffect, useState } from "react";
import { useIsMobileLandscape } from "../hooks/useMediaQuery";
import type { SessionSummary } from "../report/sessionLog";
import type { ModalAutopilotControls } from "../hooks/useAutopilot";
import { emailReport, shareReport } from "../report/shareReport";
import { useT, useLocale } from "../i18n";
import { usePersistentString } from "../utils/embeddedStorage";
import { SHARED_STORAGE_KEYS } from "../utils/storageKeys";

const LEGACY_REPORT_NAME_KEY = "reportName";
const LEGACY_REPORT_EMAIL_KEY = "reportEmail";

function LevelCompleteReportActions({
  summary,
  isMobileLandscape,
  autopilotControlsRef,
}: {
  summary: SessionSummary;
  isMobileLandscape: boolean;
  autopilotControlsRef?: React.MutableRefObject<ModalAutopilotControls | null>;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [generating, setGenerating] = useState(false);
  const [playerName, setPlayerName] = usePersistentString(
    SHARED_STORAGE_KEYS.reportName,
    "",
    {
      legacyKeys: [LEGACY_REPORT_NAME_KEY],
      removeWhen: (value) => value.trim() === "",
    },
  );
  const [shareEmail, setShareEmail] = usePersistentString(
    SHARED_STORAGE_KEYS.reportEmail,
    "",
    {
      legacyKeys: [LEGACY_REPORT_EMAIL_KEY],
      removeWhen: (value) => value.trim() === "",
    },
  );
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);
  const totalStars = summary.normalEggs + summary.monsterEggs;
  const canEmailReport = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shareEmail.trim());

  // Expose controls for autopilot
  useEffect(() => {
    if (!autopilotControlsRef) return;
    autopilotControlsRef.current = {
      appendChar: (ch: string) => setShareEmail((prev) => prev + ch),
      setEmail: (v: string) => {
        setShareEmail(v);
      },
      triggerSend: () => {
        const email = shareEmail.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Promise.resolve();
        return handleEmailSend();
      },
    };
    return () => {
      if (autopilotControlsRef) autopilotControlsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopilotControlsRef, shareEmail]);

  async function handleShare() {
    setGenerating(true);
    try {
      await shareReport(summary, locale);
    } catch (error) {
      console.error("Report share failed:", error);
    } finally {
      setGenerating(false);
    }
  }

  async function handleEmailSend() {
    if (!canEmailReport || generating) return;
    setGenerating(true);
    setEmailFeedback(null);
    setEmailError(false);
    try {
      const namedSummary = playerName.trim() ? { ...summary, playerName: playerName.trim() } : summary;
      await emailReport(namedSummary, shareEmail, locale);
      setEmailFeedback(t("report.sendSuccess", { email: shareEmail.trim() }));
    } catch (error) {
      console.error("Email send failed:", error);
      setEmailError(true);
      setEmailFeedback(
        error instanceof Error ? error.message : t("report.sendFail"),
      );
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
              {t("report.score")}
            </div>
            <div className="mt-1 text-xl font-black text-emerald-300 md:text-2xl">
              {summary.correctCount}/{summary.totalQuestions}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-300/20 bg-slate-800/70 px-3 py-3">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              {t("report.accuracy")}
            </div>
            <div className="mt-1 text-xl font-black text-yellow-300 md:text-2xl">
              {summary.accuracy}%
            </div>
          </div>
          <div className="rounded-2xl border border-fuchsia-300/20 bg-slate-800/70 px-3 py-3">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-slate-400">
              {t("report.stars")}
            </div>
            <div className="mt-1 text-xl font-black text-fuchsia-300 md:text-2xl">
              {totalStars}
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
          <span className="grid">
            <span className="invisible col-start-1 row-start-1">
              {t("report.shareReport")}
            </span>
            <span className="invisible col-start-1 row-start-1">
              {t("report.creating")}
            </span>
            <span className="col-start-1 row-start-1">
              {generating ? t("report.creating") : t("report.shareReport")}
            </span>
          </span>
        </button>
        <input
          type="text"
          value={playerName}
          onChange={(event) => {
            setPlayerName(event.target.value);
          }}
          placeholder={t("report.namePlaceholder")}
          className="min-w-0 w-36 shrink-0 rounded-2xl border-2 border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-slate-400"
        />
        <input
          type="email"
          value={shareEmail}
          onChange={(event) => {
            setShareEmail(event.target.value);
            if (emailFeedback) {
              setEmailFeedback(null);
              setEmailError(false);
            }
          }}
          placeholder="parent@email.com"
          data-autopilot-key="email-input"
          className="min-w-0 flex-1 rounded-2xl border-2 border-cyan-300 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-200"
        />
        <button
          type="button"
          onClick={handleEmailSend}
          disabled={!canEmailReport || generating}
          data-autopilot-key="email-send"
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400 text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:opacity-100"
          aria-label="Email report"
          title={canEmailReport ? "Send the report by email" : "Enter an email address"}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13" />
            <path d="m22 2-7 20-4-9-9-4Z" />
          </svg>
        </button>
      </div>
      <div
        className={`mt-2 text-sm font-semibold ${
          emailError ? "text-rose-300" : "text-emerald-300"
        }`}
        style={{ visibility: emailFeedback ? "visible" : "hidden" }}
      >
        {emailFeedback ?? "\u00a0"}
      </div>
    </div>
  );
}

interface Props {
  summary: SessionSummary;
  level: number;
  onClose: () => void;
  onNextLevel?: () => void;
  autopilotControlsRef?: React.MutableRefObject<ModalAutopilotControls | null>;
}

export default function SessionReportModal({ summary, level, onClose, onNextLevel, autopilotControlsRef }: Props) {
  const isMobileLandscape = useIsMobileLandscape();
  const t = useT();

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
          {t("report.levelComplete", { level })}
        </div>
        <div className={`mt-2 text-base font-bold md:text-lg ${level >= 2 ? "text-purple-300" : "text-yellow-300"}`}>
          {level >= 2 ? t("report.platinumCrushed") : t("report.monsterCrushed")}
        </div>
        <div className="mt-4 flex items-center justify-center gap-1">
          {[0, 1, 2].map((i) => {
            const fill = level >= 2 ? "#e2e8f0" : "#facc15";
            const stroke = level >= 2 ? "#94a3b8" : "#f59e0b";
            const glow = level >= 2
              ? "drop-shadow(0 0 6px rgba(226,232,240,0.9)) drop-shadow(0 0 14px rgba(148,163,184,0.5))"
              : "drop-shadow(0 0 6px rgba(250,204,21,0.95)) drop-shadow(0 0 14px rgba(251,191,36,0.6))";
            const d = "M 11.00 1.00 L 13.47 7.60 L 20.51 7.91 L 14.99 12.30 L 16.88 19.09 L 11.00 15.20 L 5.12 19.09 L 7.01 12.30 L 1.49 7.91 L 8.53 7.60 Z";
            const sz = isMobileLandscape ? 18 : 24;
            return (
              <svg key={i} viewBox="0 0 22 22" width={sz} height={sz} style={{ filter: glow }}>
                <path d={d} fill={fill} stroke={stroke} strokeWidth="0.8" strokeLinejoin="round" />
              </svg>
            );
          })}
        </div>

        <LevelCompleteReportActions
          summary={summary}
          isMobileLandscape={isMobileLandscape}
          autopilotControlsRef={autopilotControlsRef}
        />

        <div className="mt-6 flex flex-col items-center gap-3">
          {level < 2 && onNextLevel ? (
            <button
              onClick={onNextLevel}
              data-autopilot-key="next-level"
              className="arcade-button px-8 py-4 text-base md:text-lg"
            >
              {t("report.nextLevel")}
            </button>
          ) : (
            <button
              onClick={onClose}
              data-autopilot-key="next-level"
              className="arcade-button px-8 py-4 text-base md:text-lg"
            >
              {t("report.playAgain")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
