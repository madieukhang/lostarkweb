import { env, exports } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { handleCallback } from "../worker/auth";
import { signSession, verifySession, type SessionPayload } from "../worker/session";
import { network } from "./network";

const ORIGIN = "https://web.test";
const SECRET = "test-session-secret-0123456789abcdef";
const STATE = "Zm9yLXRlc3Rpbmctb25seS0zMi1ieXRlcy1vZi1zdGF0ZQ";
const ACCESS_TOKEN = "discord-access-token-123";
const DISCORD = "https://discord.com/api/v10";

type DiscordMock = { tokenStatus?: number; guildsStatus?: number; guilds?: string[]; locale?: string };

/** Mocks the three Discord calls of a login and records what the Worker sent. */
function mockDiscord({ tokenStatus = 200, guildsStatus = 200, guilds = ["g-shared", "g-x"], locale = "en-US" }: DiscordMock = {}) {
  const sent: { token?: { auth: string | null; form: Record<string, string> }; bearer: (string | null)[] } = { bearer: [] };
  network.use(
    http.post(`${DISCORD}/oauth2/token`, async ({ request }) => {
      sent.token = {
        auth: request.headers.get("authorization"),
        form: Object.fromEntries(new URLSearchParams(await request.text())),
      };
      if (tokenStatus !== 200) return HttpResponse.json({ message: "rate limited", retry_after: 1 }, { status: tokenStatus });
      return HttpResponse.json({
        access_token: ACCESS_TOKEN,
        token_type: "Bearer",
        expires_in: 604800,
        refresh_token: "discord-refresh-token-456",
        scope: "identify guilds",
      });
    }),
    http.get(`${DISCORD}/users/@me`, ({ request }) => {
      sent.bearer.push(request.headers.get("authorization"));
      return HttpResponse.json({
        id: "111",
        username: "traine",
        global_name: "Traine",
        discriminator: "0",
        avatar: "abc123",
        banner: null,
        accent_color: null,
        public_flags: 0,
        flags: 0,
        mfa_enabled: false,
        premium_type: 0,
        locale,
      });
    }),
    http.get(`${DISCORD}/users/@me/guilds`, ({ request }) => {
      sent.bearer.push(request.headers.get("authorization"));
      if (guildsStatus !== 200) return new HttpResponse(null, { status: guildsStatus });
      return HttpResponse.json(
        guilds.map((id) => ({ id, name: `Guild ${id}`, icon: null, banner: null, owner: false, permissions: "0", features: [] })),
      );
    }),
  );
  return sent;
}

function setCookies(res: Response): string[] {
  return res.headers.getSetCookie();
}

function cookieValue(res: Response, name: string): string | undefined {
  const entry = setCookies(res).find((cookie) => cookie.startsWith(`${name}=`));
  return entry?.slice(name.length + 1).split(";")[0];
}

function callback(query: string, cookie: string): Promise<Response> {
  return exports.default.fetch(`${ORIGIN}/auth/callback?${query}`, { headers: { Cookie: cookie }, redirect: "manual" });
}

const STATE_CLEARED = "__Host-oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

describe("GET /auth/login", () => {
  it("redirects to Discord with a fresh state kept in a cookie", async () => {
    const res = await exports.default.fetch(`${ORIGIN}/auth/login`, { redirect: "manual" });
    expect(res.status).toBe(302);
    const target = new URL(res.headers.get("location") ?? "");
    expect(`${target.origin}${target.pathname}`).toBe("https://discord.com/oauth2/authorize");
    expect(target.searchParams.get("client_id")).toBe("client-1");
    expect(target.searchParams.get("response_type")).toBe("code");
    expect(target.searchParams.get("scope")).toBe("identify guilds");
    expect(target.searchParams.get("redirect_uri")).toBe("https://web.test/auth/callback");
    expect(target.searchParams.get("prompt")).toBeNull();
    const state = target.searchParams.get("state") ?? "";
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(setCookies(res)).toContain(`__Host-oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);

    const again = await exports.default.fetch(`${ORIGIN}/auth/login`, { redirect: "manual" });
    expect(new URL(again.headers.get("location") ?? "").searchParams.get("state")).not.toBe(state);
  });

  it("adds prompt=none and marks the state cookie for a silent login", async () => {
    const res = await exports.default.fetch(`${ORIGIN}/auth/login?silent=1`, { redirect: "manual" });
    const target = new URL(res.headers.get("location") ?? "");
    expect(target.searchParams.get("prompt")).toBe("none");
    expect(cookieValue(res, "__Host-oauth_state")).toBe(`${target.searchParams.get("state")}.s`);
  });

  it("keeps a same-site return path for after the login, and nothing else", async () => {
    const res = await exports.default.fetch(`${ORIGIN}/auth/login?silent=1&next=%2Fchecklist%3Fx%3D1`, { redirect: "manual" });
    expect(setCookies(res)).toContain("__Host-oauth_next=%2Fchecklist%3Fx%3D1; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600");

    for (const next of ["//evil.test/x", "https://evil.test/", "/\\evil.test", "/auth/login?silent=1", "checklist", "javascript:alert(1)"]) {
      const refused = await exports.default.fetch(`${ORIGIN}/auth/login?next=${encodeURIComponent(next)}`, { redirect: "manual" });
      expect(refused.status).toBe(302);
      expect(setCookies(refused)).toContain("__Host-oauth_next=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
    }
  });
});

describe("GET /auth/callback", () => {
  it("refuses a state that does not match the cookie", async () => {
    const sent = mockDiscord();
    for (const cookie of [`__Host-oauth_state=${STATE}`, ""]) {
      const res = await callback(`code=the-code&state=other-state`, cookie);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/login?error=stateMismatch");
      expect(cookieValue(res, "__Host-session")).toBeUndefined();
      expect(setCookies(res)).toContain(STATE_CLEARED);
    }
    expect(sent.token).toBeUndefined();
  });

  it("gives a member a signed session without the Discord token", async () => {
    const sent = mockDiscord({ guilds: ["g-shared", "g-x"] });
    const before = Math.floor(Date.now() / 1000);
    const res = await callback(`code=the-code&state=${STATE}`, `__Host-oauth_state=${STATE}`);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
    expect(setCookies(res)).toContain(STATE_CLEARED);
    const sessionCookie = setCookies(res).find((cookie) => cookie.startsWith("__Host-session=")) ?? "";
    expect(sessionCookie).toMatch(/; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=86400$/);
    expect(sessionCookie).not.toContain(ACCESS_TOKEN);

    const session = await verifySession(cookieValue(res, "__Host-session") ?? null, SECRET, before);
    expect(session).toMatchObject({ v: 1, uid: "111", name: "Traine", avatar: "abc123", tabs: { checklist: ["g-shared"], raid: [] } });
    expect(session!.iat).toBeGreaterThanOrEqual(before);
    expect(session!.exp - session!.iat).toBe(86400);

    expect(sent.token).toEqual({
      auth: `Basic ${btoa("client-1:client-secret")}`,
      form: { grant_type: "authorization_code", code: "the-code", redirect_uri: "https://web.test/auth/callback" },
    });
    expect(sent.bearer).toEqual([`Bearer ${ACCESS_TOKEN}`, `Bearer ${ACCESS_TOKEN}`]);
  });

  it("returns to the saved page after a login, re-checking it", async () => {
    mockDiscord();
    const res = await callback(`code=the-code&state=${STATE}`, `__Host-oauth_state=${STATE}; __Host-oauth_next=%2Fchecklist%3Fx%3D1`);
    expect(res.headers.get("location")).toBe("/checklist?x=1");
    expect(setCookies(res)).toContain("__Host-oauth_next=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");

    mockDiscord();
    const tampered = await callback(`code=the-code&state=${STATE}`, `__Host-oauth_state=${STATE}; __Host-oauth_next=%2F%2Fevil.test`);
    expect(tampered.headers.get("location")).toBe("/");
  });

  it("refuses a user who shares no guild with a bot", async () => {
    mockDiscord({ guilds: ["g-x"] });
    const res = await callback(`code=the-code&state=${STATE}`, `__Host-oauth_state=${STATE}`);
    expect(res.headers.get("location")).toBe("/login?error=noSharedGuild");
    expect(cookieValue(res, "__Host-session")).toBeUndefined();
  });

  it("sets the language from the Discord locale only when no valid choice exists", async () => {
    const cases: Array<[locale: string, cookie: string, expected: string | undefined]> = [
      ["vi", "", "vi"],
      ["en-US", "", "en"],
      ["vi", "lang=en", undefined],
      ["vi", "lang=jp", "vi"],
    ];
    for (const [locale, langCookie, expected] of cases) {
      mockDiscord({ locale });
      const cookie = [`__Host-oauth_state=${STATE}`, langCookie].filter(Boolean).join("; ");
      const res = await callback(`code=the-code&state=${STATE}`, cookie);
      expect(cookieValue(res, "lang")).toBe(expected);
      if (expected) expect(setCookies(res)).toContain(`lang=${expected}; Secure; SameSite=Lax; Path=/; Max-Age=31536000`);
    }
  });

  it("sends the user back to /login when Discord fails", async () => {
    for (const mock of [{ tokenStatus: 429 }, { guildsStatus: 500 }]) {
      mockDiscord(mock);
      const res = await callback(`code=the-code&state=${STATE}`, `__Host-oauth_state=${STATE}`);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/login?error=discordUnavailable");
      expect(cookieValue(res, "__Host-session")).toBeUndefined();
      expect(setCookies(res)).toContain(STATE_CLEARED);
    }
  });

  it("sends the user back to /login when the bot guild list fails", async () => {
    mockDiscord();
    const request = new Request(`${ORIGIN}/auth/callback?code=the-code&state=${STATE}`, {
      headers: { Cookie: `__Host-oauth_state=${STATE}` },
    });
    const unavailable = Object.assign(new Error("loalogs-api down"), { name: "BotGuildsUnavailable" });
    const res = await handleCallback(request, env, Math.floor(Date.now() / 1000), {
      fetchBotGuilds: async () => {
        throw unavailable;
      },
    });
    expect(res.headers.get("location")).toBe("/login?error=discordUnavailable");
    expect(cookieValue(res, "__Host-session")).toBeUndefined();
  });

  it("lands a refused silent login on /login once, and names a refused normal login", async () => {
    const silent = await callback(`error=consent_required&state=${STATE}`, `__Host-oauth_state=${STATE}.s`);
    expect(silent.headers.get("location")).toBe("/login");
    expect(setCookies(silent)).toContain(STATE_CLEARED);

    const normal = await callback(`error=access_denied&state=${STATE}`, `__Host-oauth_state=${STATE}`);
    expect(normal.headers.get("location")).toBe("/login?error=discordDenied");
  });
});

describe("GET /auth/session", () => {
  async function sessionCookie(overrides: Partial<SessionPayload> = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      v: 1,
      uid: "111",
      name: "Traine",
      avatar: "abc123",
      tabs: { checklist: ["g-shared"], raid: [] },
      iat: now,
      exp: now + 3600,
      ...overrides,
    };
    return `__Host-session=${await signSession(payload, SECRET)}`;
  }

  it("returns who is signed in and which tabs show, without guild ids", async () => {
    const res = await exports.default.fetch(`${ORIGIN}/auth/session`, { headers: { Cookie: await sessionCookie() } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      data: { uid: "111", name: "Traine", avatar: "abc123", tabs: { checklist: true, raid: false } },
    });
  });

  it("is 401 without a valid session", async () => {
    const now = Math.floor(Date.now() / 1000);
    const cookies = ["", "__Host-session=junk", await sessionCookie({ iat: now - 90000, exp: now - 3600 })];
    for (const cookie of cookies) {
      const res = await exports.default.fetch(`${ORIGIN}/auth/session`, { headers: { Cookie: cookie } });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ ok: false, error: { code: "noSession" } });
    }
  });
});

describe("POST /auth/logout", () => {
  it("clears the session for a request from the web origin", async () => {
    const res = await exports.default.fetch(`${ORIGIN}/auth/logout`, { method: "POST", headers: { Origin: ORIGIN } });
    expect(res.status).toBe(200);
    expect(setCookies(res)).toContain("__Host-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  });

  it("refuses another origin or none", async () => {
    const headerSets: Record<string, string>[] = [{ Origin: "https://evil.test" }, {}];
    for (const headers of headerSets) {
      const res = await exports.default.fetch(`${ORIGIN}/auth/logout`, { method: "POST", headers });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ ok: false, error: { code: "badOrigin" } });
      expect(setCookies(res)).toEqual([]);
    }
  });
});
