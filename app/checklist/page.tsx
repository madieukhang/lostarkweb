"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";
import { Skeleton } from "@/components/Skeleton";
import { ApiError, apiGet } from "@/lib/api";
import { errorMessageKey } from "@/lib/i18n";

type WhoAmI = { uid: string; name: string; guilds: string[]; lang: string };

type PageState = { status: "loading" } | { status: "ready"; me: WhoAmI } | { status: "error"; code: string };

/**
 * Checklist tab frame; the list features arrive in part 2.
 * @returns The tab page with a loading, error or greeting state.
 */
export default function ChecklistPage() {
  const tr = useT();
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    apiGet<WhoAmI>("/api/checklist/whoami").then(
      (me) => setState({ status: "ready", me }),
      (err: unknown) => setState({ status: "error", code: err instanceof ApiError ? err.code : "unknown" }),
    );
  }, []);

  return (
    <main>
      <h1>{tr("checklist.title")}</h1>
      {state.status === "loading" && <Skeleton />}
      {state.status === "error" && <p role="alert">{tr(errorMessageKey(state.code))}</p>}
      {state.status === "ready" && <p>{tr("checklist.hello", { name: state.me.name })}</p>}
    </main>
  );
}
