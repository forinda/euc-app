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

Server: http://localhost:3000 · Web: http://localhost:5173 (Vite proxies `/api` and `/socket.io`).

To vote from phones on the same Wi-Fi during development, start the web app
with `pnpm --filter ./web dev --host` and open the printed Network address.

## Deploy

The app is **one long-running Node process**: the KickJS API, Socket.IO for
live updates, and the built React app (served by `SpaAdapter`). It needs an
always-on host (Render, Fly.io, Railway, a VPS). Serverless functions
(Netlify/Vercel) can't run it: they don't support Socket.IO, and sessions
live in memory ([kickjs.app/guide/serverless](https://kickjs.app/guide/serverless.html)).

```bash
docker build -t euc-app .
docker run -p 3000:3000 euc-app      # http://localhost:3000
```

Or without Docker: `pnpm install && pnpm build && CLIENT_DIR=$PWD/web/dist pnpm start`.

| Env | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | Most hosts set this for you. |
| `NODE_ENV` | `development` | `production` in the image. |
| `CLIENT_DIR` | `../web/dist` | Built web app. Relative paths resolve from the working directory, so use an absolute path in production (the image uses `/app/web`). |
| `LOG_LEVEL` | `info` | |

Health check: `GET /api/v1/hello/health` (wired as the image's `HEALTHCHECK`).

**Run one instance.** Sessions and votes are in memory, so a restart ends
live sessions and a second instance wouldn't see the first one's rooms.
Scaling out needs a shared store (e.g. Redis) plus the Socket.IO Redis adapter.
If the host puts a proxy in front, it must allow WebSocket upgrades on
`/socket.io` (the client uses WebSocket transport only, so no sticky sessions
are needed).

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
