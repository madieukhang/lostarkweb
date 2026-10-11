# Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

### Added
- Project scaffold: a Next.js 16 static export served by the `lostark-web` Worker, which takes `/auth/*` and `/api/*` before the static files and reaches `loalogs-api` over a Service Binding.
- Gateway router: the Discord login routes (not implemented yet) and `/api/<tab>/*`, where a tab with no API Worker answers 404.
- `npm test` type-checks the Worker and runs its tests in the Workers runtime.
