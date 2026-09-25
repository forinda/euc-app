/**
 * Upstash Redis session store: used on Vercel, where each function instance
 * has its own memory, so state must live outside the process.
 *
 * Every change runs as ONE Lua script, so concurrent requests on different
 * instances can't interleave. For example, two re-votes from the same device
 * can't both decrement the old choice. Scripts are sent once and then run by
 * SHA (EVALSHA).
 *
 * Keys (all expire after SESSION_TTL_SECONDS without activity; any change
 * refreshes the session and drafts keys, plus the question it touched):
 *   lp:s:<CODE>          hash  title, presenterKey, createdAt, active, version
 *   lp:s:<CODE>:q:<id>   hash  text, status, createdAt, closedAt, yes, no
 *   lp:s:<CODE>:v:<id>   hash  voterId → choice
 *   lp:s:<CODE>:d        hash  draftId → "<createdAt>|<text>"
 */
import { randomUUID } from 'node:crypto'
import type { Redis } from '@upstash/redis'
import { MAX_DRAFTS, SESSION_TTL_SECONDS, newSessionCode } from './session.code'
import type { SessionRepository } from './session.repository'
import type {
  Change,
  Choice,
  Draft,
  QuestionSnapshot,
  QuestionStatus,
  SessionSnapshot,
} from './session.types'

const prefix = (code: string) => `lp:s:${code}`
const draftsKey = (code: string) => `${prefix(code)}:d`

// Shared by every script. KEYS[1] = session hash, KEYS[2] = drafts hash;
// ARGV[1] = key prefix, ARGV[2] = TTL seconds. Returns 'not-found' early when
// the session doesn't exist (or has expired).
const PRELUDE = `
local S, D, P, TTL = KEYS[1], KEYS[2], ARGV[1], tonumber(ARGV[2])
local function qkey(id) return P .. ':q:' .. id end
local function vkey(id) return P .. ':v:' .. id end

-- {id, text, status, yes, no}, or nil if the question doesn't exist.
local function question(id)
  local q = redis.call('HMGET', qkey(id), 'text', 'status', 'yes', 'no')
  if not q[1] then return nil end
  return {id, q[1], q[2], q[3], q[4]}
end

-- {title, version} followed by the active question's 5 fields, if any.
local function snapshot()
  local s = redis.call('HMGET', S, 'title', 'version', 'active')
  local out = {s[1] or '', s[2] or '0'}
  local active = s[3] or ''
  if active ~= '' then
    local q = question(active)
    if q then for _, v in ipairs(q) do out[#out + 1] = v end end
  end
  return out
end

local function touch(...)
  redis.call('EXPIRE', S, TTL)
  redis.call('EXPIRE', D, TTL)
  for _, k in ipairs({...}) do redis.call('EXPIRE', k, TTL) end
end

-- A public change: bump the version and return the affected question's 5
-- fields followed by the snapshot.
local function change(id, ...)
  redis.call('HINCRBY', S, 'version', 1)
  touch(...)
  local out = question(id)
  for _, v in ipairs(snapshot()) do out[#out + 1] = v end
  return out
end

-- Close the active question (if open) and open a new one.
local function open_question(id, text, now)
  local prev = redis.call('HGET', S, 'active')
  if prev and prev ~= '' and redis.call('HGET', qkey(prev), 'status') == 'open' then
    redis.call('HSET', qkey(prev), 'status', 'closed', 'closedAt', now)
  end
  redis.call('HSET', qkey(id), 'text', text, 'status', 'open', 'createdAt', now, 'yes', 0, 'no', 0)
  redis.call('HSET', S, 'active', id)
  return change(id, qkey(id))
end

if redis.call('EXISTS', S) == 0 then return 'not-found' end
`

const SCRIPTS = {
  snapshot: `${PRELUDE}\nreturn snapshot()`,

  // ARGV[3] = new question id, ARGV[4] = text, ARGV[5] = now
  publish: `${PRELUDE}\nreturn open_question(ARGV[3], ARGV[4], ARGV[5])`,

  // ARGV[3] = draft id, ARGV[4] = new question id, ARGV[5] = now
  publishDraft: `${PRELUDE}
local d = redis.call('HGET', D, ARGV[3])
if not d then return 'not-found' end
redis.call('HDEL', D, ARGV[3])
local sep = string.find(d, '|', 1, true)
return open_question(ARGV[4], string.sub(d, sep + 1), ARGV[5])`,

  // ARGV[3] = question id, ARGV[4] = now
  close: `${PRELUDE}
local status = redis.call('HGET', qkey(ARGV[3]), 'status')
if not status then return 'not-found' end
if status == 'open' then
  redis.call('HSET', qkey(ARGV[3]), 'status', 'closed', 'closedAt', ARGV[4])
end
return change(ARGV[3], qkey(ARGV[3]))`,

  // ARGV[3] = question id, ARGV[4] = voter id, ARGV[5] = 'yes' | 'no'
  vote: `${PRELUDE}
local status = redis.call('HGET', qkey(ARGV[3]), 'status')
if not status then return 'not-found' end
if status ~= 'open' then return 'closed' end
local prev = redis.call('HGET', vkey(ARGV[3]), ARGV[4])
if prev ~= ARGV[5] then
  redis.call('HSET', vkey(ARGV[3]), ARGV[4], ARGV[5])
  if prev then redis.call('HINCRBY', qkey(ARGV[3]), prev, -1) end
  redis.call('HINCRBY', qkey(ARGV[3]), ARGV[5], 1)
end
return change(ARGV[3], qkey(ARGV[3]), vkey(ARGV[3]))`,

  // ARGV[3] = draft id, ARGV[4] = "<createdAt>|<text>", ARGV[5] = max drafts
  addDraft: `${PRELUDE}
if redis.call('HLEN', D) >= tonumber(ARGV[5]) then return 'limit' end
redis.call('HSET', D, ARGV[3], ARGV[4])
touch()
return 'ok'`,

  // ARGV[1] = title ('' for none), ARGV[2] = presenter key, ARGV[3] = now, ARGV[4] = TTL.
  // Runs without the prelude: the session must NOT exist yet.
  create: `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('HSET', KEYS[1], 'title', ARGV[1], 'presenterKey', ARGV[2], 'createdAt', ARGV[3], 'active', '', 'version', 0)
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
return 1`,
}

type Reply = (string | number)[] | string | number

const decodeQuestion = (r: (string | number)[], at: number): QuestionSnapshot => {
  const yes = Number(r[at + 3])
  const no = Number(r[at + 4])
  return {
    id: String(r[at]),
    text: String(r[at + 1]),
    status: String(r[at + 2]) as QuestionStatus,
    yes,
    no,
    total: yes + no,
  }
}

const decodeSnapshot = (code: string, r: (string | number)[], at: number): SessionSnapshot => ({
  code,
  title: String(r[at]) || null,
  version: Number(r[at + 1]),
  question: r.length >= at + 7 ? decodeQuestion(r, at + 2) : null,
})

const decodeChange = (code: string, r: Reply): Change | 'not-found' =>
  Array.isArray(r)
    ? { question: decodeQuestion(r, 0), snapshot: decodeSnapshot(code, r, 5) }
    : 'not-found'

/**
 * `redis` must be created with `automaticDeserialization: false`, so stored
 * strings (titles, question text) come back verbatim instead of being parsed
 * as JSON: a title like "123" would otherwise become a number.
 */
export function createRedisSessionRepository(redis: Redis): SessionRepository {
  const scripts = {
    snapshot: redis.createScript<Reply, true>(SCRIPTS.snapshot, { readonly: true }),
    publish: redis.createScript<Reply>(SCRIPTS.publish),
    publishDraft: redis.createScript<Reply>(SCRIPTS.publishDraft),
    close: redis.createScript<Reply>(SCRIPTS.close),
    vote: redis.createScript<Reply>(SCRIPTS.vote),
    addDraft: redis.createScript<Reply>(SCRIPTS.addDraft),
    create: redis.createScript<number>(SCRIPTS.create),
  }
  const now = () => new Date().toISOString()
  /** The KEYS and leading ARGV every prelude script expects. */
  const run = (script: keyof typeof scripts, code: string, ...args: string[]) =>
    scripts[script].exec(
      [prefix(code), draftsKey(code)],
      [prefix(code), String(SESSION_TTL_SECONDS), ...args],
    ) as Promise<Reply>

  return {
    async create({ title, presenterKey }) {
      const createdAt = now()
      for (;;) {
        const code = newSessionCode()
        const created = await scripts.create.exec(
          [prefix(code)],
          [title ?? '', presenterKey, createdAt, String(SESSION_TTL_SECONDS)],
        )
        if (Number(created) === 1) return { code, title, presenterKey, createdAt }
        // Code already taken: try another.
      }
    },

    async find(code) {
      // With deserialization off, HMGET returns values in field order.
      const [title, presenterKey, createdAt] = (await redis.hmget(
        prefix(code),
        'title',
        'presenterKey',
        'createdAt',
      )) as unknown as (string | null)[]
      if (!presenterKey) return null
      return { code, title: title || null, presenterKey, createdAt: createdAt ?? '' }
    },

    async snapshot(code) {
      const r = await run('snapshot', code)
      return Array.isArray(r) ? decodeSnapshot(code, r, 0) : null
    },

    async publishQuestion(code, text) {
      return decodeChange(code, await run('publish', code, randomUUID(), text, now()))
    },

    async closeQuestion(code, questionId) {
      return decodeChange(code, await run('close', code, questionId, now()))
    },

    async vote(code, questionId, voterId, choice: Choice) {
      const r = await run('vote', code, questionId, voterId, choice)
      return r === 'closed' ? 'closed' : decodeChange(code, r)
    },

    async listDrafts(code) {
      // With deserialization off, HGETALL returns a flat [field, value, ...] list.
      const flat = ((await redis.hgetall(draftsKey(code))) ?? []) as unknown as string[]
      const drafts: Draft[] = []
      for (let i = 0; i < flat.length; i += 2) {
        const value = flat[i + 1]
        const sep = value.indexOf('|')
        drafts.push({ id: flat[i], createdAt: value.slice(0, sep), text: value.slice(sep + 1) })
      }
      // ISO timestamps sort chronologically as strings.
      return drafts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },

    async addDraft(code, text) {
      const draft: Draft = { id: randomUUID(), text, createdAt: now() }
      const r = await run(
        'addDraft',
        code,
        draft.id,
        `${draft.createdAt}|${text}`,
        String(MAX_DRAFTS),
      )
      return r === 'ok' ? draft : (r as 'not-found' | 'limit')
    },

    async deleteDraft(code, draftId) {
      const removed = await redis.hdel(draftsKey(code), draftId)
      if (removed) await redis.expire(prefix(code), SESSION_TTL_SECONDS)
      return removed > 0
    },

    async publishDraft(code, draftId) {
      return decodeChange(code, await run('publishDraft', code, draftId, randomUUID(), now()))
    },
  }
}
