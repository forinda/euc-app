import { createServer, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '@forinda/kickjs-testing'
// Side-effect import — registers the env schema, exactly as src/index.ts does.
import '@/config'
import { SessionModule } from './session.module'

const BASE = '/api/v1/sessions'

describe('SessionController', () => {
  let server: Server
  let http: ReturnType<typeof request>

  beforeEach(async () => {
    // Default (non-isolated) mode resets the global container per test, giving
    // each test a fresh in-memory store. Don't use `isolated: true` here: the
    // Application it builds still serves requests from the global container,
    // so state leaks between tests (kickjs-testing 8.x).
    const { app } = await createTestApp({ modules: [SessionModule()] })
    server = createServer(app.handle.bind(app))
    await new Promise<void>((resolve) => server.listen(0, resolve))
    http = request(server)
  })

  afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())))

  async function startSession() {
    const res = await http.post(BASE).send({ title: 'Keynote' })
    expect(res.status).toBe(201)
    return res.body as { code: string; title: string; presenterKey: string }
  }

  async function publish(code: string, key: string, text = 'Tabs beat spaces') {
    const res = await http
      .post(`${BASE}/${code}/questions`)
      .set('x-presenter-key', key)
      .send({ text })
    expect(res.status).toBe(201)
    return res.body as { id: string }
  }

  const vote = (code: string, id: string, voterId: string, choice: 'yes' | 'no') =>
    http.put(`${BASE}/${code}/questions/${id}/vote`).send({ voterId, choice })

  it('creates a session with a readable 6-character code', async () => {
    const { code, title, presenterKey } = await startSession()
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
    expect(title).toBe('Keynote')
    expect(presenterKey).toBeTruthy()

    const snapshot = await http.get(`${BASE}/${code.toLowerCase()}`)
    expect(snapshot.body).toEqual({ code, title: 'Keynote', audience: 0, question: null })
  })

  it('counts one vote per device, lets it change, and freezes on close', async () => {
    const { code, presenterKey } = await startSession()
    const { id } = await publish(code, presenterKey)
    const [alice, bob] = [randomUUID(), randomUUID()]

    expect((await vote(code, id, alice, 'yes')).body).toEqual({
      choice: 'yes',
      yes: 1,
      no: 0,
      total: 1,
    })
    expect((await vote(code, id, bob, 'no')).body).toEqual({
      choice: 'no',
      yes: 1,
      no: 1,
      total: 2,
    })
    // Alice changes her mind: the split moves, the total does not.
    expect((await vote(code, id, alice, 'no')).body).toEqual({
      choice: 'no',
      yes: 0,
      no: 2,
      total: 2,
    })

    const closed = await http
      .post(`${BASE}/${code}/questions/${id}/close`)
      .set('x-presenter-key', presenterKey)
    expect(closed.body).toMatchObject({ status: 'closed', yes: 0, no: 2 })
    expect((await vote(code, id, randomUUID(), 'yes')).status).toBe(409)

    // The closed question stays on screen with its final counts.
    const snapshot = await http.get(`${BASE}/${code}`)
    expect(snapshot.body.question).toMatchObject({ id, status: 'closed', total: 2 })
  })

  it('closes the previous question when a new one is published', async () => {
    const { code, presenterKey } = await startSession()
    const first = await publish(code, presenterKey, 'First')
    const second = await publish(code, presenterKey, 'Second')

    expect((await vote(code, first.id, randomUUID(), 'yes')).status).toBe(409)
    expect((await http.get(`${BASE}/${code}`)).body.question).toMatchObject({
      id: second.id,
      status: 'open',
    })
  })

  it('rejects presenter routes without the right key', async () => {
    const { code, presenterKey } = await startSession()
    const other = await startSession()

    const noKey = await http.post(`${BASE}/${code}/questions`).send({ text: 'Hi' })
    expect(noKey.status).toBe(403)
    const wrongKey = await http
      .post(`${BASE}/${code}/questions`)
      .set('x-presenter-key', other.presenterKey)
      .send({ text: 'Hi' })
    expect(wrongKey.status).toBe(403)
    const unknown = await http
      .post(`${BASE}/ZZZZZZ/questions`)
      .set('x-presenter-key', presenterKey)
      .send({ text: 'Hi' })
    expect(unknown.status).toBe(404)
  })

  it('validates input', async () => {
    const { code, presenterKey } = await startSession()
    const blank = await http
      .post(`${BASE}/${code}/questions`)
      .set('x-presenter-key', presenterKey)
      .send({ text: '  ' })
    expect(blank.status).toBe(422)

    const { id } = await publish(code, presenterKey)
    expect((await vote(code, id, 'not-a-uuid', 'yes')).status).toBe(422)
    expect((await vote(code, id, randomUUID(), 'maybe' as 'yes')).status).toBe(422)
    expect((await vote(code, 'nope', randomUUID(), 'yes')).status).toBe(404)
    expect((await http.get(`${BASE}/ZZZZZZ/stream`)).status).toBe(404)
  })
})
