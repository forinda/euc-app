import { useEffect, useState, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { api } from '../api'
import { Results } from '../Results'
import { PRESENTER_KEY_HEADER, describeError, joinUrl, presenterKey } from '../session'
import { useSessionStream } from '../useSessionStream'

export function Present({ code }: { code: string }) {
  const key = presenterKey.get(code)
  const { snapshot, status } = useSessionStream(code)
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

  return (
    <main className={projector ? 'page present present--projector' : 'page present'}>
      <header className="present__header">
        <div>
          <h1>{snapshot?.title ?? 'Live Poll'}</h1>
          <p className="muted">
            Join at <strong>{url.replace(/^https?:\/\//, '')}</strong>
          </p>
        </div>
        <div className="join-box">
          {qr && <img src={qr} alt={`QR code to join session ${code}`} className="qr" />}
          <div>
            <div className="muted">Code</div>
            <div className="join-code">{code}</div>
          </div>
        </div>
      </header>

      <section className="stage">
        {question ? (
          <>
            <h2 className="stage__question">{question.text}</h2>
            <Results question={question} large />
          </>
        ) : (
          <h2 className="stage__question muted">Publish a question to start voting.</h2>
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
          <span className={`status status--${status}`}>{status}</span>
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
