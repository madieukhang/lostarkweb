/**
 * lib/reauth.ts
 * Where the UI sends a user whose session ended during a read: a silent Discord re-login that
 * returns to the same page, at most once a minute. A second 401 within that minute means the
 * session is not sticking (blocked cookies, say), so the user goes to /login instead of
 * looping through Discord.
 */

export const SILENT_RETRY_MS = 60_000;

/**
 * @param currentPath Path and query of the page to come back to.
 * @param lastSilentAt When the last silent re-login started (ms), or null if none is known.
 * @param now Current time in ms.
 * @returns The URL to navigate to.
 */
export function reauthTarget(currentPath: string, lastSilentAt: number | null, now: number): string {
  if (lastSilentAt !== null && now - lastSilentAt < SILENT_RETRY_MS) return "/login";
  return `/auth/login?silent=1&next=${encodeURIComponent(currentPath)}`;
}
