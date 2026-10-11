import { describe, expect, it } from "vitest";
import { buildCookie, clearCookie, readCookie } from "../worker/cookies";
import { signSession, verifySession, type SessionPayload } from "../worker/session";

const SECRET = "test-session-secret-0123456789abcdef";
const NOW = 1_800_000_000;

const payload: SessionPayload = {
  v: 1,
  uid: "111",
  name: "Traine",
  avatar: "abc123",
  tabs: { checklist: ["g-shared"], raid: [] },
  iat: NOW - 60,
  exp: NOW - 60 + 86_400,
};

function swapFirstChar(text: string): string {
  return (text[0] === "A" ? "B" : "A") + text.slice(1);
}

describe("session cookie value", () => {
  it("round trip returns the payload", async () => {
    const value = await signSession(payload, SECRET);
    expect(await verifySession(value, SECRET, NOW)).toEqual(payload);
  });

  it("refuses a payload carrying another payload's signature", async () => {
    const granted = await signSession({ ...payload, tabs: { checklist: ["g-shared", "g-other"], raid: [] } }, SECRET);
    const original = await signSession(payload, SECRET);
    const forged = `${granted.split(".")[0]}.${original.split(".")[1]}`;
    expect(await verifySession(forged, SECRET, NOW)).toBeNull();
  });

  it("refuses a tampered signature", async () => {
    const [body, sig] = (await signSession(payload, SECRET)).split(".");
    expect(await verifySession(`${body}.${swapFirstChar(sig)}`, SECRET, NOW)).toBeNull();
  });

  it("refuses an expired session", async () => {
    const expired = await signSession({ ...payload, exp: NOW - 1 }, SECRET);
    const endingNow = await signSession({ ...payload, exp: NOW }, SECRET);
    expect(await verifySession(expired, SECRET, NOW)).toBeNull();
    expect(await verifySession(endingNow, SECRET, NOW)).toBeNull();
  });

  it("refuses a future payload version", async () => {
    const v2 = await signSession({ ...payload, v: 2 } as unknown as SessionPayload, SECRET);
    expect(await verifySession(v2, SECRET, NOW)).toBeNull();
  });

  it("refuses junk", async () => {
    for (const junk of ["abc", "a.b.c", "", ".", "!!.??", null]) {
      expect(await verifySession(junk, SECRET, NOW)).toBeNull();
    }
  });

  it("refuses a value signed with a different secret", async () => {
    const value = await signSession(payload, "another-secret-0123456789abcdef-x");
    expect(await verifySession(value, SECRET, NOW)).toBeNull();
  });
});

describe("cookie headers", () => {
  it("builds a host-only secure cookie", () => {
    expect(buildCookie("__Host-session", "x", { maxAge: 86400, httpOnly: true })).toBe(
      "__Host-session=x; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400",
    );
    expect(buildCookie("lang", "vi", { maxAge: 31536000, httpOnly: false })).toBe(
      "lang=vi; Secure; SameSite=Lax; Path=/; Max-Age=31536000",
    );
  });

  it("clears a cookie with Max-Age=0", () => {
    expect(clearCookie("__Host-session", true)).toBe("__Host-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  });

  it("reads one cookie by exact name", () => {
    const request = new Request("https://web.test/", {
      headers: { Cookie: "x-lang=en; __Host-session=abc.def; lang=vi; pad=a=b" },
    });
    expect(readCookie(request, "__Host-session")).toBe("abc.def");
    expect(readCookie(request, "lang")).toBe("vi");
    expect(readCookie(request, "pad")).toBe("a=b");
    expect(readCookie(request, "missing")).toBeNull();
    expect(readCookie(new Request("https://web.test/"), "lang")).toBeNull();
  });
});
