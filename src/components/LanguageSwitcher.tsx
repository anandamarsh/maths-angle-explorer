// src/components/LanguageSwitcher.tsx

import { useState, useRef, useEffect } from "react";
import { useLocale, useT } from "../i18n";
import type { TranslationKey } from "../i18n";

const BUILT_IN_LOCALES: { code: string; key: TranslationKey }[] = [
  { code: "en", key: "lang.en" },
  { code: "zh", key: "lang.zh" },
  { code: "hi", key: "lang.hi" },
];

const FLAG_EMOJI: Record<string, string> = {
  en: "\u{1F1EC}\u{1F1E7}",
  zh: "\u{1F1E8}\u{1F1F3}",
  hi: "\u{1F1EE}\u{1F1F3}",
};

const FLAG_STYLE: React.CSSProperties = {
  fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
  fontSize: "1.55rem",
  lineHeight: 1,
};

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const itemStyle = (selected: boolean): React.CSSProperties => ({
    display: "block",
    width: "100%",
    padding: "14px 16px",
    textAlign: "left",
    background: "transparent",
    color: selected ? "#67e8f9" : "#e5e7eb",
    fontWeight: selected ? 800 : 500,
    fontSize: "1rem",
    border: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: "18px",
  });

  return (
    <>
      <div ref={dropRef} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          title={t("lang.label")}
          aria-label={t("lang.label")}
          className="arcade-button h-10 w-10 flex items-center justify-center p-2"
        >
          {/* Globe icon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-full h-full"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 12px)",
              right: 0,
              background: "rgba(15,23,42,0.985)",
              border: "4px solid rgba(36,127,186,0.78)",
              borderRadius: "28px",
              padding: "14px",
              minWidth: "260px",
              zIndex: 9999,
              boxShadow: "0 22px 44px rgba(2,6,23,0.52)",
            }}
          >
            {BUILT_IN_LOCALES.map(({ code, key }) => {
              const isActive = locale === code;
              return (
                <button
                  key={code}
                  onClick={() => { setLocale(code); setOpen(false); }}
                  style={{ ...itemStyle(isActive), display: "flex", alignItems: "center", gap: "16px" }}
                >
                  <span aria-hidden="true" style={FLAG_STYLE}>{FLAG_EMOJI[code] ?? "\u{1F310}"}</span>
                  <span style={{ flex: 1, fontFamily: '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Noto Sans CJK SC", "Arial Unicode MS", sans-serif' }}>
                    {t(key)}
                  </span>
                  {isActive && <span className="text-cyan-400">&#10003;</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
