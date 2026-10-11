import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

const ORIGIN = "https://web.test";

it("answers 404 for an /api tab with no API binding", async () => {
  const res = await exports.default.fetch(`${ORIGIN}/api/raid/whoami`);
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ ok: false, error: { code: "notFound" } });
});

it("routes the auth endpoints to the Worker, not the static files", async () => {
  const res = await exports.default.fetch(`${ORIGIN}/auth/session`);
  expect(res.status).not.toBe(404);
});
