/**
 * worker/cookies.ts
 * Cookie read and write helpers. Every cookie the Worker sets is Secure, SameSite=Lax and
 * Path=/ with no Domain, which the __Host- prefix requires.
 */

/**
 * @param request Incoming request.
 * @param name Exact cookie name.
 * @returns The cookie's value, or null when it is absent.
 */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/**
 * @param name Cookie name.
 * @param value Cookie value.
 * @param opts Lifetime in seconds, and whether page scripts are denied access.
 * @returns A Set-Cookie header value.
 */
export function buildCookie(name: string, value: string, opts: { maxAge: number; httpOnly: boolean }): string {
  const attributes = [`${name}=${value}`, ...(opts.httpOnly ? ["HttpOnly"] : []), "Secure", "SameSite=Lax", "Path=/"];
  return [...attributes, `Max-Age=${opts.maxAge}`].join("; ");
}

/**
 * @param name Cookie name.
 * @param httpOnly Must match how the cookie was set.
 * @returns A Set-Cookie header value that deletes the cookie.
 */
export function clearCookie(name: string, httpOnly: boolean): string {
  return buildCookie(name, "", { maxAge: 0, httpOnly });
}
