/**
 * lib/loginError.ts
 * What the login page shows for ?error=<code>. Only codes the Worker itself redirects with are
 * echoed back; any other text gets the generic message without the text, so a crafted link
 * cannot put its own words on the login page.
 */
import { isMessageKey, type MessageKey } from "./i18n";

export type LoginErrorView = { messageKey: MessageKey; code: string | null };

/**
 * @param code The ?error= value, or null when absent.
 * @returns The message key and the code to display, or null when there is no error.
 */
export function loginErrorView(code: string | null): LoginErrorView | null {
  if (code === null) return null;
  const key = `login.error.${code}`;
  return isMessageKey(key) ? { messageKey: key, code } : { messageKey: "errors.unknown", code: null };
}
