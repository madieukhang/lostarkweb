"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detectLang, t, type Lang, type MessageKey } from "@/lib/i18n";

const LANG_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

type LangContextValue = { lang: Lang; setLang: (lang: Lang) => void };

const LangContext = createContext<LangContextValue>({ lang: "en", setLang: () => {} });

/**
 * Holds the UI language for the whole site. The static HTML renders in en; after hydration the
 * lang cookie or the browser language takes over.
 * @param props.children The page tree that reads the language.
 * @returns The context provider wrapping the children.
 */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(detectLang(document.cookie, navigator.language));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    document.cookie = `lang=${next}; Secure; SameSite=Lax; Path=/; Max-Age=${LANG_COOKIE_MAX_AGE}`;
    setLangState(next);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** @returns The current UI language and the setter that also writes the lang cookie. */
export function useLang(): LangContextValue {
  return useContext(LangContext);
}

/** @returns A translate function bound to the current language. */
export function useT(): (key: MessageKey, vars?: Record<string, string>) => string {
  const { lang } = useLang();
  return useCallback((key: MessageKey, vars?: Record<string, string>) => t(lang, key, vars), [lang]);
}
