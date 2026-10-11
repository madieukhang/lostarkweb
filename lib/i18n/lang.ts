/**
 * lib/i18n/lang.ts
 * Supported UI languages and how a raw value maps to one. Shared by the UI and the Worker,
 * so it uses no browser or Workers APIs.
 */

export type Lang = "vi" | "en";

/**
 * @param value Raw value, such as the lang cookie.
 * @returns The language, or null when the value is not a supported one.
 */
export function parseLang(value: string | null | undefined): Lang | null {
  return value === "vi" || value === "en" ? value : null;
}

/**
 * @param locale A Discord locale or browser language tag, such as "vi" or "en-US".
 * @returns "vi" for any Vietnamese tag, otherwise "en".
 */
export function langFromLocale(locale: string | null | undefined): Lang {
  return locale?.toLowerCase().startsWith("vi") ? "vi" : "en";
}
