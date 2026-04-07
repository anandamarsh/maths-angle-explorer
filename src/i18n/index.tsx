// src/i18n/index.ts

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { Translations, TranslationKey, TFunction } from "./types";
import { en } from "./en";
import { hi } from "./hi";
import { zh } from "./zh";

// ── Built-in locales ───────────────────────────────────────────────────────────

const BUILT_IN: Record<string, Translations> = { en, hi, zh };

// ── Cache for on-demand translated locales (persists for session) ───────────────

const translationCache: Record<string, Translations> = {};

// ── String interpolation ───────────────────────────────────────────────────────

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

// ── Non-hook helpers ───────────────────────────────────────────────────────────

export function getT(locale: string): TFunction {
  const translations = BUILT_IN[locale] ?? translationCache[locale] ?? en;
  return (key: TranslationKey, vars?: Record<string, string | number>): string => {
    const template = translations[key] ?? en[key] ?? key;
    return interpolate(template, vars);
  };
}

export function cacheTranslation(locale: string, translations: Translations): void {
  translationCache[locale] = translations;
}

export function saveCustomLang(code: string, name: string): void {
  try {
    const stored = JSON.parse(localStorage.getItem("customLangs") ?? "{}") as Record<string, string>;
    stored[code] = name;
    localStorage.setItem("customLangs", JSON.stringify(stored));
  } catch { /* ignore */ }
}

export function getCustomLangs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("customLangs") ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

// ── React context ──────────────────────────────────────────────────────────────

interface I18nContextValue {
  locale: string;
  setLocale: (code: string) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key, vars) => interpolate(en[key] ?? key, vars),
});

function readSavedLocale(): string {
  try { return localStorage.getItem("lang") ?? "en"; } catch { return "en"; }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(readSavedLocale);

  function setLocale(code: string) {
    setLocaleState(code);
    try { localStorage.setItem("lang", code); } catch { /* ignore */ }
  }

  const t = getT(locale);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT(): TFunction {
  return useContext(I18nContext).t;
}

export function useLocale(): { locale: string; setLocale: (code: string) => void } {
  const { locale, setLocale } = useContext(I18nContext);
  return { locale, setLocale };
}

export type { TFunction, TranslationKey, Translations };
