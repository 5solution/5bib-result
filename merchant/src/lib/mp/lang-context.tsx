"use client";

/**
 * F-069 Merchant Portal — language context.
 * F-071 — extended to 5 languages (vi/en/km/lo/ms).
 *
 * Stores the chosen language code in localStorage (default 'vi'). SSR-safe:
 * server & first client render use 'vi', then hydrate from localStorage in an
 * effect to avoid hydration mismatch (BR-05). Invalid/legacy stored values are
 * ignored and fall back to 'vi' (BR-04).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { isLang, LANG_CODES, type Lang } from "./i18n";

const STORAGE_KEY = "mp_lang";

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Cycle through the supported languages in registry order. */
  toggleLang: () => void;
}

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("vi");

  // Hydrate from localStorage after mount (SSR-safe). BR-04: validate code.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLang(stored)) setLangState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    if (!isLang(l)) return; // defensive: ignore unknown codes
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLang = useCallback(() => {
    const idx = LANG_CODES.indexOf(lang);
    const next = LANG_CODES[(idx + 1) % LANG_CODES.length];
    setLang(next);
  }, [lang, setLang]);

  return (
    <LangContext value={{ lang, setLang, toggleLang }}>{children}</LangContext>
  );
}

export function useLang(): LangContextType {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within a LangProvider");
  return ctx;
}
