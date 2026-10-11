# lostark-web

Web version of the LostArk Discord bots (LoaLogs and RaidManage), served by one Cloudflare Worker.

## Layout

- `app/`, `components/`, `lib/`: Next.js 16 UI, built as a static export into `out/`.
- `worker/`: the `lostark-web` Worker. It serves `out/`, owns Discord login under `/auth/*`, and forwards `/api/<tab>/*` to that tab's API Worker over a Service Binding. `loalogs-api` lives in the LoaLogs repo under `cloud/`.
- `test/`: Worker tests (Vitest running inside the Workers runtime).
- `docs/`: design specs, implementation plans and decision records (`docs/decisions.md`).

## Commands

- `npm test`: type-check the Worker and run its tests.
- `npm run build`: build the static site into `out/`.
- `npm run dev`: Next.js dev server for the UI alone, without the Worker.
- `npm run deploy`: deploy the Worker with the built `out/`. Deploy `loalogs-api` first; a Service Binding needs its target to exist.

## Local development

1. Run `npm install` here and in `../LostArk_LoaLogs/cloud`, then `npm run build` to fill `out/`.
2. Create a git-ignored `.dev.vars` here:
   ```
   SESSION_SECRET="<32 or more random bytes, base64url>"
   DISCORD_CLIENT_SECRET="<the web app's secret, only for a real login>"
   PUBLIC_ORIGIN="http://localhost:8787"
   ```
   A real Discord login also needs `DISCORD_CLIENT_ID` there and `http://localhost:8787/auth/callback` among the Discord app's redirects. The API's `/internal/bot-guilds` needs `BOT_TOKEN` in `../LostArk_LoaLogs/cloud/.dev.vars`.
3. `npx wrangler dev -c wrangler.jsonc -c ../LostArk_LoaLogs/cloud/wrangler.jsonc` runs both Workers with the `LOALOGS_API` binding wired; the site is on http://localhost:8787.

On Windows, stopping `wrangler dev` can leave `workerd.exe` running and holding the port; end it by process id.
