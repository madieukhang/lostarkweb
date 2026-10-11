import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { forwardApi } from "../worker/forward";
import { signSession, type Tabs } from "../worker/session";

const ORIGIN = "https://web.test";
const SECRET = "test-session-secret-0123456789abcdef";

async function sessionCookie(tabs: Tabs = { checklist: ["g-shared"], raid: [] }, name = "Traine"): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const value = await signSession({ v: 1, uid: "111", name, avatar: null, tabs, iat: now, exp: now + 3600 }, SECRET);
  return `__Host-session=${value}`;
}

function api(path: string, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(`${ORIGIN}${path}`, init);
}

type Echo = {
  ok: true;
  data: {
    path: string;
    search: string;
    method: string;
    body: string;
    user: { uid: string; name: string; guilds: string[]; lang: string } | null;
    rawUser: string | null;
    sawClientHeader: string | null;
    sawCookie: string | null;
  };
};

describe("/api/<tab>/* gate", () => {
  it("is 401 without a valid session", async () => {
    for (const cookie of ["", "__Host-session=junk"]) {
      const res = await api("/api/checklist/whoami", { headers: { Cookie: cookie } });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ ok: false, error: { code: "noSession" } });
    }
  });

  it("is 404 for a tab with no API, or no path under the tab", async () => {
    const cookie = await sessionCookie();
    for (const path of ["/api/raid/whoami", "/api/checklist", "/api/__proto__/whoami"]) {
      const res = await api(path, { headers: { Cookie: cookie } });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ ok: false, error: { code: "notFound" } });
    }
  });

  it("is 403 when the session shares no guild for the tab", async () => {
    const res = await api("/api/checklist/whoami", {
      headers: { Cookie: await sessionCookie({ checklist: [], raid: ["r1"] }) },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: { code: "noTabAccess" } });
  });
});

describe("forwarding", () => {
  it("replaces any client identity with the session's and drops cookies", async () => {
    const res = await api("/api/checklist/whoami?q=1", {
      headers: {
        Cookie: `${await sessionCookie()}; lang=vi`,
        "x-web-user": JSON.stringify({ uid: "evil", name: "Mallory", guilds: ["g-bot-only"], lang: "vi" }),
        "X-Web-Test": "hi",
      },
    });
    expect(res.status).toBe(200);
    const echo = (await res.json()) as Echo;
    expect(echo.data).toMatchObject({
      path: "/api/whoami",
      search: "?q=1",
      method: "GET",
      user: { uid: "111", name: "Traine", guilds: ["g-shared"], lang: "vi" },
      sawClientHeader: null,
      sawCookie: null,
    });
  });

  it("keeps the identity header ASCII so any display name survives intact", async () => {
    for (const name of ["Nguyễn Văn Á", "Traine 🌸", "ひらがな"]) {
      const res = await api("/api/checklist/whoami", { headers: { Cookie: await sessionCookie(undefined, name) } });
      const echo = (await res.json()) as Echo;
      expect(echo.data.user?.name).toBe(name);
      expect(echo.data.rawUser).toMatch(/^[\x20-\x7e]+$/);
    }
  });

  it("sends a supported language only, defaulting to en", async () => {
    const session = await sessionCookie();
    for (const [langCookie, expected] of [["lang=en", "en"], ["lang=jp", "en"], ["lang=<script>", "en"], ["", "en"], ["lang=vi", "vi"]]) {
      const cookie = [session, langCookie].filter(Boolean).join("; ");
      const echo = (await (await api("/api/checklist/whoami", { headers: { Cookie: cookie } })).json()) as Echo;
      expect(echo.data.user?.lang).toBe(expected);
    }
  });

  it("lets a write through only with the web's Origin", async () => {
    const cookie = await sessionCookie();
    const refused: Array<[string, Record<string, string>]> = [
      ["POST", {}],
      ["POST", { Origin: "https://evil.test" }],
      ["PUT", { Origin: "https://evil.test" }],
      ["PATCH", { Origin: "https://evil.test" }],
      ["DELETE", { Origin: "https://evil.test" }],
    ];
    for (const [method, headers] of refused) {
      const res = await api("/api/checklist/whoami", { method, headers: { Cookie: cookie, ...headers }, body: method === "DELETE" ? undefined : "{}" });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ ok: false, error: { code: "badOrigin" } });
    }

    const res = await api("/api/checklist/whoami", {
      method: "POST",
      headers: { Cookie: cookie, Origin: ORIGIN, "Content-Type": "application/json" },
      body: '{"a":1}',
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as Echo).data).toMatchObject({ method: "POST", body: '{"a":1}' });

    const read = await api("/api/checklist/whoami", { headers: { Cookie: cookie, Origin: "https://evil.test" } });
    expect(read.status).toBe(200);
  });

  it("never reaches the API's internal routes", async () => {
    const cookie = await sessionCookie();
    const paths = [
      "/api/checklist/../internal/bot-guilds",
      "/api/checklist/%2e%2e/%2e%2e/internal/bot-guilds",
      "/api/checklist/..%2Finternal%2Fbot-guilds",
      "/api/checklist/%2E%2E/%2E%2E/internal/bot-guilds",
    ];
    for (const path of paths) {
      const res = await api(path, { headers: { Cookie: cookie } });
      const text = await res.text();
      expect(text).not.toContain("g-bot-only");
      if (res.status === 200) expect((JSON.parse(text) as Echo).data.path.startsWith("/api/")).toBe(true);
    }
  });

  it("answers 503 when the API Worker fails", async () => {
    const request = new Request(`${ORIGIN}/api/checklist/whoami`, { headers: { Cookie: await sessionCookie() } });
    const down = {
      ...env,
      LOALOGS_API: {
        fetch: async () => {
          throw new Error("loalogs-api threw");
        },
      } as unknown as Fetcher,
    };
    const res = await forwardApi(request, down, Math.floor(Date.now() / 1000));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: { code: "apiUnavailable" } });
  });
});
