/**
 * worker/forward.ts
 * Forwards /api/<tab>/* to the API Worker bound for that tab.
 */
import type { Env } from "./env";
import { fail } from "./respond";

/** API Worker binding per web tab. RaidManage joins in part 4. */
export const TAB_BINDINGS: Readonly<Record<string, keyof Env>> = { checklist: "LOALOGS_API" };

/**
 * @param request Incoming /api/* request.
 * @param env Worker env.
 * @param nowSec Current Unix time in seconds, for the session check.
 * @returns The API Worker's answer, or an error envelope.
 */
export async function forwardApi(request: Request, env: Env, nowSec: number): Promise<Response> {
  const tab = new URL(request.url).pathname.split("/")[2] ?? "";
  if (!Object.hasOwn(TAB_BINDINGS, tab)) return fail(404, "notFound");
  return fail(501, "notImplemented");
}
