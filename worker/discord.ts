/**
 * worker/discord.ts
 * The three Discord calls of a login. Each throws an Error named "DiscordUnavailable" on a
 * network error, a non-2xx answer or a body without the expected shape, which the callback
 * turns into a "try again" page; no session is ever built from an unchecked body.
 */
import type { Env } from "./env";

const API = "https://discord.com/api/v10";

export type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  locale?: string;
};

async function discordJson<T>(url: string, init: RequestInit, isExpected: (body: unknown) => body is T): Promise<T> {
  const path = new URL(url).pathname;
  try {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`Discord answered HTTP ${res.status} for ${path}`);
    const body: unknown = await res.json();
    if (!isExpected(body)) throw new Error(`Discord sent an unexpected body for ${path}`);
    return body;
  } catch (err) {
    const error = new Error("Discord unavailable", { cause: err });
    error.name = "DiscordUnavailable";
    throw error;
  }
}

/**
 * @param env Worker env with the web app's Discord client id and secret.
 * @param code Authorization code from the callback.
 * @returns The user's access token, used for this login only and never stored.
 */
export async function exchangeCode(env: Env, code: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${env.PUBLIC_ORIGIN}/auth/callback`,
  });
  const token = await discordJson(
    `${API}/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.DISCORD_CLIENT_ID}:${env.DISCORD_CLIENT_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
    (value): value is { access_token: string } => typeof (value as { access_token?: unknown } | null)?.access_token === "string",
  );
  return token.access_token;
}

function isDiscordUser(value: unknown): value is DiscordUser {
  const user = value as Partial<DiscordUser> | null;
  return typeof user?.id === "string" && typeof user.username === "string";
}

function isGuildList(value: unknown): value is Array<{ id: string }> {
  return Array.isArray(value) && value.every((guild) => typeof (guild as { id?: unknown } | null)?.id === "string");
}

/**
 * @param token User access token.
 * @returns The signed-in Discord user.
 */
export function getUser(token: string): Promise<DiscordUser> {
  return discordJson(`${API}/users/@me`, { headers: { Authorization: `Bearer ${token}` } }, isDiscordUser);
}

/**
 * One page is enough: the default page size is 200, the most guilds a user can join.
 * @param token User access token.
 * @returns Ids of the guilds the user is in.
 */
export async function getUserGuildIds(token: string): Promise<string[]> {
  const guilds = await discordJson(`${API}/users/@me/guilds`, { headers: { Authorization: `Bearer ${token}` } }, isGuildList);
  return guilds.map((guild) => guild.id);
}
