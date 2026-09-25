import { useEffect, useState } from 'react'
import { api } from '../api'
import { describeError, getVoterId, myVote, percent, type Choice } from '../session'
import { useSessionStream } from '../useSessionStream'

const LABEL: Record<Choice, string> = { yes: 'Yes', no: 'No' }

export function Join({ code }: { code: string }) {
  const { snapshot, status } = useSessionStream(code)
  const question = snapshot?.question ?? null
  const [choice, setChoice] = useState<Choice | null>(null)
  const [changing, setChanging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A new question clears the previous answer; a reload restores this one's.
  useEffect(() => {
    setChoice(question ? myVote.get(question.id) : null)
    setChanging(false)
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
      setChanging(false)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const closed = question?.status === 'closed'
  // D4: results only after this device has voted, or once voting closes.
  const showResults = !!question && (closed || (!!choice && !changing))

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

          {showResults ? (
            <div className="choices" aria-live="polite">
              {(['yes', 'no'] as const).map((c) => {
                const pct = percent(question[c], question.total)
                const mine = choice === c
                return (
                  <div
                    key={c}
                    className={`choice choice--${c}${mine ? ' choice--mine' : ''}`}
                    aria-label={`${LABEL[c]}: ${pct}%${mine ? ', your vote' : ''}`}
                  >
                    <div className="choice__fill" style={{ width: `${pct}%` }} />
                    <span className="choice__label">
                      {mine && <span aria-hidden="true">✓ </span>}
                      {LABEL[c]}
                    </span>
                    <span className="choice__pct">{pct}%</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="vote-buttons">
              {(['yes', 'no'] as const).map((c) => (
                <button
                  key={c}
                  className={`vote vote--${c}${choice === c ? ' vote--chosen' : ''}`}
                  onClick={() => vote(c)}
                  disabled={busy || choice === c}
                  aria-pressed={choice === c}
                >
                  {LABEL[c]}
                </button>
              ))}
            </div>
          )}

          <p className="muted join__meta">
            {showResults && `${question.total} ${question.total === 1 ? 'vote' : 'votes'} · `}
            {closed ? (
              'Voting is closed'
            ) : showResults ? (
              <button className="link-btn" onClick={() => setChanging(true)}>
                Change vote
              </button>
            ) : changing ? (
              <button className="link-btn" onClick={() => setChanging(false)}>
                Keep my vote
              </button>
            ) : (
              'Tap to vote'
            )}
          </p>

          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </>
      )}
    </main>
  )
}
