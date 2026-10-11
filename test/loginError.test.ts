import { expect, it } from "vitest";
import { loginErrorView } from "../lib/loginError";

it("shows nothing without an error", () => {
  expect(loginErrorView(null)).toBeNull();
});

it("shows a known code with its message and the code", () => {
  expect(loginErrorView("noSharedGuild")).toEqual({ messageKey: "login.error.noSharedGuild", code: "noSharedGuild" });
});

it("never echoes an unknown code back onto the page", () => {
  for (const text of ["Call this number to unlock", "__proto__", "error", ""]) {
    expect(loginErrorView(text)).toEqual({ messageKey: "errors.unknown", code: null });
  }
});
