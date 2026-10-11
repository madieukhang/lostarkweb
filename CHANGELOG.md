# Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

### Added
- Project scaffold: a Next.js 16 static export served by the `lostark-web` Worker, which takes `/auth/*` and `/api/*` before the static files and reaches `loalogs-api` over a Service Binding.
- Gateway router: the Discord login routes (not implemented yet) and `/api/<tab>/*`, where a tab with no API Worker answers 404.
- `npm test` type-checks the Worker and runs its tests in the Workers runtime.
- Signed session cookie: the session payload travels as base64url JSON with an HMAC-SHA256 signature, checked in constant time; a tampered, expired, unknown-version or malformed value reads as no session.
- Access rule: a user gets a tab only for the guilds they share with that tab's bot, read from `loalogs-api` over the Service Binding; with no shared guild there is no session.
- Discord login: `/auth/login` (with a silent `prompt=none` mode for an expired session), `/auth/callback`, `/auth/session` and `/auth/logout`. The Discord token is used once and never stored; a refused silent login lands on the login page instead of looping; Discord or bot API outages send the user back with a retry message; the first login sets the language from the Discord locale unless one is already chosen.
- API forwarding: `/api/<tab>/<rest>` reaches `/api/<rest>` on that tab's API Worker only with a valid session and a shared guild for the tab. The gateway replaces any client-sent `x-web-*` header with the signed-in user (and the chosen language), drops cookies, refuses writes from another origin, never reaches an API's `/internal/*` routes, and answers 503 when the API Worker fails.
- Vietnamese and English UI with a language toggle; the choice lives in the `lang` cookie, and the browser language decides before one is made. Message keys are typed from `en.json`, and a test keeps `vi.json` on the same keys.
- Plain UI shell (styling comes in the design round): the home page shows who is signed in, the tabs they may open and a logout button; `/login` explains each login error; `/checklist` greets the user through `loalogs-api`.
- An expired session during a page load re-logs in silently and returns to the same page (`/auth/login?next=`, same-site paths only). A second expiry within a minute goes to `/login` instead, so a session that cannot stick never loops through Discord.
