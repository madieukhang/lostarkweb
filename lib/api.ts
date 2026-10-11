/**
 * lib/api.ts
 * Browser calls to the gateway's same-origin /api/* routes; the session cookie rides along.
 * A read that finds the session gone re-logs in silently and comes back (lib/reauth.ts); a
 * write never redirects, so the UI can keep the user's input and offer a fresh login.
 */
import { reauthTarget } from "./reauth";

const SILENT_LOGIN_KEY = "lostark.silentLoginAt";

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`API answered ${status} ${code}`);
    this.name = "ApiError";
  }
}

// Without storage the loop guard cannot work, so a missing value reads as "just tried".
function lastSilentLoginAt(): number | null {
  try {
    const stored = sessionStorage.getItem(SILENT_LOGIN_KEY);
    return stored === null ? null : Number(stored);
  } catch {
    return Date.now();
  }
}

function rememberSilentLogin(now: number): void {
  try {
    sessionStorage.setItem(SILENT_LOGIN_KEY, String(now));
  } catch {
    // Storage blocked: lastSilentLoginAt already treats this as a recent attempt.
  }
}

async function readEnvelope<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { code?: string } } | null;
  if (res.ok && body?.ok) return body.data as T;
  throw new ApiError(res.status, body?.error?.code ?? "unknown");
}

/**
 * @param path Same-origin API path, such as "/api/checklist/whoami".
 * @returns The envelope's data. On 401 the page navigates away and this never settles.
 * @throws {ApiError} for any other failure.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin" });
  if (res.status === 401) {
    const now = Date.now();
    const target = reauthTarget(`${location.pathname}${location.search}`, lastSilentLoginAt(), now);
    if (target.startsWith("/auth/login")) rememberSilentLogin(now);
    location.assign(target);
    return new Promise<T>(() => {});
  }
  return readEnvelope<T>(res);
}

/**
 * @param path Same-origin path of a write.
 * @param init Method and body.
 * @returns The envelope's data.
 * @throws {SessionExpiredError} on 401; {ApiError} for any other failure.
 */
export async function apiSend<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: "same-origin" });
  if (res.status === 401) throw new SessionExpiredError();
  return readEnvelope<T>(res);
}
