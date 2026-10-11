/**
 * worker/env.ts
 * Bindings and vars of the lostark-web Worker; wrangler.jsonc declares the same names.
 */
export interface Env {
  ASSETS: Fetcher;
  LOALOGS_API: Fetcher;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  PUBLIC_ORIGIN: string;
}
