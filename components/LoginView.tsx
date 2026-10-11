"use client";

import { useSearchParams } from "next/navigation";
import { isMessageKey } from "@/lib/i18n";
import { useT } from "./LangProvider";

/** Login page body: the Discord login link and the message for ?error=<code>. */
export function LoginView() {
  const tr = useT();
  const code = useSearchParams().get("error");
  const errorKey = code ? `login.error.${code}` : null;

  return (
    <main>
      <h1>{tr("login.title")}</h1>
      <p>{tr("login.intro")}</p>
      {code && (
        <div role="alert">
          <p>{errorKey && isMessageKey(errorKey) ? tr(errorKey) : tr("errors.unknown")}</p>
          <p>{tr("login.errorCode", { code })}</p>
        </div>
      )}
      {/* A full navigation: /auth/login is a Worker route, not a page. */}
      <a href="/auth/login">{tr("login.button")}</a>
    </main>
  );
}
