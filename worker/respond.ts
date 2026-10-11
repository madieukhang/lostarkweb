/**
 * worker/respond.ts
 * Response helpers. API answers use the envelope the web UI and the API Workers share:
 * { ok: true, data } on success, { ok: false, error: { code } } on failure.
 */

/**
 * @param data Response payload.
 * @param status HTTP status, 200 by default.
 * @returns JSON success response.
 */
export function ok(data: unknown, status = 200): Response {
  return Response.json({ ok: true, data }, { status });
}

/**
 * @param status HTTP status.
 * @param code Machine-readable error code the web UI translates.
 * @returns JSON failure response.
 */
export function fail(status: number, code: string): Response {
  return Response.json({ ok: false, error: { code } }, { status });
}

/**
 * @param location Redirect target.
 * @param cookies Set-Cookie values, one header each.
 * @returns 302 response.
 */
export function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}
