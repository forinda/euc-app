import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../components/button'
import { CODE_LENGTH, CodeInput } from '../components/code-input'
import { ErrorText } from '../components/error-text'
import { sessionQueries } from '../features/sessions/queries'
import { describeError, isNotFound } from '../lib/errors'

/** Join-first: most people opening the app are in the audience. */
export function Home() {
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join(candidate: string) {
    if (candidate.length !== CODE_LENGTH || checking) return
    setChecking(true)
    setError(null)
    try {
      // Checks the code before leaving the page (so a typo is fixed right
      // here) and seeds the cache the join page reads from.
      await qc.fetchQuery(sessionQueries.detail(candidate))
      location.hash = `#/join/${candidate}`
    } catch (err) {
      setError(isNotFound(err) ? 'No session with that code. Check the screen and try again.' : describeError(err))
      setChecking(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    join(code)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[clamp(2rem,12vh,6rem)]">
      <div className="flex-1">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Join a live poll</h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">Enter the code shown on the screen.</p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          {/* Not disabled while checking: disabling drops focus, and after an
              error the next keystrokes would go nowhere. join() ignores repeats. */}
          <CodeInput
            value={code}
            onChange={(next) => {
              setCode(next)
              setError(null)
            }}
            onComplete={join}
            invalid={!!error}
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="primary" size="lg" disabled={code.length !== CODE_LENGTH || checking}>
            {checking ? 'Joining…' : 'Join'}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-zinc-500 dark:text-zinc-400">Don't have a code? Ask the speaker.</p>
      </div>
      <p className="pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-center">
        <a href="#/start" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          I'm the speaker. Start a session →
        </a>
      </p>
    </main>
  )
}
