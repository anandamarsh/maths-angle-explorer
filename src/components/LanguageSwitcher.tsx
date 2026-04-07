// src/components/LanguageSwitcher.tsx

import { useState, useRef, useEffect } from "react";
import { useLocale, useT, cacheTranslation, saveCustomLang, getCustomLangs } from "../i18n";
import type { Translations, TranslationKey } from "../i18n";
import { en } from "../i18n/en";

const BUILT_IN_LOCALES: { code: string; key: TranslationKey }[] = [
  { code: "en", key: "lang.en" },
  { code: "zh", key: "lang.zh" },
  { code: "es", key: "lang.es" },
  { code: "ru", key: "lang.ru" },
  { code: "hi", key: "lang.hi" },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [showOtherDialog, setShowOtherDialog] = useState(false);
  const [otherLang, setOtherLang] = useState("");
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (showOtherDialog) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showOtherDialog]);

  function openOther() {
    setOpen(false);
    setShowOtherDialog(true);
    setOtherLang("");
    setError("");
  }

  async function handleTranslate() {
    const lang = otherLang.trim();
    if (!lang || translating) return;
    setTranslating(true);
    setError("");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang: lang, strings: en }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { translations: Translations; langCode: string };
      cacheTranslation(data.langCode, data.translations);
      saveCustomLang(data.langCode, lang);
      setLocale(data.langCode);
      setShowOtherDialog(false);
    } catch {
      setError(t("lang.translateFail"));
    } finally {
      setTranslating(false);
    }
  }

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
            {BUILT_IN_LOCALES.map(({ code, key }) => (
              <button
                key={code}
                onClick={() => { setLocale(code); setOpen(false); }}
                style={itemStyle(locale === code)}
              >
                {t(key)}
              </button>
            ))}
            {Object.entries(customLangs).map(([code, name]) => (
              <button
                key={code}
                onClick={() => { setLocale(code); setOpen(false); }}
                style={itemStyle(locale === code)}
              >
                {name}
              </button>
            ))}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "4px 0" }} />
            <button
              onClick={openOther}
              style={{
                ...itemStyle(false),
                color: "#94a3b8",
                fontStyle: "italic",
              }}
            >
              {t("lang.other")}
            </button>
          </div>
        )}
      </div>

      {/* On-demand translation dialog */}
      {showOtherDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(2,6,23,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowOtherDialog(false); }}
        >
          <div
            style={{
              background: "#0f172a",
              border: "2px solid rgba(56,189,248,0.4)",
              borderRadius: "16px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "380px",
            }}
          >
            <div style={{ color: "#e2e8f0", fontWeight: 700, marginBottom: "1rem", fontSize: "0.95rem" }}>
              {t("lang.promptTitle")}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={otherLang}
              onChange={(e) => { setOtherLang(e.target.value); setError(""); }}
              placeholder={t("lang.promptPlaceholder")}
              disabled={translating}
              style={{
                width: "100%",
                padding: "0.6rem 0.9rem",
                borderRadius: "8px",
                border: "1.5px solid rgba(56,189,248,0.4)",
                background: "#020617",
                color: "white",
                fontSize: "0.9rem",
                marginBottom: "0.75rem",
                boxSizing: "border-box",
                outline: "none",
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && !translating) handleTranslate(); }}
            />
            {error && (
              <div style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowOtherDialog(false)}
                disabled={translating}
                className="arcade-button px-4 py-2 text-sm"
                style={{ borderColor: "#475569" }}
              >
                {t("lang.cancel")}
              </button>
              <button
                onClick={handleTranslate}
                disabled={!otherLang.trim() || translating}
                className="arcade-button px-4 py-2 text-sm"
              >
                {translating ? t("lang.translating") : t("lang.translate")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
