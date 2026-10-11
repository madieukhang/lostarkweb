/**
 * worker/origin.ts
 * Cross-site write guard: a state-changing request must carry the web's own Origin.
 */
import type { Env } from "./env";

/**
 * @param request Incoming request.
 * @param env Worker env holding PUBLIC_ORIGIN.
 * @returns Whether the Origin header names this site.
 */
export function hasOurOrigin(request: Request, env: Env): boolean {
  return request.headers.get("Origin") === env.PUBLIC_ORIGIN;
}
