import { expect, it } from "vitest";
import { reauthTarget } from "../lib/reauth";

it("re-logs in silently and comes back to the same page", () => {
  expect(reauthTarget("/checklist?tab=a", null, 1_000_000)).toBe("/auth/login?silent=1&next=%2Fchecklist%3Ftab%3Da");
});

it("sends the user to /login instead of a second silent login within a minute", () => {
  expect(reauthTarget("/checklist", 1_000_000, 1_000_000 + 59_000)).toBe("/login");
  expect(reauthTarget("/checklist", 1_000_000, 1_000_000 + 61_000)).toBe("/auth/login?silent=1&next=%2Fchecklist");
});
