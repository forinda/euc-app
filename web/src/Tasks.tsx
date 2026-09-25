import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { KickClientError } from '@forinda/kickjs-client'
import { api } from './api'

// Inferred from TaskController.list's return type via the generated client map.
type TaskPage = Awaited<ReturnType<typeof fetchTasks>>
type Task = TaskPage['data'][number]
type Filter = 'all' | 'open' | 'done'

const FILTERS: Record<Filter, string | undefined> = {
  all: undefined,
  open: 'done:eq:false',
  done: 'done:eq:true',
}

function fetchTasks(filter: Filter, q: string) {
  const f = FILTERS[filter]
  return api.get('/tasks', { query: { limit: '50', ...(f && { filter: f }), ...(q && { q }) } })
}

function describeError(err: unknown) {
  if (err instanceof KickClientError) {
    const body = err.body as { detail?: string; message?: string } | undefined
    return body?.detail ?? body?.message ?? `Request failed (${err.status})`
  }
  return 'Network error — is the server running?'
}

export function Tasks() {
  const [page, setPage] = useState<TaskPage | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchTasks(filter, search.trim())
      .then((p) => {
        setPage(p)
        setError(null)
      })
      .catch((err) => setError(describeError(err)))
  }, [filter, search])

  useEffect(load, [load])

  // Each mutation refetches so the list honours the active filter and search.
  const run = (op: () => Promise<unknown>) =>
    op()
      .then(load)
      .catch((err) => setError(describeError(err)))

  const add = (e: FormEvent) => {
    e.preventDefault()
    run(() => api.post('/tasks', { body: { title } }).then(() => setTitle('')))
  }
  const toggle = (task: Task) =>
    run(() => api.put('/tasks/:id', { params: { id: task.id }, body: { done: !task.done } }))
  const remove = (task: Task) => run(() => api.delete('/tasks/:id', { params: { id: task.id } }))

  return (
    <section>
      <h2>Tasks</h2>
      <form onSubmit={add} style={{ display: 'flex', gap: 8 }}>
        <input
          aria-label="New task title"
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, padding: 6 }}
        />
        <button type="submit">Add</button>
      </form>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} disabled={filter === f}>
            {f}
          </button>
        ))}
        <input
          aria-label="Search tasks"
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: 4 }}
        />
      </div>

      {error && (
        <p role="alert" style={{ color: '#b00020' }}>
          {error}
        </p>
      )}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {page?.data.map((task) => (
          <li key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <input
              type="checkbox"
              checked={!!task.done}
              onChange={() => toggle(task)}
              aria-label={`Mark "${task.title}" ${task.done ? 'open' : 'done'}`}
            />
            <span style={{ flex: 1, textDecoration: task.done ? 'line-through' : undefined }}>{task.title}</span>
            <button onClick={() => remove(task)} aria-label={`Delete "${task.title}"`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <p style={{ color: '#666' }}>{page ? `${page.meta.total} task(s)` : 'loading…'}</p>
    </section>
  )
}
