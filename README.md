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
