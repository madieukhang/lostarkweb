/**
 * worker/forward.ts
 * Forwards /api/<tab>/<rest> to /api/<rest> on the API Worker bound for that tab. The gateway
 * checks the session and tab access, replaces any client identity with the session's, and
 * refuses cross-site writes; the API Workers trust x-web-user because only this Worker reaches
 * them. The web never reaches an API's /internal/* routes.
 */
import { parseLang } from "../lib/i18n/lang";
import { readCookie } from "./cookies";
import type { Env } from "./env";
import { hasOurOrigin } from "./origin";
import { fail } from "./respond";
import { verifySession, type Tabs } from "./session";

type FetcherKey = { [K in keyof Env]: Env[K] extends Fetcher ? K : never }[keyof Env];

/** API Worker binding per web tab. RaidManage joins in part 4. */
export const TAB_BINDINGS: Readonly<Partial<Record<keyof Tabs, FetcherKey>>> = { checklist: "LOALOGS_API" };

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const API_PATH = /^\/api\/([^/]+)\/(.*)$/;

/**
 * @param request Incoming /api/* request.
 * @param env Worker env.
 * @param nowSec Current Unix time in seconds, for the session check.
 * @returns The API Worker's answer, or an error envelope (404 notFound, 401 noSession,
 *   403 noTabAccess or badOrigin, 503 apiUnavailable).
 */
export async function forwardApi(request: Request, env: Env, nowSec: number): Promise<Response> {
  // The URL parser has already resolved dot segments, including %2e%2e, in this pathname.
  const url = new URL(request.url);
  const match = API_PATH.exec(url.pathname);
  const tab = match?.[1] as keyof Tabs | undefined;
  if (!match || !tab || !Object.hasOwn(TAB_BINDINGS, tab)) return fail(404, "notFound");
  const target = new URL(`https://api.internal/api/${match[2]}${url.search}`);
  if (!target.pathname.startsWith("/api/")) return fail(404, "notFound");

  const session = await verifySession(readCookie(request, "__Host-session"), env.SESSION_SECRET, nowSec);
  if (!session) return fail(401, "noSession");
  const guilds = session.tabs[tab];
  if (guilds.length === 0) return fail(403, "noTabAccess");
  if (WRITE_METHODS.has(request.method) && !hasOurOrigin(request, env)) return fail(403, "badOrigin");

  const forwarded = new Request(target, request);
  for (const name of [...forwarded.headers.keys()]) {
    if (name.startsWith("x-web-") || name === "cookie") forwarded.headers.delete(name);
  }
  const lang = parseLang(readCookie(request, "lang")) ?? "en";
  forwarded.headers.set("x-web-user", JSON.stringify({ uid: session.uid, name: session.name, guilds, lang }));

  try {
    return await env[TAB_BINDINGS[tab]!].fetch(forwarded);
  } catch (err) {
    console.warn(`[lostark-web] ${tab} API failed: ${err instanceof Error ? err.message : String(err)}`);
    return fail(503, "apiUnavailable");
  }
}
