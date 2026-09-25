import { useState, type FormEvent } from 'react'
import { api } from '../api'
import { describeError, presenterKey } from '../session'

export function Home() {
  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const session = await api.post('/sessions', { body: title.trim() ? { title: title.trim() } : {} })
      presenterKey.set(session.code, session.presenterKey)
      location.hash = `#/present/${session.code}`
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }

  function join(e: FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean) location.hash = `#/join/${clean}`
  }

  return (
    <main className="page page--narrow">
      <h1>Live Poll</h1>
      <p className="muted">Ask the room a question and watch the answers come in live.</p>

      <section className="card">
        <h2>Join a session</h2>
        <form onSubmit={join} className="row">
          <input
            aria-label="Session code"
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            className="code-input"
          />
          <button type="submit" className="btn btn--primary" disabled={code.trim().length !== 6}>
            Join
          </button>
        </form>
      </section>

      <section className="card">
        <h2>I'm the speaker</h2>
        <form onSubmit={start} className="row">
          <input
            aria-label="Session title"
            placeholder="Session title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Starting…' : 'Start a session'}
          </button>
        </form>
      </section>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </main>
  )
}
