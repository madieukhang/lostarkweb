/**
 * worker/discord.ts
 * The three Discord calls of a login. Each throws an Error named "DiscordUnavailable" on a
 * network error or a non-2xx answer, which the callback turns into a "try again" page.
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

async function discordJson<T>(url: string, init: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`Discord answered HTTP ${res.status} for ${new URL(url).pathname}`);
    return (await res.json()) as T;
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
  const token = await discordJson<{ access_token: string }>(`${API}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.DISCORD_CLIENT_ID}:${env.DISCORD_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return token.access_token;
}

/**
 * @param token User access token.
 * @returns The signed-in Discord user.
 */
export function getUser(token: string): Promise<DiscordUser> {
  return discordJson<DiscordUser>(`${API}/users/@me`, { headers: { Authorization: `Bearer ${token}` } });
}

/**
 * One page is enough: the default page size is 200, the most guilds a user can join.
 * @param token User access token.
 * @returns Ids of the guilds the user is in.
 */
export async function getUserGuildIds(token: string): Promise<string[]> {
  const guilds = await discordJson<Array<{ id: string }>>(`${API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return guilds.map((guild) => guild.id);
}
