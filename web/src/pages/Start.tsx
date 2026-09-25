import { useState, type FormEvent } from 'react'
import { api } from '../api'
import { describeError, presenterKey } from '../session'

export function Start() {
  const [title, setTitle] = useState('')
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

  return (
    <main className="page page--narrow">
      <p>
        <a href="#/">← Join instead</a>
      </p>
      <h1>Start a session</h1>
      <p className="muted">
        You'll get a join code and QR code to put on screen. Prepare questions in advance or publish them as you
        go.
      </p>
      <form onSubmit={start} className="card home__form">
        <input
          aria-label="Session title"
          placeholder="Session title (optional), e.g. Intro to AI · Week 3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          autoFocus
        />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Starting…' : 'Start session'}
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
    </main>
  )
}
