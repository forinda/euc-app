/**
 * The same cases against every SessionRepository implementation, so the
 * in-memory store (dev/tests) and the Redis store (Vercel) can't drift.
 *
 * The Redis run needs an Upstash-compatible REST endpoint and is skipped
 * otherwise. Locally, Redis + hiett/serverless-redis-http emulate Upstash:
 *   TEST_UPSTASH_URL=http://localhost:8079 TEST_UPSTASH_TOKEN=<token> pnpm vitest run
 */
import { randomUUID } from 'node:crypto'
import { describe, it, expect } from 'vitest'
import { Redis } from '@upstash/redis'
import { MAX_DRAFTS } from './session.code'
import type { SessionRepository } from './session.repository'
import { createMemorySessionRepository } from './session.repository.memory'
import { createRedisSessionRepository } from './session.repository.redis'
import type { Change } from './session.types'

const redisUrl = process.env.TEST_UPSTASH_URL
const redisToken = process.env.TEST_UPSTASH_TOKEN

const stores: [string, (() => SessionRepository) | null][] = [
  ['memory', () => createMemorySessionRepository()],
  [
    'redis',
    redisUrl && redisToken
      ? () =>
          createRedisSessionRepository(
            new Redis({ url: redisUrl, token: redisToken, automaticDeserialization: false }),
          )
      : null,
  ],
]

function ok<T>(result: T | string): T {
  if (typeof result === 'string') throw new Error(`expected a result, got '${result}'`)
  return result
}

describe.each(stores)('SessionRepository (%s)', (_name, make) => {
  const test = make ? it : it.skip
  const repo = () => make!()

  test('creates, finds and snapshots a session', async () => {
    const r = repo()
    const s = await r.create({ title: '123', presenterKey: 'k' })
    // A numeric-looking title stays a string.
    expect(await r.find(s.code)).toMatchObject({ code: s.code, title: '123', presenterKey: 'k' })
    expect(await r.snapshot(s.code)).toEqual({
      code: s.code,
      title: '123',
      version: 0,
      question: null,
    })
    expect(await r.find('ZZZZZZ')).toBeNull()
    expect(await r.snapshot('ZZZZZZ')).toBeNull()
    expect(await r.publishQuestion('ZZZZZZ', 'x')).toBe('not-found')
  })

  test('publishing closes the previous question and bumps the version', async () => {
    const r = repo()
    const { code } = await r.create({ title: null, presenterKey: 'k' })
    const first = ok(await r.publishQuestion(code, 'First'))
    const second = ok(await r.publishQuestion(code, 'Second'))
    expect(second.snapshot.question).toMatchObject({
      id: second.question.id,
      text: 'Second',
      status: 'open',
    })
    expect(second.snapshot.version).toBeGreaterThan(first.snapshot.version)
    expect(await r.vote(code, first.question.id, randomUUID(), 'yes')).toBe('closed')
    expect(await r.closeQuestion(code, 'nope')).toBe('not-found')
  })

  test('one vote per voter; re-voting moves the count, not the total', async () => {
    const r = repo()
    const { code } = await r.create({ title: null, presenterKey: 'k' })
    const { question } = ok(await r.publishQuestion(code, 'Q'))
    const [a, b] = [randomUUID(), randomUUID()]
    await r.vote(code, question.id, a, 'yes')
    await r.vote(code, question.id, b, 'no')
    let change = ok(await r.vote(code, question.id, a, 'no'))
    expect(change.question).toMatchObject({ yes: 0, no: 2, total: 2 })
    change = ok(await r.vote(code, question.id, a, 'no')) // same choice again: no change
    expect(change.question).toMatchObject({ yes: 0, no: 2, total: 2 })
    expect(change.snapshot.question).toMatchObject({ id: question.id, total: 2 })

    const closed = ok(await r.closeQuestion(code, question.id))
    expect(closed.question.status).toBe('closed')
    expect(await r.vote(code, question.id, randomUUID(), 'yes')).toBe('closed')
    expect(await r.vote(code, 'nope', randomUUID(), 'yes')).toBe('not-found')
  })

  test('concurrent votes and flip-flopping re-votes keep the tally exact', async () => {
    const r = repo()
    const { code } = await r.create({ title: null, presenterKey: 'k' })
    const { question } = ok(await r.publishQuestion(code, 'Burst'))
    const voters = Array.from({ length: 40 }, () => randomUUID())
    const flipper = randomUUID()
    const results = await Promise.all([
      ...voters.map((v, i) => r.vote(code, question.id, v, i % 4 === 0 ? 'no' : 'yes')),
      // One device changing its mind 20 times at once must still count once.
      ...Array.from({ length: 20 }, (_, i) =>
        r.vote(code, question.id, flipper, i % 2 ? 'yes' : 'no'),
      ),
    ])
    const final = (await r.snapshot(code))?.question
    expect(final?.total).toBe(41)
    expect(final!.yes + final!.no).toBe(41)
    // 10 voters chose "no"; the flipper adds one more if it ended on "no".
    expect([10, 11]).toContain(final?.no)
    // Versions are unique per change, so clients can order out-of-order updates.
    const versions = results.map((x) => (x as Change).snapshot.version)
    expect(new Set(versions).size).toBe(versions.length)
  })

  test('drafts: ordered, capped, published once, deletable', async () => {
    const r = repo()
    const { code } = await r.create({ title: null, presenterKey: 'k' })
    const d1 = ok(await r.addDraft(code, 'One | with a pipe'))
    const d2 = ok(await r.addDraft(code, 'Two'))
    expect((await r.listDrafts(code)).map((d) => d.text)).toEqual(['One | with a pipe', 'Two'])

    const published = ok(await r.publishDraft(code, d1.id))
    expect(published.question).toMatchObject({ text: 'One | with a pipe', status: 'open' })
    expect(await r.publishDraft(code, d1.id)).toBe('not-found')
    expect((await r.listDrafts(code)).map((d) => d.id)).toEqual([d2.id])

    expect(await r.deleteDraft(code, d2.id)).toBe(true)
    expect(await r.deleteDraft(code, d2.id)).toBe(false)
    expect(await r.addDraft('ZZZZZZ', 'x')).toBe('not-found')

    await Promise.all(Array.from({ length: MAX_DRAFTS }, (_, i) => r.addDraft(code, `D${i}`)))
    expect(await r.addDraft(code, 'one too many')).toBe('limit')
  })
})
