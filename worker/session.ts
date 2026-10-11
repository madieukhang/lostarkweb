/**
 * worker/session.ts
 * Stateless session: base64url(JSON payload) + "." + base64url(HMAC-SHA256 over the first part),
 * keyed by SESSION_SECRET. Nothing is stored server side; the Worker checks the signature,
 * the payload version and the expiry. The Discord access token is never part of it.
 */

/** Guild ids the user shares with each bot; an empty list hides that tab. */
export type Tabs = { checklist: string[]; raid: string[] };

export type SessionPayload = {
  v: 1;
  uid: string;
  name: string;
  avatar: string | null;
  tabs: Tabs;
  /** Issued at, Unix seconds. */
  iat: number;
  /** Expires at, Unix seconds; the session is valid while now < exp. */
  exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error("not base64url");
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

/**
 * @param payload Session contents.
 * @param secret SESSION_SECRET.
 * @returns Cookie value: base64url payload, ".", base64url signature.
 */
export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * @param value Cookie value, or null when the cookie is absent.
 * @param secret SESSION_SECRET.
 * @param nowSec Current Unix time in seconds.
 * @returns The payload when the signature matches, the version is 1 and it has not expired;
 *   otherwise null, including for any malformed value.
 */
export async function verifySession(value: string | null, secret: string, nowSec: number): Promise<SessionPayload | null> {
  const parts = value?.split(".") ?? [];
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  try {
    // crypto.subtle.verify compares in constant time.
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64Url(signature), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(fromBase64Url(body)));
    if (payload?.v !== 1 || typeof payload.exp !== "number" || nowSec >= payload.exp) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
