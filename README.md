# euc-app

Fullstack KickJS workspace — typed end to end.

| Package   | What                                                              |
| --------- | ----------------------------------------------------------------- |
| `server/` | KickJS API (decorators, DI, `kick dev` with typegen watch)       |
| `web/`    | Vite + React, typed against the API via `@forinda/kickjs-client` |

## Develop

```bash
pnpm install
pnpm dev            # server (kick dev) + web (vite), in parallel
```

Server: http://localhost:3000 · Web: http://localhost:5173 (Vite proxies `/api`).

To vote from phones on the same Wi-Fi during development, start the web app
with `pnpm --filter ./web dev --host` and open the printed Network address.

## Deploy

### Vercel (recommended)

The React app is served from Vercel's CDN and the KickJS API runs as one
serverless function (`server/src/serverless.ts`, built by
`kick build:vercel`). Functions don't share memory or hold connections, so two
services do that part:

- **Upstash Redis** stores sessions, questions, votes and drafts.
- **Ably** pushes live updates to the projector and phones, and counts who has joined.

`SessionInfraAdapter` (`server/src/adapters/session-infra.adapter.ts`) picks
each implementation from env: Redis if its vars are set (else in-memory), and
Ably if its key is set (else screens poll every 2 s).

1. **Import the repo** in Vercel. Root Directory: `./`; Framework Preset:
   **Other**. `vercel.json` sets the build command (`pnpm run build:vercel`).
2. **Add Upstash Redis:** Project → Storage → Marketplace → Upstash Redis →
   connect to this project. It injects the Redis env vars.
3. **Add Ably:** create an app at ably.com and copy an API key with publish,
   subscribe and presence capabilities. Add it as `ABLY_API_KEY` under
   Project → Settings → Environment Variables. (Optional: without it,
   screens poll every 2 s and the projector shows no join count.)
4. **Deploy** (push to the connected branch, or `vercel --prod`).

Check the function logs after the first request: they say which store and
realtime service were picked. A warning that says *"in-memory on Vercel"*
means Upstash isn't connected yet, and sessions will be lost or split.

Build locally: `pnpm build:vercel` writes `.vercel/output` (static files, the
`api` function, routes with the SPA fallback).

| Env | Needed on Vercel | Notes |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Yes | Or `KV_REST_API_URL` / `KV_REST_API_TOKEN`, whichever names the integration injects. |
| `ABLY_API_KEY` | Recommended | Server-only; browsers get short-lived tokens from `/api/v1/sessions/:code/realtime-token`. |

### Docker (any always-on host)

The same app as one long-running Node process, which also serves the web app:

```bash
docker build -t euc-app .
docker run -p 3000:3000 euc-app      # http://localhost:3000
```

With no env it uses the in-memory store (fine for **one** instance; a restart
ends live sessions) and polling. Add the Upstash and Ably vars above to share
state across instances and push live updates. `CLIENT_DIR` (default
`../web/dist`, `/app/web` in the image) points at the built web app. Health
check: `GET /api/v1/hello/health`.

### Local development

`pnpm dev` works with no accounts: in-memory store and polling. Put
`ABLY_API_KEY=...` in `server/.env` to try live updates. To test the Redis
store without Upstash, run Redis plus `hiett/serverless-redis-http` (an Upstash
REST emulator) in Docker; see `server/src/modules/sessions/session.repository.contract.test.ts`.

## The type loop

1. Server handlers **return** their payloads (`return this.service.greet(...)`).
2. `kick typegen` emits `server/.kickjs/types/kick__client.d.ts` — the flat
   route map with every response type resolved to a literal shape.
3. `web/tsconfig.json` lists that file in `types`, so `KickClientApi` is
   ambient — no import, no bridge file.
4. `web/src/api.ts`'s `createClient<KickClientApi.Api>` types every call site.

Because the map holds resolved types rather than references to controllers,
`web` never compiles server source: no `experimentalDecorators`, no path
aliases into `server/src`.

Rename a field in `server/src/modules/hello/hello.service.ts` → `web/src/App.tsx`
stops compiling. That's the point.

### Keeping the map fresh

`server/.kickjs/types/kick__client.d.ts` is generated, and `web` reads it as
an ambient type package. Two things follow.

**It is not refreshed by `kick dev`.** Resolving it builds a whole TypeScript
program over the server, which is a build-step cost rather than a per-save one,
so a renamed response field surfaces on the next `kick typegen` rather than on
save. Everything else in `.kickjs/types` still updates on save. Add
`kick typegen --check` to CI and a stale map fails the build.

**It needs a compiler API.** TypeScript 7 ships none, so `server` depends on
`@typescript/typescript6`. Remove it and typegen skips this one file, saying
so; `web` then reports `TS2688` because the file it lists in `types` is gone.

### The other way to wire it

A `types` entry says "this is a global type package", which is what the map is,
and it fails loudly when the file is missing. If you would rather it be quiet
when absent — say, a repo where the map is not always generated — use
`include` instead:

```json
{ "include": ["src", "../server/.kickjs/types/kick__client.d.ts"] }
```

That tolerates the file not existing, at the cost of `KickClientApi` silently
not resolving. Note `types` replaces TypeScript's automatic `@types`
inclusion, so if you add entries there, list the ones you rely on too
(`"types": ["node", "../server/.kickjs/types/kick__client"]`).

Or skip the global entirely — the same file exports the type:

```ts
import type { Api } from '../../server/.kickjs/types/kick__client'

export const api = createClient<Api>({ baseUrl: '/api/v1' })
```

Docs: https://kickjs.app/guide/typed-client.html
