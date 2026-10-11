"use client";

import { useLang, useT } from "./LangProvider";

export function LanguageToggle() {
  const { lang, setLang } = useLang();
  const tr = useT();
  return (
    <button type="button" aria-label={tr("lang.label")} onClick={() => setLang(lang === "vi" ? "en" : "vi")}>
      {tr("lang.switchTo")}
    </button>
  );
}
