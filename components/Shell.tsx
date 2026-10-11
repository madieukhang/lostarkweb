"use client";

import { useEffect, useState } from "react";
import { apiSend } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "./LangProvider";
import { Skeleton } from "./Skeleton";

type SessionInfo = {
  uid: string;
  name: string;
  avatar: string | null;
  tabs: { checklist: boolean; raid: boolean };
};

type ShellState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; session: SessionInfo }
  | { status: "error" };

/** Tabs in menu order; RaidManage joins in part 4. */
const TAB_LINKS: Array<{ tab: keyof SessionInfo["tabs"]; href: string; label: MessageKey }> = [
  { tab: "checklist", href: "/checklist", label: "home.tabs.checklist" },
];

function avatarUrl(session: SessionInfo): string | null {
  return session.avatar ? `https://cdn.discordapp.com/avatars/${session.uid}/${session.avatar}.png?size=64` : null;
}

/** Home page: who is signed in, the tabs they may open, and logout. */
export function Shell() {
  const tr = useT();
  const [state, setState] = useState<ShellState>({ status: "loading" });

  useEffect(() => {
    fetch("/auth/session", { credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401) return setState({ status: "signedOut" });
        const body = (await res.json()) as { ok?: boolean; data?: SessionInfo };
        setState(body.ok && body.data ? { status: "signedIn", session: body.data } : { status: "error" });
      })
      .catch(() => setState({ status: "error" }));
  }, []);

  async function logout() {
    try {
      await apiSend("/auth/logout", { method: "POST" });
      setState({ status: "signedOut" });
    } catch {
      setState({ status: "error" });
    }
  }

  if (state.status === "loading") return <Skeleton />;
  if (state.status === "error") return <p role="alert">{tr("errors.unknown")}</p>;
  if (state.status === "signedOut") return <a href="/login">{tr("home.signIn")}</a>;

  const { session } = state;
  const avatar = avatarUrl(session);
  const links = TAB_LINKS.filter(({ tab }) => session.tabs[tab]);
  return (
    <main>
      <p>
        {avatar && <img src={avatar} alt="" width={32} height={32} />} {tr("home.signedInAs", { name: session.name })}{" "}
        <button type="button" onClick={logout}>
          {tr("home.signOut")}
        </button>
      </p>
      {links.length === 0 ? (
        <p>{tr("home.noTabs")}</p>
      ) : (
        <nav>
          {links.map(({ tab, href, label }) => (
            <a key={tab} href={href}>
              {tr(label)}
            </a>
          ))}
        </nav>
      )}
    </main>
  );
}
