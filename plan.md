# Plan — Live "Agree?" polls for lectures & events

## Context

The speaker wants to put a statement or question on the big screen during a talk, have the
audience answer **Yes / No** from their phones, and watch the counts move **live** on the
projector. `euc-app` is a KickJS 8.6 (Express runtime) + React 19 / Vite workspace with a
typed client (`@forinda/kickjs-client`) generated from server handlers. Nothing exists for
this yet. A throwaway `tasks` CRUD module was scaffolded earlier this session only to probe
the stack; this plan removes it.

**Outcome:** the speaker opens a session and gets a short join code. The audience joins
once. Every question the speaker publishes appears on their phones automatically, and the
projector shows Yes/No totals that update in real time.

---

## Decisions to review (defaults chosen — change any of these)

| # | Decision | Default in this plan | Alternative |
|---|---|---|---|
| D1 | Unit of use | **Session (room) with a join code**, multiple questions over time, one active at a time | One standalone link per question (audience re-joins each time) |
| D2 | Answer options | **Yes / No only** | Yes / No / Not sure, or custom options |
| D3 | Changing a vote | **Allowed** while the question is open (one vote per device) | First vote is final |
| D4 | Audience sees results | **After they vote** | Always / only when speaker closes / never |
| D5 | Voter identity | **Anonymous device ID** (random UUID in localStorage) | Name/email sign-in |
| D6 | Speaker auth | **Secret presenter key** returned once when the session is created (kept in the speaker's browser) | Real login |
| D7 | Real-time transport | **Server-Sent Events (SSE)** via `ctx.sse()` + typed `api.stream()` | WebSockets, polling |
| D8 | Storage | **In-memory**. Sessions are lost on server restart; auto-expire after 12 h | SQLite/Postgres (adds a DB module) |
| D9 | QR code on projector | **Yes**, using the `qrcode` package (one small dependency) | Show code + URL as text only |
| D10 | Hosting | **One long-running Node process** (`kick build && kick start`, SPA served by `SpaAdapter`) | Netlify/Vercel. **Won't work as-is**, see Risks |

---

## User flows

**Speaker**
1. Home → **Start a session** (optional title) → lands on the Presenter screen.
2. The Presenter screen shows the join code, join URL and QR code, a "New question" box, and
   big live Yes/No bars.
3. Type a statement → **Publish**. It becomes active, and the previous question closes
   automatically.
4. **Close voting** freezes the counts. **Full-screen** toggle for the projector.

**Audience**
1. Scan the QR code or open the URL and type the 6-character code → Vote screen.
2. See the current question → tap **Yes** or **No** (large touch targets) → "Vote recorded,
   tap to change".
3. When the speaker publishes the next question it replaces the old one on screen, with no
   reload. When no question is active: "Waiting for the speaker…".

---

## Server design (`server/`)

Generate with `kick g module session`. `kick.config.ts` has `pluralize: true`, so this
produces `src/modules/sessions/session.module.ts`, auto-mounted in `src/modules/index.ts`.
Then replace the scaffold's generic CRUD with the following. Keep the generated
repository-factory + `createToken` pattern (see `task.repository.ts` for the shape the
generator emits).

### Data model (in-memory)
```
Session  { code: string(6, A-Z2-9 no look-alikes), title?, presenterKey: uuid,
           activeQuestionId?: string, createdAt, lastActivityAt }
Question { id, sessionCode, text (1–280 chars), status: 'open' | 'closed',
           votes: Map<voterId, 'yes' | 'no'>, createdAt, closedAt? }
```
Counts are derived from the `votes` Map. Re-voting overwrites the entry, so totals stay
correct under D3.

### Files
| File | Role |
|---|---|
| `session.repository.ts` | `createSessionRepository()` (Maps + expiry sweep), `SESSION_REPOSITORY` token `'app/Session/repository'` |
| `session.events.ts` | Small in-process pub/sub: `subscribe(code, fn) → unsubscribe`, `publish(code)`. **Coalesces** broadcasts to at most ~4/s per session so a vote burst from 500 people doesn't fan out 500×500 writes |
| `session.service.ts` | create session, publish/close question, cast vote, build the public snapshot, call `events.publish` after every mutation |
| `session.controller.ts` | routes below; handlers **return** payloads so typegen infers the client types |
| `presenter.guard.ts` | `(ctx, next)` guard (via `kick g guard presenter -m sessions`), compares the `x-presenter-key` header to the session. `ctx.problem.forbidden()` on mismatch |
| `dtos/*.dto.ts` | Zod: `createSession {title?}`, `createQuestion {text}`, `vote {voterId: uuid, choice: 'yes' \| 'no'}` |

### Endpoints (mounted at `/api/v1/sessions`)
| Method & path | Who | Returns |
|---|---|---|
| `POST /` | anyone | `201 { code, title, presenterKey }`. The only time the key is sent |
| `GET /:code` | anyone | public snapshot (below) |
| `POST /:code/questions` | presenter | new active question; closes the previous one |
| `POST /:code/questions/:id/close` | presenter | closed question |
| `PUT /:code/questions/:id/vote` | audience | `{ choice, yes, no }`. `409` if closed, `404` if not active |
| `GET /:code/stream` | anyone | **SSE**: event `snapshot` on connect and on every change; `: ping` comment every 20 s |

**Public snapshot** (one event type keeps the client simple):
`{ code, title, question: { id, text, status, yes, no, total } | null }`.
Under D4 the vote page hides the counts until the device has voted. The hiding is
client-side because the numbers aren't sensitive.

Validation errors come back as 422 problem+json (framework default, confirmed with the
earlier Tasks test).

---

## Web design (`web/`)

No router dependency: a ~20-line hash router in `App.tsx` (`#/`, `#/present/:code`,
`#/join/:code`). Hash routes also work with `SpaAdapter` and static hosting without extra
rewrites.

| File | Role |
|---|---|
| `src/App.tsx` | hash router; drop the Hello demo (keep the `/hello/health` call as a small status dot) |
| `src/pages/Home.tsx` | "Start a session" / "Join with code" |
| `src/pages/Present.tsx` | question composer, publish/close, live bars, join code + QR, full-screen button. Reads `presenterKey` from localStorage (`presenter:<code>`) |
| `src/pages/Join.tsx` | current question, big Yes/No buttons, "change vote", waiting state |
| `src/useSessionStream.ts` | wraps `api.stream('/sessions/:code/stream')` with a **reconnect loop and backoff**. The client's `stream()` is fetch-based and does **not** auto-reconnect (verified in `kickjs-client/dist/index.js`); on reconnect the first `snapshot` resyncs state |
| `src/voter.ts` | `getVoterId()`: UUID in localStorage, generated once |
| `src/api.ts` | add `headers` for the presenter key per call (client supports per-request `headers`) |
| `src/styles.css` | projector-friendly large type, high-contrast bars; mobile-first vote buttons |

All request and response types come from the regenerated
`server/.kickjs/types/kick__client.d.ts`. **Run `kick typegen` after the server changes,
before the web work**: `kick dev` doesn't refresh the client map (README "Keeping the map
fresh").

---

## Cleanup of this session's probe
- Delete `server/src/modules/tasks/` (including `task.controller.test.ts`) and its `.mount(TaskModule())` in `server/src/modules/index.ts`.
- Delete `web/src/Tasks.tsx` and revert its import/usage in `web/src/App.tsx`.
- Delete the stray `web/.kickjs/`, created when `kick typecheck --cwd web` ran typegen inside `web/`.

---

## Execution order
1. Cleanup above.
2. `kick g module session` → repository + events + service + DTOs + controller + guard.
3. Server tests (Vitest + supertest, `createTestApp({ modules: [SessionModule()], isolated: true })`):
   create → publish → vote → re-vote changes the count, not the total → close → vote rejected (409); presenter routes reject a wrong or missing key (403); the SSE route sends `snapshot` on connect and after a vote.
4. `kick typegen` → web: hook, pages, styles.
5. `pnpm typecheck`, `pnpm --filter ./server test`.
6. Browser verification (below).

## Verification
- **Automated:** tests from step 3; `pnpm typecheck` (root) must pass for server + web.
- **Manual with Chrome MCP** against your running dev servers (**web http://localhost:5173**,
  API http://localhost:3000 via the Vite `/api` proxy):
  1. Tab A: start a session → Presenter screen shows code + QR.
  2. Tabs B & C: `#/join/<code>`, and open a *separate profile/incognito* for C so it gets a distinct voter ID.
  3. Publish a statement in A → it appears in B and C without reload.
  4. Vote Yes in B, No in C → A's bars show 1/1 within ~0.5 s; change B to No → 0/2, total still 2.
  5. Close voting in A → B/C buttons disable; a vote attempt shows "voting closed".
  6. Restart `kick dev` → clients reconnect (sessions are gone under D8; the UI says "session not found").
- **Load sanity:** a small script firing 500 votes with distinct voter IDs at one question; the projector keeps up and the final total = 500.

## Risks / notes
- **Netlify/Vercel configs in the repo won't work for this feature.** Serverless functions don't share memory between invocations (D8 state is lost) and cut off long-lived SSE connections. Use a single Node host (Render/Fly/Railway/VPS). Scaling beyond one instance later needs Redis (state + pub/sub).
- **Don't add per-IP rate limiting on votes.** A lecture hall usually shares one Wi-Fi NAT IP, so it would block most of the room. Rely on the per-device vote map instead.
- Behind nginx or another proxy, SSE needs buffering off (`X-Accel-Buffering: no`). The 20 s ping keeps idle proxies from dropping the connection.
- Anonymous device IDs are cheat-able (incognito = new voter). Fine for a show of hands; say if you need stronger guarantees.

---

## Appendix — stack review findings (the feedback you asked for)

**What's good**
- End-to-end types genuinely work: I planted a bad field in `web/`, and `tsc` rejected it against the server's Zod DTO. `pnpm typecheck` at the root fails correctly.
- The generators are solid: `kick g scaffold` produced a working, tested CRUD module in one command; `createTestApp({ isolated: true })` gives clean per-test DI.
- `ctx.sse()` + `api.stream()` are typed through typegen, which is exactly what this feature needs.

**Issues found**
1. **Docs drift.** `.agents/AGENTS.md` describes the type loop as `web/src/types/kick-routes.d.ts` + `createClient<KickApi>` and says it is refreshed under `kick dev`. The real setup is an ambient `KickClientApi` via `web/tsconfig.json` `types`, and it is **not** refreshed by `kick dev` (the README is correct). Agents following AGENTS.md will build the wrong thing.
2. **Conflicting test advice.** The `write-controller-test` skill uses `Container.reset()`, while CLAUDE.md forbids it in favour of `Container.create()`. Resolution: `createTestApp({ isolated: true })`.
3. **Duplicate agent docs.** `server/.agents/` duplicates the root `.agents/` (differs only in project name). Pick one.
4. **Scaffold bugs.** `kick g scaffold` emitted `filterable: ['name']` for an entity with no `name` field, an in-memory `findPaginated` that silently ignores filters/sort/search, an unused `HttpException` import, and an unformatted `modules/index.ts` chain.
5. **Stray artifacts.** `kick typecheck --cwd web` writes a `web/.kickjs/` directory (typegen ran in a non-Kick package).
6. **Thin-entry rule broken by the template itself.** `src/index.ts` inlines `adapters: [SpaAdapter(...)]` instead of `src/adapters/index.ts`. `SpaAdapter({ clientDir: '../web/dist' })` is also relative to the process cwd, so `kick start` from anywhere but `server/` won't find the SPA.
7. **Deploy targets vs. stateful features** (see Risks). The repo is set up for serverless, which fits stateless CRUD but not real-time or in-memory features.
8. **Minor:** there's no git repo yet (worth `git init` before building); `hello.module.ts` lacks the `import.meta.glob` the add-module skill calls mandatory (it works only because the controller imports the service directly).
