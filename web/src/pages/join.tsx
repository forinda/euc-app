import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ErrorText } from '../components/error-text'
import { TextLink } from '../components/text-link'
import { useVote } from '../features/sessions/mutations'
import { sessionQueries } from '../features/sessions/queries'
import { percent, type Choice } from '../features/sessions/types'
import { useSessionLive } from '../features/sessions/use-session-live'
import { describeError, isNotFound } from '../lib/errors'
import { myVoteStore } from '../lib/storage'

const TONE: Record<Choice, { label: string; button: string; fill: string; ring: string }> = {
  yes: {
    label: 'Yes',
    button: 'bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400',
    fill: 'bg-emerald-500/30',
    ring: 'border-emerald-500',
  },
  no: {
    label: 'No',
    button: 'bg-red-600 hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400',
    fill: 'bg-red-500/30',
    ring: 'border-red-500',
  },
}

export function Join({ code }: { code: string }) {
  const { status } = useSessionLive(code)
  const session = useQuery(sessionQueries.detail(code))
  const vote = useVote(code)
  const question = session.data?.question ?? null

  const [choice, setChoice] = useState<Choice | null>(null)
  const [changing, setChanging] = useState(false)

  // A new question clears the previous answer; a reload restores this one's.
  useEffect(() => {
    setChoice(question ? myVoteStore.get(question.id) : null)
    setChanging(false)
    vote.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on question change
  }, [question?.id])

  if (status === 'not-found' || isNotFound(session.error)) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-bold">Session {code} not found</h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">Check the code on the screen and try again.</p>
        <TextLink to="/" className="mt-4 inline-block">
          Back
        </TextLink>
      </main>
    )
  }

  const cast = (next: Choice) =>
    question &&
    vote.mutate(
      { questionId: question.id, choice: next },
      {
        onSuccess: () => {
          setChoice(next)
          setChanging(false)
        },
      },
    )

  const closed = question?.status === 'closed'
  // Results only after this device has voted, or once voting closes.
  const showResults = !!question && (closed || (!!choice && !changing))

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <span>
          {session.data?.title ? `${session.data.title} · ` : ''}Session {code}
        </span>
        {/* Polling is normal operation when live updates are off; only flag trouble. */}
        {(status === 'connecting' || status === 'reconnecting') && (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-800">{status}</span>
        )}
      </p>

      {!question ? (
        <h1 className="mt-6 text-2xl font-bold text-zinc-500 dark:text-zinc-400">Waiting for the speaker…</h1>
      ) : (
        <>
          <h1 className="mt-4 mb-6 text-[clamp(1.5rem,6vw,2.2rem)] leading-tight font-bold">{question.text}</h1>

          {showResults ? (
            // After voting the buttons become result cards (Yubo / Numo pattern).
            <div className="grid gap-3" aria-live="polite">
              {(['yes', 'no'] as const).map((c) => {
                const pct = percent(question[c], question.total)
                const mine = choice === c
                return (
                  <div
                    key={c}
                    aria-label={`${TONE[c].label}: ${pct}%${mine ? ', your vote' : ''}`}
                    className={`relative flex items-center justify-between overflow-hidden rounded-2xl border-2 bg-zinc-100 px-5 py-4 text-xl font-extrabold dark:bg-zinc-900 ${
                      mine ? TONE[c].ring : 'border-transparent'
                    }`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 transition-[width] duration-500 motion-reduce:transition-none ${TONE[c].fill}`}
                      style={{ width: `${pct}%` }}
                    />
                    <span className="relative">
                      {mine && <span aria-hidden="true">✓ </span>}
                      {TONE[c].label}
                    </span>
                    <span className="relative tabular-nums">{pct}%</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(['yes', 'no'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => cast(c)}
                  disabled={vote.isPending || choice === c}
                  aria-pressed={choice === c}
                  className={`rounded-2xl border-4 py-7 text-2xl font-extrabold text-white transition disabled:cursor-default ${TONE[c].button} ${
                    choice === c ? 'border-zinc-900 dark:border-white' : 'border-transparent'
                  }`}
                >
                  {TONE[c].label}
                </button>
              ))}
            </div>
          )}

          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            {showResults && `${question.total} ${question.total === 1 ? 'vote' : 'votes'} · `}
            {closed ? (
              'Voting is closed'
            ) : showResults ? (
              <button className="font-medium text-indigo-600 underline dark:text-indigo-400" onClick={() => setChanging(true)}>
                Change vote
              </button>
            ) : changing ? (
              <button className="font-medium text-indigo-600 underline dark:text-indigo-400" onClick={() => setChanging(false)}>
                Keep my vote
              </button>
            ) : (
              'Tap to vote'
            )}
          </p>
          <div className="mt-2">
            <ErrorText>{vote.error && describeError(vote.error)}</ErrorText>
          </div>
        </>
      )}
    </main>
  )
}
