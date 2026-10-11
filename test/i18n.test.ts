import { describe, expect, it } from "vitest";
import en from "../lib/i18n/en.json";
import vi from "../lib/i18n/vi.json";
import { detectLang, parseLang, t } from "../lib/i18n";

function leafKeys(tree: object, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : leafKeys(value as object, `${prefix}${key}.`),
  );
}

function leafValues(tree: object): unknown[] {
  return Object.values(tree).flatMap((value) => (typeof value === "object" && value !== null ? leafValues(value) : [value]));
}

describe("messages", () => {
  it("vi and en have the same keys", () => {
    expect(leafKeys(vi).sort()).toEqual(leafKeys(en).sort());
  });

  it("every message is a non-empty string", () => {
    for (const value of [...leafValues(en), ...leafValues(vi)]) {
      expect(typeof value === "string" && value.trim().length > 0).toBe(true);
    }
  });

  it("every login error code and API error code has a message", () => {
    const keys = new Set(leafKeys(en));
    for (const code of ["stateMismatch", "noSharedGuild", "discordUnavailable", "discordDenied"]) {
      expect(keys.has(`login.error.${code}`)).toBe(true);
    }
    for (const code of ["noSession", "noTabAccess", "badOrigin", "notFound", "apiUnavailable", "unknown"]) {
      expect(keys.has(`errors.${code}`)).toBe(true);
    }
  });
});

describe("language choice", () => {
  it("parseLang accepts only supported languages", () => {
    expect(parseLang("vi")).toBe("vi");
    expect(parseLang("en")).toBe("en");
    for (const value of ["jp", "", "<script>", "VI", null, undefined]) {
      expect(parseLang(value)).toBeNull();
    }
  });

  it("detectLang prefers the cookie, then the browser language", () => {
    expect(detectLang("lang=vi", "en-US")).toBe("vi");
    expect(detectLang("theme=dark; lang=en", "vi-VN")).toBe("en");
    expect(detectLang("", "vi-VN")).toBe("vi");
    expect(detectLang("lang=jp", "fr")).toBe("en");
    expect(detectLang("", undefined)).toBe("en");
  });

  it("t fills placeholders in the chosen language", () => {
    expect(t("en", "checklist.hello", { name: "Traine" })).toBe("Hello Traine");
    expect(t("vi", "checklist.hello", { name: "Traine" })).toBe("Xin chào Traine");
  });
});
