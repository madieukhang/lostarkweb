/**
 * worker/auth.ts
 * Discord login for the web. /auth/login starts OAuth with a state cookie, /auth/callback
 * applies rule B and issues the signed session, /auth/session tells the UI who is signed in,
 * /auth/logout clears the session. The login page renders the error codes these redirect with.
 */
import { langFromLocale, parseLang } from "../lib/i18n/lang";
import { computeTabs, fetchBotGuilds, hasAnyTab } from "./access";
import { buildCookie, clearCookie, readCookie } from "./cookies";
import { exchangeCode, getUser, getUserGuildIds, type DiscordUser } from "./discord";
import type { Env } from "./env";
import { hasOurOrigin } from "./origin";
import { fail, ok, redirect } from "./respond";
import { signSession, verifySession, type Tabs } from "./session";

const SESSION_COOKIE = "__Host-session";
const STATE_COOKIE = "__Host-oauth_state";
/** Page to come back to after the login, such as the page whose read hit an expired session. */
const NEXT_COOKIE = "__Host-oauth_next";
const PATH_BASE = "https://web.invalid";
const SESSION_TTL_SEC = 24 * 60 * 60;
const STATE_TTL_SEC = 10 * 60;
const LANG_TTL_SEC = 365 * 24 * 60 * 60;
/** Marks a silent (prompt=none) login in the state cookie only; Discord never sees it. */
const SILENT_SUFFIX = ".s";
/** Failures of Discord or of a bot API: the user may simply try again. */
const UPSTREAM_ERRORS = new Set(["DiscordUnavailable", "BotGuildsUnavailable"]);

/**
 * Accepts only a path on this site outside /auth/*, so the return path can never become an
 * open redirect ("//host", "/\host" and absolute URLs resolve to another origin) or a login loop.
 * Dot segments can normalize "/.//host" into "//host", which a browser reads as another host,
 * so the normalized path is checked too.
 */
function safeNextPath(raw: string | null): string | null {
  if (!raw?.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(raw, PATH_BASE);
  } catch {
    return null;
  }
  if (url.origin !== PATH_BASE || url.pathname.startsWith("//") || url.pathname.startsWith("/auth/")) return null;
  return `${url.pathname}${url.search}`;
}

function readNextCookie(request: Request): string | null {
  try {
    return safeNextPath(decodeURIComponent(readCookie(request, NEXT_COOKIE) ?? ""));
  } catch {
    return null;
  }
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * @param request GET /auth/login, with ?silent=1 to skip Discord's consent screen and
 *   ?next=<path> for the page to return to.
 * @param env Worker env.
 * @returns Redirect to Discord's authorize page, setting the state cookie and the return path
 *   (or clearing a stale one).
 */
export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const silent = params.get("silent") === "1";
  const next = safeNextPath(params.get("next"));
  const state = randomState();
  const target = new URL("https://discord.com/oauth2/authorize");
  target.search = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    response_type: "code",
    scope: "identify guilds",
    redirect_uri: `${env.PUBLIC_ORIGIN}/auth/callback`,
    state,
    ...(silent ? { prompt: "none" } : {}),
  }).toString();
  const cookieValue = silent ? `${state}${SILENT_SUFFIX}` : state;
  return redirect(target.toString(), [
    buildCookie(STATE_COOKIE, cookieValue, { maxAge: STATE_TTL_SEC, httpOnly: true }),
    next
      ? buildCookie(NEXT_COOKIE, encodeURIComponent(next), { maxAge: STATE_TTL_SEC, httpOnly: true })
      : clearCookie(NEXT_COOKIE, true),
  ]);
}

/**
 * @param request GET /auth/callback from Discord.
 * @param env Worker env.
 * @param nowSec Current Unix time in seconds.
 * @param deps Bot guild lookup; tests replace it to simulate a bot API outage.
 * @returns Redirect to / with a session, or to /login with an error code and no session.
 */
export async function handleCallback(
  request: Request,
  env: Env,
  nowSec: number,
  deps: { fetchBotGuilds: typeof fetchBotGuilds } = { fetchBotGuilds },
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const stateCookie = readCookie(request, STATE_COOKIE) ?? "";
  const silent = stateCookie.endsWith(SILENT_SUFFIX);
  const expectedState = silent ? stateCookie.slice(0, -SILENT_SUFFIX.length) : stateCookie;
  const next = readNextCookie(request);
  const cookies = [clearCookie(STATE_COOKIE, true), clearCookie(NEXT_COOKIE, true)];

  // A refused silent login lands on the plain login page, so it cannot loop back into itself.
  if (params.has("error")) return redirect(silent ? "/login" : "/login?error=discordDenied", cookies);
  const code = params.get("code");
  if (!code || !expectedState || params.get("state") !== expectedState) {
    return redirect("/login?error=stateMismatch", cookies);
  }

  let user: DiscordUser;
  let tabs: Tabs;
  try {
    const token = await exchangeCode(env, code);
    const [discordUser, userGuildIds, botGuilds] = await Promise.all([
      getUser(token),
      getUserGuildIds(token),
      deps.fetchBotGuilds(env),
    ]);
    user = discordUser;
    tabs = computeTabs(userGuildIds, botGuilds);
  } catch (err) {
    if (!(err instanceof Error) || !UPSTREAM_ERRORS.has(err.name)) throw err;
    const cause = err.cause instanceof Error ? err.cause.message : err.message;
    console.warn(`[lostark-web] login failed upstream: ${err.name}: ${cause}`);
    return redirect("/login?error=discordUnavailable", cookies);
  }
  if (!hasAnyTab(tabs)) return redirect("/login?error=noSharedGuild", cookies);

  const session = await signSession(
    {
      v: 1,
      uid: user.id,
      name: user.global_name ?? user.username,
      avatar: user.avatar,
      tabs,
      iat: nowSec,
      exp: nowSec + SESSION_TTL_SEC,
    },
    env.SESSION_SECRET,
  );
  cookies.push(buildCookie(SESSION_COOKIE, session, { maxAge: SESSION_TTL_SEC, httpOnly: true }));
  if (!parseLang(readCookie(request, "lang"))) {
    cookies.push(buildCookie("lang", langFromLocale(user.locale), { maxAge: LANG_TTL_SEC, httpOnly: false }));
  }
  return redirect(next ?? "/", cookies);
}

/**
 * @param request GET /auth/session.
 * @param env Worker env.
 * @param nowSec Current Unix time in seconds.
 * @returns The signed-in user and which tabs show (booleans, never guild ids), or 401 noSession.
 */
export async function handleSession(request: Request, env: Env, nowSec: number): Promise<Response> {
  const session = await verifySession(readCookie(request, SESSION_COOKIE), env.SESSION_SECRET, nowSec);
  if (!session) return fail(401, "noSession");
  return ok({
    uid: session.uid,
    name: session.name,
    avatar: session.avatar,
    tabs: { checklist: session.tabs.checklist.length > 0, raid: session.tabs.raid.length > 0 },
  });
}

/**
 * @param request POST /auth/logout; must carry the web's Origin.
 * @param env Worker env.
 * @returns 200 clearing the session cookie, or 403 badOrigin.
 */
export async function handleLogout(request: Request, env: Env): Promise<Response> {
  if (!hasOurOrigin(request, env)) return fail(403, "badOrigin");
  const res = ok(null);
  res.headers.append("Set-Cookie", clearCookie(SESSION_COOKIE, true));
  return res;
}
