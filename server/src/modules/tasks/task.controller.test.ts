import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createTestApp } from '@forinda/kickjs-testing'
// Side-effect import — registers the env schema, exactly as src/index.ts does.
import '@/config'
import { TaskModule } from './task.module'

describe('TaskController', () => {
  let http: ReturnType<typeof request>

  beforeEach(async () => {
    // `isolated` boots on Container.create(), so every test gets a fresh
    // in-memory repository.
    const { app } = await createTestApp({ modules: [TaskModule()], isolated: true })
    http = request(app.handle.bind(app))
  })

  it('creates, reads, updates and deletes a task', async () => {
    const created = await http.post('/api/v1/tasks').send({ title: '  Ship it  ' })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ title: 'Ship it' })
    const id = created.body.id

    expect((await http.get(`/api/v1/tasks/${id}`)).body.title).toBe('Ship it')

    const updated = await http.put(`/api/v1/tasks/${id}`).send({ done: true })
    expect(updated.status).toBe(200)
    expect(updated.body).toMatchObject({ title: 'Ship it', done: true })

    expect((await http.delete(`/api/v1/tasks/${id}`)).status).toBe(204)
    expect((await http.get(`/api/v1/tasks/${id}`)).status).toBe(404)
  })

  it('rejects a blank title', async () => {
    const res = await http.post('/api/v1/tasks').send({ title: '   ' })
    expect(res.status).toBe(422)
  })

  it('filters, searches and paginates the list', async () => {
    await http.post('/api/v1/tasks').send({ title: 'Buy milk', done: true })
    await http.post('/api/v1/tasks').send({ title: 'Write report', notes: 'quarterly numbers' })
    await http.post('/api/v1/tasks').send({ title: 'Call plumber' })

    const open = await http.get('/api/v1/tasks').query({ filter: 'done:eq:false' })
    expect(open.body.meta.total).toBe(2)

    const search = await http.get('/api/v1/tasks').query({ q: 'quarterly' })
    expect(search.body.data.map((t: { title: string }) => t.title)).toEqual(['Write report'])

    const page = await http.get('/api/v1/tasks').query({ limit: 2, sort: 'title:asc' })
    expect(page.body.data.map((t: { title: string }) => t.title)).toEqual(['Buy milk', 'Call plumber'])
    expect(page.body.meta).toMatchObject({ total: 3, hasNext: true })
  })
})
