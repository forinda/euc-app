import { useState, type FormEvent } from 'react'
import { KickClientError } from '@forinda/kickjs-client'
import { api } from '../api'
import { CODE_LENGTH, CodeInput } from '../CodeInput'
import { describeError } from '../session'

/** Join-first: most people opening the app are in the audience. */
export function Home() {
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join(candidate: string) {
    if (candidate.length !== CODE_LENGTH || checking) return
    setChecking(true)
    setError(null)
    try {
      // Check before leaving the page so a typo is fixed right here.
      await api.get('/sessions/:code', { params: { code: candidate } })
      location.hash = `#/join/${candidate}`
    } catch (err) {
      setError(
        err instanceof KickClientError && err.status === 404
          ? 'No session with that code. Check the screen and try again.'
          : describeError(err),
      )
      setChecking(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    join(code)
  }

  return (
    <main className="page page--narrow home">
      <div className="home__main">
        <h1>Join a live poll</h1>
        <p className="muted">Enter the code shown on the screen.</p>
        <form onSubmit={submit} className="home__form">
          <CodeInput
            value={code}
            onChange={(next) => {
              setCode(next)
              setError(null)
            }}
            onComplete={join}
            // Not disabled while checking: disabling drops focus, and after an
            // error the next keystrokes would go nowhere. join() ignores repeats.
            invalid={!!error}
          />
          {error && (
            <p role="alert" className="error home__error">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={code.length !== CODE_LENGTH || checking}>
            {checking ? 'Joining…' : 'Join'}
          </button>
        </form>
        <p className="muted home__hint">Don't have a code? Ask the speaker.</p>
      </div>
      <p className="home__speaker">
        <a href="#/start">I'm the speaker. Start a session →</a>
      </p>
    </main>
  )
}
