# Web Part 1 (Foundation, LoaLogs only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed web front door: Discord login limited to members of guilds that have the LoaLogs bot, a signed session cookie, a vi/en shell, and `/api/checklist/*` forwarded through a Service Binding to a private `loalogs-api` Worker that answers `whoami`.

**Architecture:** Two Workers on Traine's Cloudflare account. `loalogs-api` lives in `LostArk_LoaLogs/cloud/` (JavaScript, no public URL) and answers `/internal/bot-guilds` and `/api/whoami`. `lostark-web` lives in `LostArk_Web` (TypeScript): it serves the Next.js static export, owns `/auth/*`, and forwards `/api/checklist/*` to `loalogs-api` after verifying the session and replacing any client identity header. No database and no Durable Object in this part.

**Tech Stack:** Next.js 16.4.0 (static export), React 19.3.0, TypeScript 5.9.3, wrangler 4.149.0, Vitest 4.1.11 + `@cloudflare/vitest-plugin` 1.4.0, `msw` 3.0.3 + `@msw/cloudflare` 0.2.0, Discord REST API v10.

**Spec:** `docs/superpowers/specs/2026-10-10-web-part1-foundation-design.md` (Vietnamese). Decisions: `docs/decisions.md`.

## Global Constraints

- Repos: web = `E:/LostArkTool/LostArk_Web` (`madieukhang/lostarkweb`, public); API = `E:/LostArkTool/LostArk_LoaLogs/cloud/` (`madieukhang/lostarkbotcheckstatus`, public). Never import across the two bot repos. `cloud/` imports nothing from `../bot/` in this part.
- Exact pinned versions as listed in Tech Stack. TypeScript stays 5.x (TypeScript 7 support in Next.js is unverified).
- Worker `compatibility_date`: `"2026-10-01"`. `loalogs-api` uses `compatibility_flags: ["nodejs_compat"]` and `workers_dev: false`, with no `routes`.
- Discord: API base `https://discord.com/api/v10`, authorize URL `https://discord.com/oauth2/authorize`, scopes `identify guilds`, redirect URI `${PUBLIC_ORIGIN}/auth/callback`.
- Cookies: session `__Host-session` (HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 86400); state `__Host-oauth_state` (HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 600); language `lang` (Secure, SameSite=Lax, Path=/, Max-Age 31536000, NOT HttpOnly). Values `vi` or `en` only.
- Session payload: `{ v: 1, uid, name, avatar, tabs: { checklist: string[], raid: string[] }, iat, exp }`, base64url JSON + "." + base64url HMAC-SHA256 with `SESSION_SECRET`. Times are Unix seconds. `tabs.raid` is always `[]` in part 1. The Discord access token is never stored.
- API responses: success `{ ok: true, data }`; failure `{ ok: false, error: { code } }`. Status codes: 401 no session, 403 no permission, 404 not found, 409 conflict, 503 upstream unavailable.
- Identity header from the gateway to an API: `x-web-user` = JSON `{ uid, name, guilds, lang }`. The gateway deletes every incoming header whose name starts with `x-web-` before adding its own.
- Writes (POST, PUT, PATCH, DELETE) through the gateway require `Origin` equal to `PUBLIC_ORIGIN`.
- Every UI string goes through `t('<key>')`; keys typed from `lib/i18n/en.json`; `vi.json` has the same key set.
- No em-dash in code, comments, docs or strings. Comments and logs in neutral English. No dates in comments. Exported functions get JSDoc/TSDoc with params and return.
- Commits: explicit `git add <paths>` (never `-A`), no attribution or session lines, CHANGELOG entry with each commit (3-5 terse bullets) in both repos. LoaLogs: commit then push at once (Railway deploys). Web repo: push per the convention Traine confirms.
- Secrets never enter Git. Values copied from a bot `.env` are double-quoted there; strip the quotes.

## Review Focus

1. **Encoded or dotted paths reaching `/internal/*` through `/api/checklist/*`** (for example `/api/checklist/%2e%2e/%2e%2e/internal/bot-guilds`): must never reach the API's internal route. Test in Task 7.
2. **Silent re-login loop:** an expired session triggers `/auth/login?silent=1`; if Discord answers `error=consent_required` or `access_denied`, the user must land on `/login` once, not bounce forever. Test in Task 6.
3. **Discord rate limits and outages** (429 or 5xx on token exchange, `/users/@me`, `/users/@me/guilds`, or the bot guild list): a redirect to `/login?error=discordUnavailable`, or 503 from the API, never a crash or a half-set session. Tests in Tasks 1 and 6.
4. **Stale or foreign cookies** (signed with a rotated secret, a future `v`, junk base64): treated as no session (401), never a 500. Test in Task 4.
5. **Junk `lang` cookie** (`jp`, empty, `<script>`): falls back to `en` on the client and in `x-web-user.lang`. Tests in Tasks 7 and 8.

---

### Task 1: `loalogs-api` skeleton Worker (LoaLogs repo)

**Files:**
- Create: `LostArk_LoaLogs/cloud/package.json`, `cloud/wrangler.jsonc`, `cloud/vitest.config.js`, `cloud/src/index.js`, `cloud/src/respond.js`, `cloud/src/identity.js`, `cloud/src/botGuilds.js`
- Test: `cloud/test/setup.js`, `cloud/test/api.test.js`, `cloud/test/botGuilds.test.js`

**Interfaces:**
- Produces (HTTP, reached only through a Service Binding):
  - `GET /internal/bot-guilds` → 200 `{ ok: true, data: { guildIds: string[] } }`, or 503 `{ ok: false, error: { code: "discordUnavailable" } }`
  - `GET /api/whoami` → 200 `{ ok: true, data: { uid, name, guilds, lang } }`, or 401 `{ code: "noIdentity" }`
  - anything else → 404 `{ code: "notFound" }`
- Produces (JS): `respond.js`: `ok(data, status = 200): Response`, `fail(status, code): Response`; `identity.js`: `readWebUser(request): { uid, name, guilds, lang } | null` (null when the header is missing or not valid JSON with a string `uid`); `botGuilds.js`: `getBotGuildIds(env, now = Date.now(), fetchImpl = fetch): Promise<string[]>` plus `clearBotGuildCache(): void` for tests.
- Env: `BOT_TOKEN` (secret).

- [ ] **Step 1: Create `cloud/package.json`** with `"type": "module"`, `"private": true`, scripts `{ "test": "vitest run", "deploy": "wrangler deploy" }`, devDependencies pinned: `wrangler@4.149.0`, `vitest@4.1.11`, `@cloudflare/vitest-plugin@1.4.0`, `msw@3.0.3`, `@msw/cloudflare@0.2.0`. Run `npm install` inside `cloud/`. Expected: lockfile `cloud/package-lock.json` created; the bot's root `package.json` untouched.
- [ ] **Step 2: Create `cloud/wrangler.jsonc`** with name `loalogs-api`, main `src/index.js`, compatibility date and flags from Global Constraints, `"workers_dev": false`, no `routes`.
- [ ] **Step 3: Create `cloud/vitest.config.js`** using `cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" }, miniflare: { bindings: { BOT_TOKEN: "test-bot-token" } } })` from `@cloudflare/vitest-plugin` inside `defineProject` from `vitest/config`, with `test.setupFiles: ["test/setup.js"]`. `test/setup.js` enables `setupNetwork()` from `@msw/cloudflare` in `beforeAll`, `resetHandlers` in `afterEach`, `disable` in `afterAll`, and calls `clearBotGuildCache()` in `afterEach`.
- [ ] **Step 4: Write the failing tests** in `test/api.test.js` (call `exports.default.fetch` from `cloudflare:workers`; mock Discord with `http.get("https://discord.com/api/v10/users/@me/guilds", ...)` from `msw`):
  - `whoami echoes the gateway identity`: header `x-web-user: {"uid":"1","name":"A","guilds":["g1"],"lang":"vi"}` → 200, `data` deep-equals that object.
  - `whoami without identity is 401`: no header → 401, `error.code === "noIdentity"`; header `not json` → 401.
  - `bot-guilds pages through Discord`: first page 200 objects with ids `"100".."299"`, second page (request has `after=299`) 1 object `"300"` → `guildIds.length === 201`, last `"300"`; every request carries `Authorization: Bot test-bot-token` and `limit=200`.
  - `bot-guilds maps Discord failure to 503`: Discord 502 → 503, `error.code === "discordUnavailable"`; Discord 429 → 503 same code.
  - `unknown path is 404`: `GET /api/nope` → 404, `error.code === "notFound"`.
- [ ] **Step 5: Write the failing test** in `test/botGuilds.test.js`: `cache holds for five minutes`: two calls to `getBotGuildIds(env, t)` and `getBotGuildIds(env, t + 299_000)` hit Discord once; a call at `t + 301_000` hits it again (count requests in the msw handler).
- [ ] **Step 6: Run `npm test` in `cloud/`.** Expected: FAIL (modules missing).
- [ ] **Step 7: Implement** `respond.js`, `identity.js`, `botGuilds.js` (module-level cache `{ ids, expiresAt }`, 300 s; pagination: `GET /users/@me/guilds?limit=200[&after=<last id>]` until a page shorter than 200; any non-2xx or network error throws an `Error` with `name = "DiscordUnavailable"`), and `index.js` (a route table keyed by `"METHOD path"`, not an if-chain; `/internal/bot-guilds` maps the thrown error to `fail(503, "discordUnavailable")`). Caching plain data at module level is safe in Workers; caching sockets or clients is not (spike finding).
- [ ] **Step 8: Run `npm test` in `cloud/`.** Expected: all pass. Then in the repo root run `npm test` (bot suite, `node --test test`). Expected: unchanged pass count, no `cloud/` tests picked up.
- [ ] **Step 9: Commit** in `LostArk_LoaLogs`: `git add cloud/package.json cloud/package-lock.json cloud/wrangler.jsonc cloud/vitest.config.js cloud/src cloud/test CHANGELOG.md` with a CHANGELOG bullet under "Changed (internal)". Do not push yet; Task 2 lands in the same push.

### Task 2: Keep Railway and Docker out of `cloud/` (LoaLogs repo)

**Files:**
- Modify: `LostArk_LoaLogs/railway.toml` (`[build]` table), `LostArk_LoaLogs/.dockerignore`, `CHANGELOG.md`

**Interfaces:**
- Consumes: the `cloud/` folder from Task 1.
- Produces: pushes that only touch `cloud/**` no longer redeploy the bot.

- [ ] **Step 1: Add `watchPatterns = ["**", "!/cloud/**"]`** to `[build]` in `railway.toml` (gitignore syntax; Railway applies a negation only after an including rule) and a line `cloud/` to `.dockerignore` under the "not runtime input" block.
- [ ] **Step 2: Verify locally:** `git diff --check` is clean; root `npm test` passes; read the diff to confirm `watchPatterns` sits under `[build]` as a TOML string array.
- [ ] **Step 3: Commit, then push both commits** (`git fetch` and `git log origin/main..HEAD` first; push only if origin has not moved, else rebase on it): `git add railway.toml .dockerignore CHANGELOG.md`. Expected: Railway runs one deploy for this push (the root files changed), the bot comes back healthy (Traine can confirm in Railway, or watch the bot answer `/la-help`).
- [ ] **Step 4: Prove the watch pattern** later in Task 10, when a `cloud/`-only change is pushed: Railway must not start a deploy.

### Task 3: Web repo scaffold and gateway router

**Files:**
- Create in `LostArk_Web`: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `CHANGELOG.md`, `README.md`, `wrangler.jsonc`, `vitest.config.ts`, `worker/env.ts`, `worker/index.ts`, `worker/respond.ts`, `app/layout.tsx`, `app/page.tsx` (placeholder), `test/setup.ts`, `test/router.test.ts`

**Interfaces:**
- Produces: `worker/env.ts`: `interface Env { ASSETS: Fetcher; LOALOGS_API: Fetcher; DISCORD_CLIENT_ID: string; DISCORD_CLIENT_SECRET: string; SESSION_SECRET: string; PUBLIC_ORIGIN: string }`. `worker/respond.ts`: `ok(data: unknown, status?: number): Response`, `fail(status: number, code: string): Response`, `redirect(location: string, cookies?: string[]): Response` (302, one `Set-Cookie` per entry). `worker/index.ts`: default export `{ fetch(request, env, ctx) }` dispatching by a route table: `GET /auth/login`, `GET /auth/callback`, `GET /auth/session`, `POST /auth/logout`, prefix `/api/` → forwarder; everything else → `env.ASSETS.fetch(request)`. Handlers from later tasks are stubs returning `fail(501, "notImplemented")` until their task lands.

- [ ] **Step 1: `package.json`** (`"private": true`) with dependencies `next@16.4.0`, `react@19.3.0`, `react-dom@19.3.0`; devDependencies `typescript@5.9.3`, `@types/react@19.3.0`, `@types/node@22.20.5`, `wrangler@4.149.0`, `vitest@4.1.11`, `@cloudflare/vitest-plugin@1.4.0`, `msw@3.0.3`, `@msw/cloudflare@0.2.0`. Scripts: `"dev": "next dev"`, `"build": "next build"`, `"pretest": "node -e \"require('fs').mkdirSync('out',{recursive:true})\""`, `"test": "vitest run"`, `"deploy": "wrangler deploy"`. `next.config.ts`: `output: "export"`, `images: { unoptimized: true }`. `.gitignore`: `node_modules/`, `.next/`, `out/`, `.wrangler/`, `.dev.vars`, `.env*`. Run `npm install`.
- [ ] **Step 2: `wrangler.jsonc`**: name `lostark-web`, main `worker/index.ts`, compatibility date from Global Constraints, `assets: { directory: "./out", binding: "ASSETS", not_found_handling: "404-page", run_worker_first: ["/auth/*", "/api/*"] }`, `services: [{ binding: "LOALOGS_API", service: "loalogs-api" }]`, `vars: { DISCORD_CLIENT_ID: "", PUBLIC_ORIGIN: "" }`.
- [ ] **Step 3: `vitest.config.ts`**: `cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" }, miniflare: { bindings: { DISCORD_CLIENT_ID: "client-1", DISCORD_CLIENT_SECRET: "client-secret", SESSION_SECRET: "test-session-secret-0123456789abcdef", PUBLIC_ORIGIN: "https://web.test" }, workers: [<loalogs-api stub>] } })`. The stub is an inline ES module named `loalogs-api` (see the `tail-consumer` pattern in Cloudflare's `fixtures/vitest-plugin-examples/multiple-workers`): `/internal/bot-guilds` returns `{ ok: true, data: { guildIds: ["g-shared", "g-bot-only"] } }`; every other path returns `{ ok: true, data: { path, method, user: <x-web-user header or null>, sawClientHeader: <x-web-test header or null> } }`. `test/setup.ts` wires `@msw/cloudflare` as in Task 1.
- [ ] **Step 4: Write the failing tests** `test/router.test.ts`: `unknown /api/raid path is 404` (no binding for `raid` in part 1, `error.code === "notFound"`); `auth routes exist` (`GET /auth/session` without cookie is not 404).
- [ ] **Step 5: Run `npm test`.** Expected: FAIL. **Step 6: Implement** `env.ts`, `respond.ts`, `index.ts` with stubs. **Step 7: Run `npm test`** (expected: pass) and `npm run build` (expected: `out/index.html` exists).
- [ ] **Step 8: Commit:** all files above plus `package-lock.json`, CHANGELOG "Added: project scaffold, gateway router".

### Task 4: Signed session cookie

**Files:**
- Create: `worker/session.ts`, `worker/cookies.ts`; Test: `test/session.test.ts`

**Interfaces:**
- Produces: `type Tabs = { checklist: string[]; raid: string[] }`; `type SessionPayload = { v: 1; uid: string; name: string; avatar: string | null; tabs: Tabs; iat: number; exp: number }`; `signSession(payload: SessionPayload, secret: string): Promise<string>`; `verifySession(value: string | null, secret: string, nowSec: number): Promise<SessionPayload | null>`; `cookies.ts`: `readCookie(request: Request, name: string): string | null`, `buildCookie(name: string, value: string, opts: { maxAge: number; httpOnly: boolean }): string` (always `Secure; SameSite=Lax; Path=/`), `clearCookie(name: string, httpOnly: boolean): string` (Max-Age=0).

- [ ] **Step 1: Write the failing tests:** `round trip returns the payload`; `tampered payload is null` (flip one char of the payload part); `tampered signature is null`; `expired is null` (`exp = now - 1`); `future version is null` (`v: 2`); `junk is null` (`"abc"`, `"a.b.c"`, `""`, `null`); `different secret is null`. `buildCookie("__Host-session", "x", { maxAge: 86400, httpOnly: true })` contains exactly `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement** with WebCrypto `HMAC` + `SHA-256`; verify with `crypto.subtle.verify` (constant time), not string comparison; any decode or JSON error returns `null`.
- [ ] **Step 4: Run `npm test`.** Expected: PASS. **Step 5: Commit** with CHANGELOG.

### Task 5: Access rule B

**Files:**
- Create: `worker/access.ts`; Test: `test/access.test.ts`

**Interfaces:**
- Consumes: `Tabs` (Task 4), `Env` (Task 3).
- Produces: `fetchBotGuilds(env: Env): Promise<{ checklist: string[] }>` (calls `env.LOALOGS_API.fetch("https://loalogs-api/internal/bot-guilds")`, throws `Error` named `"BotGuildsUnavailable"` on non-2xx or `ok: false`); `computeTabs(userGuildIds: string[], botGuilds: { checklist: string[] }): Tabs` (intersection, order of `userGuildIds`, `raid: []`); `hasAnyTab(tabs: Tabs): boolean`.

- [ ] **Step 1: Write the failing tests:** user `["g-shared","g-other"]` with stub bot guilds → `tabs.checklist` deep-equals `["g-shared"]`, `tabs.raid` `[]`, `hasAnyTab` true; user `["g-other"]` → `hasAnyTab` false; `fetchBotGuilds(env)` with the Task 3 stub returns `{ checklist: ["g-shared","g-bot-only"] }`.
- [ ] **Step 2: Run `npm test`** (FAIL). **Step 3: Implement.** **Step 4: Run `npm test`** (PASS). **Step 5: Commit** with CHANGELOG.

### Task 6: Discord OAuth handlers

**Files:**
- Create: `worker/auth.ts`, `worker/discord.ts`; Modify: `worker/index.ts` (replace the four auth stubs); Test: `test/auth.test.ts`

**Interfaces:**
- Consumes: `signSession`, `verifySession`, cookie helpers (Task 4); `fetchBotGuilds`, `computeTabs`, `hasAnyTab` (Task 5); `redirect`, `ok`, `fail` (Task 3).
- Produces: `handleLogin(request, env): Promise<Response>`; `handleCallback(request, env, nowSec, deps = { fetchBotGuilds }): Promise<Response>` (the default is the real Task 5 function; tests inject a failing one); `handleSession(request, env, nowSec): Promise<Response>`; `handleLogout(request, env): Promise<Response>`. `discord.ts`: `exchangeCode(env, code): Promise<string>` (access token), `getUser(token): Promise<{ id: string; username: string; global_name: string | null; avatar: string | null; locale?: string }>`, `getUserGuildIds(token): Promise<string[]>`; each throws `Error` named `"DiscordUnavailable"` on non-2xx or network failure.
- Login redirect codes (the static `/login` page renders them): `stateMismatch`, `noSharedGuild`, `discordUnavailable`, `discordDenied`.

- [ ] **Step 1: Write the failing tests** (mock `POST https://discord.com/api/v10/oauth2/token`, `GET .../users/@me`, `GET .../users/@me/guilds` with `msw`):
  - `login redirects to Discord with state`: 302 to `https://discord.com/oauth2/authorize` with `client_id=client-1`, `response_type=code`, `scope=identify guilds`, `redirect_uri=https://web.test/auth/callback`, a 43-char base64url `state`; `Set-Cookie` `__Host-oauth_state` carries the same state; no `prompt` param.
  - `silent login adds prompt=none`: `/auth/login?silent=1` → URL has `prompt=none`; the state cookie value ends with `.s`.
  - `callback with mismatched state is refused`: → 302 `/login?error=stateMismatch`, no `__Host-session` cookie, state cookie cleared.
  - `member gets a session`: user guilds `["g-shared","g-x"]` → 302 `/`; `__Host-session` verifies with the test secret to `tabs.checklist` `["g-shared"]`, `exp - iat === 86400`; state cookie cleared; the cookie text does not contain the mocked access token string.
  - `non-member is refused`: user guilds `["g-x"]` → 302 `/login?error=noSharedGuild`, no session cookie.
  - `lang cookie follows Discord locale only when absent`: locale `vi` and no `lang` cookie → `Set-Cookie lang=vi`; locale `en-US` → `lang=en`; request already has `lang=en` and locale `vi` → no `lang` Set-Cookie.
  - `Discord failure does not crash`: token endpoint 429 → 302 `/login?error=discordUnavailable`, no session cookie; same for `/users/@me/guilds` 500; same when the bot guild list fails (call `handleCallback` directly with `deps.fetchBotGuilds` rejecting with an `Error` named `"BotGuildsUnavailable"`).
  - `silent consent failure lands on /login once` (Review Focus 2): callback with `error=consent_required` and a state cookie ending `.s` → 302 `/login` with no `error` and no `silent` param; non-silent `error=access_denied` → 302 `/login?error=discordDenied`.
  - `session endpoint`: valid cookie → 200 `{ uid, name, avatar, tabs: { checklist: true, raid: false } }` (booleans, no guild ids); no or bad cookie → 401 `noSession`.
  - `logout clears the session`: `POST /auth/logout` with `Origin: https://web.test` → 200 and `__Host-session` cleared (Max-Age=0); `Origin: https://evil.test` → 403 `badOrigin`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement.** `state` = 32 random bytes base64url; silent flag appended as `.s` to the cookie value only. Name shown = `global_name ?? username`. `lang` rule: `locale?.startsWith("vi") ? "vi" : "en"`.
- [ ] **Step 4: Run `npm test`.** Expected: PASS. **Step 5: Commit** with CHANGELOG.

### Task 7: API forwarding

**Files:**
- Create: `worker/forward.ts`; Modify: `worker/index.ts` (wire `/api/` prefix); Test: `test/forward.test.ts`

**Interfaces:**
- Consumes: `verifySession`, `readCookie` (Task 4); `fail` (Task 3); `Env`.
- Produces: `TAB_BINDINGS: Readonly<Record<string, keyof Env>>` = `{ checklist: "LOALOGS_API" }`; `forwardApi(request: Request, env: Env, nowSec: number): Promise<Response>`.

- [ ] **Step 1: Write the failing tests** (sessions built with `signSession` and the test secret):
  - `no session is 401` (`noSession`); `tab not in TAB_BINDINGS is 404` (`/api/raid/whoami`, `notFound`).
  - `empty checklist tab is 403` (`noTabAccess`).
  - `identity is replaced`: request with header `x-web-user: {"uid":"evil"}` and `x-web-test: hi` → stub echo shows `user.uid === "<session uid>"`, `user.guilds` deep-equals the session's `tabs.checklist`, `sawClientHeader === null`, `path === "/api/whoami"`.
  - `lang comes from the cookie and is sanitised` (Review Focus 5): cookie `lang=vi` → `user.lang === "vi"`; `lang=jp`, `lang=<script>` or none → `"en"`.
  - `writes need our Origin`: `POST /api/checklist/whoami` without `Origin` or with `https://evil.test` → 403 `badOrigin`; with `https://web.test` → reaches the stub (`method === "POST"`).
  - `internal routes stay unreachable` (Review Focus 1): `/api/checklist/../internal/bot-guilds`, `/api/checklist/%2e%2e/%2e%2e/internal/bot-guilds`, `/api/checklist/..%2Finternal%2Fbot-guilds` → the stub never sees a path starting with `/internal` (assert on the echoed `path`, or a non-200 from the gateway).
- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement:** parse `new URL(request.url)`; require pathname `/api/<tab>/<rest>` with `<tab>` in `TAB_BINDINGS`; build the target `https://<binding>/api/<rest><search>`; copy headers minus every `x-web-*` and minus `cookie`; set `x-web-user`; forward method and body.
- [ ] **Step 4: Run `npm test`.** Expected: PASS. **Step 5: Commit** with CHANGELOG.

### Task 8: i18n and the UI shell

**Files:**
- Create: `lib/i18n/en.json`, `lib/i18n/vi.json`, `lib/i18n/index.ts`, `lib/api.ts`, `components/LanguageToggle.tsx`, `components/Shell.tsx`, `app/login/page.tsx`, `app/checklist/page.tsx`; Modify: `app/layout.tsx`, `app/page.tsx`; Test: `test/i18n.test.ts`

**Interfaces:**
- Produces: `type Lang = "vi" | "en"`; `type MessageKey` (dot paths derived from `en.json`); `parseLang(value: string | null | undefined): Lang | null`; `detectLang(cookieHeader: string, navigatorLanguage: string | undefined): Lang` (cookie first, then navigator `vi*`, else `en`); `t(lang: Lang, key: MessageKey, vars?: Record<string, string>): string`; `lib/api.ts`: `apiGet<T>(path: string): Promise<T>` (on 401 for a read: `location.assign("/auth/login?silent=1")`), `apiSend<T>(path: string, init: RequestInit): Promise<T>` (on 401: throws `SessionExpiredError`, never redirects).
- UI contents (plain, no styling system; the visual round restyles later):
  - `/login`: a "Log in with Discord" link to `/auth/login`, and the message for `?error=<code>` (four codes from Task 6) via `t()`.
  - `/` (Shell): reads `/auth/session`; signed out → link to `/login`; signed in → avatar, name, logout button (POST `/auth/logout`), and a link per tab whose flag is `true`.
  - `/checklist`: calls `apiGet("/api/checklist/whoami")` and shows "Hello {name}" via `t()`; shows a skeleton while loading.
  - `LanguageToggle`: vi ⇄ en, writes the `lang` cookie (attributes from Global Constraints) and re-renders.

- [ ] **Step 1: Write the failing tests** `test/i18n.test.ts`: `vi and en have the same keys` (deep key sets equal); `every login error code has a message` (`login.error.stateMismatch`, `.noSharedGuild`, `.discordUnavailable`, `.discordDenied` exist in both); `parseLang` accepts `vi`/`en`, rejects `jp`, `""`, `<script>`; `detectLang("lang=vi", "en-US") === "vi"`, `detectLang("", "vi-VN") === "vi"`, `detectLang("lang=jp", "fr") === "en"`; `t` substitutes `{name}`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL. **Step 3: Implement** `lib/i18n`, `lib/api.ts`, components and pages; no hard-coded UI text outside the JSON files.
- [ ] **Step 4: Run `npm test`** (PASS) and `npm run build` (expected: `out/login.html`, `out/checklist.html`, `out/index.html`).
- [ ] **Step 5: Commit** with CHANGELOG.

### Task 9: Local two-Worker smoke

**Files:** none new (adds a "Local development" section to `README.md`).

- [ ] **Step 1:** In `LostArk_Web`, run `npm run build`, then `npx wrangler dev -c wrangler.jsonc -c ../LostArk_LoaLogs/cloud/wrangler.jsonc` (multi-config dev wires the Service Binding locally) with a `.dev.vars` holding throwaway `SESSION_SECRET` and `DISCORD_CLIENT_SECRET` (never committed).
- [ ] **Step 2:** Check with curl: `GET /` → 200 HTML; `GET /login` → 200 HTML; `GET /auth/session` → 401 `noSession`; `GET /api/checklist/whoami` → 401; `GET /auth/login` → 302 to `discord.com` with `Set-Cookie __Host-oauth_state`; `GET /api/raid/x` → 404. Record the outputs in the task report.
- [ ] **Step 3:** If `run_worker_first` does not accept `/auth/*` and `/api/*` patterns (Review: spec section 10), switch to listing exact paths plus the `/api/` prefix as the docs allow, rerun Step 2, and note it in `docs/decisions.md`. Stop all `wrangler dev` processes by command line afterwards (Windows leaves children alive after a shell stop).
- [ ] **Step 4: Commit** README with CHANGELOG.

### Task 10: Deploy and live verification (needs Traine and Khang)

**Files:** `docs/decisions.md` (record the final subdomain and any deviation), `CHANGELOG.md` in both repos if anything changes.

- [ ] **Step 1 (Traine):** create the Discord application for the web in the Developer Portal; add redirect `https://lostark-web.<subdomain>.workers.dev/auth/callback`; keep the client id and secret ready (secret never pasted in chat).
- [ ] **Step 2 (Traine, dashboard):** rename the account `workers.dev` subdomain from `spike-mongo-worker` (proposed `lostark-tool`).
- [ ] **Step 3 (Khang, once):** install the Cloudflare Workers GitHub app on `madieukhang`, limited to `lostarkbotcheckstatus` and `lostarkweb`. If that path fails, fall back to `npx wrangler deploy` from Traine's machine.
- [ ] **Step 4:** create Worker `loalogs-api` from `lostarkbotcheckstatus`, root directory `cloud`, build `npm ci && npm test`, deploy `npx wrangler deploy`; Traine sets secret `BOT_TOKEN` (the LoaLogs bot token, quotes stripped) in the dashboard. Deploy.
- [ ] **Step 5:** create Worker `lostark-web` from `lostarkweb`, root `/`, build `npm ci && npm test && npm run build`, deploy `npx wrangler deploy`; set vars `DISCORD_CLIENT_ID`, `PUBLIC_ORIGIN`; Traine sets secrets `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` (32+ random bytes). Deploy.
- [ ] **Step 6: Live checks, each with its evidence in the report:** Traine logs in and sees the Checklist tab; `/checklist` shows "Hello <name>"; a Discord account in no LoaLogs guild gets `noSharedGuild`; language toggle and logout work; after deleting the session cookie, the next visit re-logs in silently; `curl https://loalogs-api.<subdomain>.workers.dev/api/whoami` fails to resolve or returns a non-200 (no public route); a `cloud/`-only commit pushed to LoaLogs starts no Railway deploy (Task 2 Step 4).
- [ ] **Step 7:** run `haiku-tester` against the live URL (logged-out exploratory pass) and fix what it reproduces; then one `sonnet-reviewer` over both repos' part 1 diffs. Update `memory/project_web_cover.md` and close part 1.
