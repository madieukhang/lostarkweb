import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineProject } from "vitest/config";

// Stand-in for the loalogs-api Worker behind the LOALOGS_API Service Binding. It answers the
// bot guild list and echoes what the gateway forwarded, so tests can assert on the request
// the API would receive.
const LOALOGS_API_STUB = `
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/internal/bot-guilds") {
      return Response.json({ ok: true, data: { guildIds: ["g-shared", "g-bot-only"] } });
    }
    const user = request.headers.get("x-web-user");
    return Response.json({
      ok: true,
      data: {
        path: url.pathname,
        search: url.search,
        method: request.method,
        body: await request.text(),
        user: user === null ? null : JSON.parse(user),
        rawUser: user,
        sawClientHeader: request.headers.get("x-web-test"),
        sawCookie: request.headers.get("cookie"),
      },
    });
  },
};
`;

export default defineProject({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          DISCORD_CLIENT_ID: "client-1",
          DISCORD_CLIENT_SECRET: "client-secret",
          SESSION_SECRET: "test-session-secret-0123456789abcdef",
          PUBLIC_ORIGIN: "https://web.test",
        },
        workers: [
          {
            name: "loalogs-api",
            modules: [{ path: "index.js", type: "ESModule", contents: LOALOGS_API_STUB }],
            compatibilityDate: "2026-10-01",
          },
        ],
      },
    }),
  ],
  test: {
    setupFiles: ["test/setup.ts"],
  },
});
