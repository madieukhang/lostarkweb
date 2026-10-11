/**
 * lib/i18n/index.ts
 * UI messages in vi and en. Keys are typed from en.json, so a wrong key fails the build, and a
 * test keeps vi.json on the same key set. No browser or Workers APIs, so tests run it directly.
 */
import en from "./en.json";
import vi from "./vi.json";
import { langFromLocale, parseLang, type Lang } from "./lang";

export { langFromLocale, parseLang, type Lang };

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Dot path of a message, such as "login.error.noSharedGuild". */
export type MessageKey = Leaves<typeof en>;

const MESSAGES: Record<Lang, unknown> = { en, vi };

function lookup(lang: Lang, key: string): string | undefined {
  let node: unknown = MESSAGES[lang];
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === "string" ? node : undefined;
}

/**
 * @param key Any string, such as a key built from an error code.
 * @returns Whether a message exists for it.
 */
export function isMessageKey(key: string): key is MessageKey {
  return lookup("en", key) !== undefined;
}

/**
 * @param lang UI language.
 * @param key Message key.
 * @param vars Values for {placeholders} in the message.
 * @returns The message, or the key itself when it is missing.
 */
export function t(lang: Lang, key: MessageKey, vars: Record<string, string> = {}): string {
  const text = lookup(lang, key) ?? key;
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => vars[name] ?? placeholder);
}

/**
 * @param code Error code from an API envelope.
 * @returns Its errors.* message key, or errors.unknown.
 */
export function errorMessageKey(code: string): MessageKey {
  const key = `errors.${code}`;
  return isMessageKey(key) ? key : "errors.unknown";
}

/**
 * @param cookieHeader document.cookie or a Cookie header.
 * @param navigatorLanguage navigator.language, if known.
 * @returns The lang cookie's language when valid, else "vi" for a Vietnamese browser, else "en".
 */
export function detectLang(cookieHeader: string, navigatorLanguage: string | undefined): Lang {
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    const lang = eq !== -1 && part.slice(0, eq).trim() === "lang" ? parseLang(part.slice(eq + 1).trim()) : null;
    if (lang) return lang;
  }
  return langFromLocale(navigatorLanguage);
}
