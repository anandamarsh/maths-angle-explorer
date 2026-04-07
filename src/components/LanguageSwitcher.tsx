// src/components/LanguageSwitcher.tsx

import { useState, useRef, useEffect } from "react";
import { useLocale, useT, getCustomLangs } from "../i18n";
import type { TranslationKey } from "../i18n";

const BUILT_IN_LOCALES: { code: string; key: TranslationKey }[] = [
  { code: "en", key: "lang.en" },
  { code: "zh", key: "lang.zh" },
  { code: "hi", key: "lang.hi" },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const customLangs = getCustomLangs();

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
    padding: "8px 16px",
    textAlign: "left",
    background: selected ? "rgba(56,189,248,0.15)" : "transparent",
    color: selected ? "#38bdf8" : "#cbd5e1",
    fontWeight: selected ? 700 : 400,
    fontSize: "0.85rem",
    border: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <>
      <div ref={dropRef} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          title={t("lang.label")}
          aria-label={t("lang.label")}
          className="arcade-button w-10 h-10 flex items-center justify-center p-2"
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
              top: "calc(100% + 6px)",
              right: 0,
              background: "rgba(2,6,23,0.97)",
              border: "2px solid rgba(56,189,248,0.4)",
              borderRadius: "12px",
              padding: "6px 0",
              minWidth: "160px",
              zIndex: 9999,
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}
          >
            {BUILT_IN_LOCALES.map(({ code, key }) => {
              const isActive = locale === code;
              return (
                <button
                  key={code}
                  onClick={() => { setLocale(code); setOpen(false); }}
                  style={{ ...itemStyle(isActive), display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span>{t(key)}</span>
                  {isActive && <span style={{ color: "#38bdf8", marginLeft: 8 }}>&#10003;</span>}
                </button>
              );
            })}
            {Object.entries(customLangs).map(([code, name]) => {
              const isActive = locale === code;
              return (
                <button
                  key={code}
                  onClick={() => { setLocale(code); setOpen(false); }}
                  style={{ ...itemStyle(isActive), display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span>{name}</span>
                  {isActive && <span style={{ color: "#38bdf8", marginLeft: 8 }}>&#10003;</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
