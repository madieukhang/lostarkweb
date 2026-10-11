/**
 * worker/index.ts
 * lostark-web: the single front door. Serves the static Next.js export, owns Discord login
 * under /auth/*, and forwards /api/<tab>/* to that tab's API Worker over a Service Binding.
 * wrangler.jsonc sends only /auth/* and /api/* here first; other paths are static files.
 */
import { handleCallback, handleLogin, handleLogout, handleSession } from "./auth";
import type { Env } from "./env";
import { forwardApi } from "./forward";

type Handler = (request: Request, env: Env, nowSec: number) => Promise<Response>;

const ROUTES = new Map<string, Handler>([
  ["GET /auth/login", handleLogin],
  ["GET /auth/callback", handleCallback],
  ["GET /auth/session", handleSession],
  ["POST /auth/logout", handleLogout],
]);

export default {
  async fetch(request, env) {
    const nowSec = Math.floor(Date.now() / 1000);
    const { pathname } = new URL(request.url);
    const handler = ROUTES.get(`${request.method} ${pathname}`);
    if (handler) return handler(request, env, nowSec);
    if (pathname.startsWith("/api/")) return forwardApi(request, env, nowSec);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
