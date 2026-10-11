import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { computeTabs, fetchBotGuilds, hasAnyTab } from "../worker/access";

const botGuilds = { checklist: ["g-shared", "g-bot-only"] };

describe("rule B: a tab shows only for guilds shared with its bot", () => {
  it("keeps the guilds the user shares with the bot", () => {
    const tabs = computeTabs(["g-shared", "g-other"], botGuilds);
    expect(tabs).toEqual({ checklist: ["g-shared"], raid: [] });
    expect(hasAnyTab(tabs)).toBe(true);
  });

  it("gives no tab to a user who shares no guild with a bot", () => {
    const tabs = computeTabs(["g-other"], botGuilds);
    expect(tabs).toEqual({ checklist: [], raid: [] });
    expect(hasAnyTab(tabs)).toBe(false);
  });

  it("counts either tab", () => {
    expect(hasAnyTab({ checklist: [], raid: ["r1"] })).toBe(true);
  });
});

describe("fetchBotGuilds", () => {
  it("reads the LoaLogs bot guilds over the Service Binding", async () => {
    expect(await fetchBotGuilds(env)).toEqual({ checklist: ["g-shared", "g-bot-only"] });
  });

  it("throws BotGuildsUnavailable when the API cannot answer", async () => {
    const answers: Array<() => Promise<Response>> = [
      async () => Response.json({ ok: false, error: { code: "discordUnavailable" } }, { status: 503 }),
      async () => Response.json({ ok: false, error: { code: "discordUnavailable" } }),
      async () => {
        throw new Error("binding target threw");
      },
    ];
    for (const answer of answers) {
      const failing = { ...env, LOALOGS_API: { fetch: answer } as unknown as Fetcher };
      await expect(fetchBotGuilds(failing)).rejects.toMatchObject({ name: "BotGuildsUnavailable" });
    }
  });
});
