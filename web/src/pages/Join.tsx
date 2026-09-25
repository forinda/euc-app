import { useEffect, useState } from 'react'
import { api } from '../api'
import { Results } from '../Results'
import { describeError, getVoterId, myVote, type Choice } from '../session'
import { useSessionStream } from '../useSessionStream'

export function Join({ code }: { code: string }) {
  const { snapshot, status } = useSessionStream(code)
  const question = snapshot?.question ?? null
  const [choice, setChoice] = useState<Choice | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A new question clears the previous answer; a reload restores this one's.
  useEffect(() => {
    setChoice(question ? myVote.get(question.id) : null)
    setError(null)
  }, [question?.id])

  if (status === 'not-found') {
    return (
      <main className="page page--narrow">
        <h1>Session {code} not found</h1>
        <p className="muted">Check the code on the screen and try again.</p>
        <a href="#/">Back</a>
      </main>
    )
  }

  async function vote(next: Choice) {
    if (!question) return
    setBusy(true)
    setError(null)
    try {
      await api.put('/sessions/:code/questions/:id/vote', {
        params: { code, id: question.id },
        body: { voterId: getVoterId(), choice: next },
      })
      myVote.set(question.id, next)
      setChoice(next)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const closed = question?.status === 'closed'

  return (
    <main className="page page--narrow join">
      <p className="muted">
        {snapshot?.title ? `${snapshot.title} · ` : ''}Session {code}
        {status !== 'live' && <span className={`status status--${status}`}>{status}</span>}
      </p>

      {!question ? (
        <h1 className="muted">Waiting for the speaker…</h1>
      ) : (
        <>
          <h1 className="join__question">{question.text}</h1>
          <div className="vote-buttons">
            {(['yes', 'no'] as const).map((c) => (
              <button
                key={c}
                className={`vote vote--${c}${choice === c ? ' vote--chosen' : ''}`}
                onClick={() => vote(c)}
                disabled={busy || closed || choice === c}
                aria-pressed={choice === c}
              >
                {c === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
          {closed ? (
            <p className="muted">Voting is closed.</p>
          ) : (
            choice && <p className="muted">Vote recorded. Tap the other option to change it.</p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {/* D4: results only after this device has voted, or once voting closes. */}
          {(choice || closed) && <Results question={question} />}
        </>
      )}
    </main>
  )
}
