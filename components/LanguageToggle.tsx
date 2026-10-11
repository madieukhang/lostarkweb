"use client";

import { useLang, useT } from "./LangProvider";

/**
 * Switches the whole site between vi and en.
 * @returns A button labelled with the other language.
 */
export function LanguageToggle() {
  const { lang, setLang } = useLang();
  const tr = useT();
  return (
    <button type="button" aria-label={tr("lang.label")} onClick={() => setLang(lang === "vi" ? "en" : "vi")}>
      {tr("lang.switchTo")}
    </button>
  );
}
