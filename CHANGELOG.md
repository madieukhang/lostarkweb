# Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

### Added
- Project scaffold: a Next.js 16 static export served by the `lostark-web` Worker, which takes `/auth/*` and `/api/*` before the static files and reaches `loalogs-api` over a Service Binding.
- Gateway router: the Discord login routes (not implemented yet) and `/api/<tab>/*`, where a tab with no API Worker answers 404.
- `npm test` type-checks the Worker and runs its tests in the Workers runtime.
- Signed session cookie: the session payload travels as base64url JSON with an HMAC-SHA256 signature, checked in constant time; a tampered, expired, unknown-version or malformed value reads as no session.
- Access rule: a user gets a tab only for the guilds they share with that tab's bot, read from `loalogs-api` over the Service Binding; with no shared guild there is no session.
