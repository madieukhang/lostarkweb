"use client";

import { useSearchParams } from "next/navigation";
import { loginErrorView } from "@/lib/loginError";
import { useT } from "./LangProvider";

/**
 * Login page body: the Discord login link and the message for ?error=<code>.
 * @returns The login page content.
 */
export function LoginView() {
  const tr = useT();
  const error = loginErrorView(useSearchParams().get("error"));

  return (
    <main>
      <h1>{tr("login.title")}</h1>
      <p>{tr("login.intro")}</p>
      {error && (
        <div role="alert">
          <p>{tr(error.messageKey)}</p>
          {error.code && <p>{tr("login.errorCode", { code: error.code })}</p>}
        </div>
      )}
      {/* A full navigation: /auth/login is a Worker route, not a page. */}
      <a href="/auth/login">{tr("login.button")}</a>
    </main>
  );
}
