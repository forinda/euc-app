import { useState, type FormEvent } from 'react'
import { Button } from '../components/button'
import { ErrorText } from '../components/error-text'
import { TextInput } from '../components/text-input'
import { useCreateSession } from '../features/sessions/mutations'
import { describeError } from '../lib/errors'

export function Start() {
  const [title, setTitle] = useState('')
  const createSession = useCreateSession()

  const start = (e: FormEvent) => {
    e.preventDefault()
    createSession.mutate(title, {
      onSuccess: (session) => {
        location.hash = `#/present/${session.code}`
      },
    })
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <a href="#/" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        ← Join instead
      </a>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Start a session</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        You'll get a join code and QR code to put on screen. Prepare questions in advance or publish them as you go.
      </p>
      <form
        onSubmit={start}
        className="mt-6 grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <TextInput
          aria-label="Session title"
          placeholder="Session title (optional), e.g. Intro to AI · Week 3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          autoFocus
        />
        <Button type="submit" variant="primary" size="lg" disabled={createSession.isPending}>
          {createSession.isPending ? 'Starting…' : 'Start session'}
        </Button>
        <ErrorText>{createSession.error && describeError(createSession.error)}</ErrorText>
      </form>
    </main>
  )
}
