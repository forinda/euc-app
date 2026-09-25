import { useEffect, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { api } from '../api'
import { Results } from '../Results'
import { PRESENTER_KEY_HEADER, chunkCode, describeError, joinUrl, presenterKey } from '../session'
import { useSessionStream } from '../useSessionStream'

export function Present({ code }: { code: string }) {
  const key = presenterKey.get(code)
  const { snapshot, status } = useSessionStream(code, 'presenter')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [projector, setProjector] = useState(false)
  const url = joinUrl(code)

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 360 }).then(setQr, () => setQr(null))
  }, [url])

  useEffect(() => {
    const sync = () => setProjector(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  if (status === 'not-found') {
    return (
      <main className="page page--narrow">
        <h1>Session {code} not found</h1>
        <p className="muted">It may have expired or the server restarted.</p>
        <a href="#/">Start a new session</a>
      </main>
    )
  }
  if (!key) {
    return (
      <main className="page page--narrow">
        <h1>Session {code}</h1>
        <p className="muted">This browser isn't the presenter for this session.</p>
        <a href={`#/join/${code}`}>Join as audience instead</a>
      </main>
    )
  }

  const headers = { [PRESENTER_KEY_HEADER]: key }
  const question = snapshot?.question ?? null

  async function run(op: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await op()
      return true
    } catch (err) {
      setError(describeError(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function publish(e: FormEvent) {
    e.preventDefault()
    const ok = await run(() => api.post('/sessions/:code/questions', { params: { code }, headers, body: { text } }))
    if (ok) setText('')
  }

  const closeVoting = () =>
    question &&
    run(() => api.post('/sessions/:code/questions/:id/close', { params: { code, id: question.id }, headers }))

  const toggleProjector = () =>
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()

  const audience = snapshot?.audience ?? 0
  // People who voted then closed the tab still count, so never show "5 of 3".
  const reach = Math.max(audience, question?.total ?? 0)

  return (
    <main className={projector ? 'present present--projector' : 'present'}>
      <header className="join-banner">
        {qr && <img src={qr} alt={`QR code to join session ${code}`} className="qr" />}
        <p className="join-banner__step">
          Scan the
          <br />
          QR code
        </p>
        <div className="join-banner__divider" aria-hidden="true" />
        <p className="join-banner__step">
          Or visit <strong>{location.host}</strong>
          <br />
          and enter the code <strong className="join-code">{chunkCode(code)}</strong>
        </p>
        <span className={`live-badge${status === 'live' ? ' live-badge--on' : ''}`} title="Audience devices connected">
          <span className="live-badge__dot" aria-hidden="true" />
          {status === 'live' ? 'LIVE' : status.toUpperCase()} ({audience})
        </span>
      </header>

      <section className="stage">
        {snapshot?.title && <p className="stage__title">{snapshot.title}</p>}
        {question ? (
          <>
            <h1 className="stage__question">{question.text}</h1>
            <Results question={question} />
            <p className="stage__meta">
              {reach ? `${question.total} of ${reach} voted` : 'Waiting for votes'}
              {question.status === 'closed' && ' · voting closed'}
            </p>
          </>
        ) : (
          <h1 className="stage__question stage__question--empty">
            {audience ? `${audience} ${audience === 1 ? 'person has' : 'people have'} joined.` : 'Waiting for people to join…'}
            <br />
            <span>Publish a question to start voting.</span>
          </h1>
        )}
      </section>

      <section className="controls">
        <form onSubmit={publish} className="row">
          <input
            aria-label="New question"
            placeholder="Type a statement, e.g. “AI will change how we teach”"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
          />
          <button type="submit" className="btn btn--primary" disabled={busy || !text.trim()}>
            Publish
          </button>
        </form>
        <div className="row">
          <button className="btn" onClick={closeVoting} disabled={busy || question?.status !== 'open'}>
            Close voting
          </button>
          <button className="btn" onClick={toggleProjector}>
            {projector ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
