/**
 * worker/access.ts
 * Rule B: only members of a guild that has a bot may sign in, and each tab shows only for the
 * guilds the user shares with that tab's bot. Part 1 has the LoaLogs API alone, so tabs.raid
 * stays empty until RaidManage joins.
 */
import type { Env } from "./env";
import type { Tabs } from "./session";

function botGuildsUnavailable(cause: unknown): Error {
  const error = new Error("Bot guild list unavailable", { cause });
  error.name = "BotGuildsUnavailable";
  return error;
}

/**
 * @param env Worker env with the LOALOGS_API binding.
 * @returns Guild ids per bot.
 * @throws {Error} named "BotGuildsUnavailable" when the API errors, answers non-2xx or ok: false.
 */
export async function fetchBotGuilds(env: Env): Promise<{ checklist: string[] }> {
  let body: { ok?: boolean; data?: { guildIds?: unknown } } | null;
  try {
    const res = await env.LOALOGS_API.fetch("https://loalogs-api/internal/bot-guilds");
    body = res.ok ? await res.json() : null;
  } catch (err) {
    throw botGuildsUnavailable(err);
  }
  const guildIds = body?.ok ? body.data?.guildIds : undefined;
  if (!Array.isArray(guildIds)) throw botGuildsUnavailable(new Error("loalogs-api gave no guild list"));
  return { checklist: guildIds };
}

/**
 * @param userGuildIds Guilds the Discord user is in.
 * @param botGuilds Guilds each bot is in.
 * @returns The shared guilds per tab, in the user's guild order.
 */
export function computeTabs(userGuildIds: string[], botGuilds: { checklist: string[] }): Tabs {
  const checklist = new Set(botGuilds.checklist);
  return { checklist: userGuildIds.filter((id) => checklist.has(id)), raid: [] };
}

/**
 * @param tabs Shared guilds per tab.
 * @returns Whether at least one tab would show, which rule B requires for a session.
 */
export function hasAnyTab(tabs: Tabs): boolean {
  return tabs.checklist.length > 0 || tabs.raid.length > 0;
}
