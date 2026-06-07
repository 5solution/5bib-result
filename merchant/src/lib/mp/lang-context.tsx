"use client";

/**
 * F-069 Merchant Portal — language context.
 * Stores 'vi' | 'en' in localStorage (default 'vi'). SSR-safe: server &
 * first client render use 'vi', then hydrate from localStorage in an effect
 * to avoid hydration mismatch.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Lang } from "./i18n";

const STORAGE_KEY = "mp_lang";

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Toggle vi ⇄ en. */
  toggleLang: () => void;
}

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("vi");

  // Hydrate from localStorage after mount (SSR-safe).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "vi" || stored === "en") setLangState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "vi" ? "en" : "vi");
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
