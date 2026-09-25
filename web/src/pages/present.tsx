import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { Button } from '../components/button'
import { ErrorText } from '../components/error-text'
import { TextInput } from '../components/text-input'
import { Results } from '../features/sessions/components/results'
import {
  useAddDraft,
  useCloseQuestion,
  useDeleteDraft,
  usePublishDraft,
  usePublishQuestion,
} from '../features/sessions/mutations'
import { sessionQueries } from '../features/sessions/queries'
import { chunkCode, joinUrl } from '../features/sessions/types'
import { useSessionSocket } from '../features/sessions/use-session-socket'
import { describeError, isNotFound } from '../lib/errors'
import { presenterKeyStore } from '../lib/storage'

function Message({ title, body, link }: { title: string; body: string; link: { href: string; label: string } }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">{body}</p>
      <a href={link.href} className="mt-4 inline-block font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        {link.label}
      </a>
    </main>
  )
}

export function Present({ code }: { code: string }) {
  const isPresenter = !!presenterKeyStore.get(code)
  const status = useSessionSocket(code, 'presenter')
  const session = useQuery(sessionQueries.detail(code))
  const drafts = useQuery(sessionQueries.drafts(code))

  const publishQuestion = usePublishQuestion(code)
  const closeQuestion = useCloseQuestion(code)
  const addDraft = useAddDraft(code)
  const deleteDraft = useDeleteDraft(code)
  const publishDraft = usePublishDraft(code)
  const mutations = [publishQuestion, closeQuestion, addDraft, deleteDraft, publishDraft]
  const busy = mutations.some((m) => m.isPending)
  const mutationError = mutations.find((m) => m.error)?.error

  const [text, setText] = useState('')
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

  if (status === 'not-found' || isNotFound(session.error)) {
    return (
      <Message
        title={`Session ${code} not found`}
        body="It may have expired or the server restarted."
        link={{ href: '#/start', label: 'Start a new session' }}
      />
    )
  }
  if (!isPresenter) {
    return (
      <Message
        title={`Session ${code}`}
        body="This browser isn't the presenter for this session."
        link={{ href: `#/join/${code}`, label: 'Join as audience instead' }}
      />
    )
  }

  const snapshot = session.data
  const question = snapshot?.question ?? null
  const audience = snapshot?.audience ?? 0
  // People who voted then closed the tab still count, so never show "5 of 3".
  const reach = Math.max(audience, question?.total ?? 0)
  const live = status === 'live'

  const clearOnSuccess = { onSuccess: () => setText('') }
  const publishNow = (e: FormEvent) => {
    e.preventDefault()
    publishQuestion.mutate(text, clearOnSuccess)
  }

  const toggleProjector = () =>
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()

  return (
    // `.dark` forces the projector palette regardless of the system theme.
    <main className="dark flex min-h-dvh flex-col bg-zinc-950 text-zinc-100">
      {/* Join banner (Canva Live pattern) */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-zinc-800 px-[clamp(1rem,4vw,3rem)] py-4">
        {qr && (
          <img
            src={qr}
            alt={`QR code to join session ${code}`}
            className={`rounded-lg bg-white p-1 ${projector ? 'size-40' : 'size-26'}`}
          />
        )}
        <p className="text-[clamp(1rem,1.8vw,1.35rem)] leading-snug text-zinc-400">
          Scan the
          <br />
          QR code
        </p>
        <div className="hidden self-stretch border-l border-zinc-800 sm:block" aria-hidden="true" />
        <p className="text-[clamp(1rem,1.8vw,1.35rem)] leading-snug text-zinc-400">
          Or visit <strong className="text-zinc-100">{location.host}</strong>
          <br />
          and enter the code{' '}
          <strong className="text-[1.35em] tracking-wider text-zinc-100 tabular-nums">{chunkCode(code)}</strong>
        </p>
        <span
          title="Audience devices connected"
          className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold tracking-wide ${
            live ? 'border-red-900 bg-red-950/60 text-red-400' : 'border-zinc-800 text-zinc-400'
          }`}
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${live ? 'bg-red-400 motion-safe:animate-pulse' : 'bg-zinc-500'}`}
          />
          {live ? 'LIVE' : status.toUpperCase()} ({audience})
        </span>
      </header>

      {/* Stage */}
      <section className="flex flex-1 flex-col justify-center px-[clamp(1rem,6vw,6rem)] py-[clamp(1.5rem,5vh,3.5rem)]">
        {snapshot?.title && <p className="mb-3 text-lg text-zinc-400">{snapshot.title}</p>}
        {question ? (
          <>
            <h1 className="mb-[clamp(1.5rem,5vh,3rem)] text-[clamp(2rem,5vw,4.2rem)] leading-tight font-bold">
              {question.text}
            </h1>
            <Results question={question} />
            <p className="mt-5 text-[clamp(1rem,2vw,1.5rem)] text-zinc-400 tabular-nums">
              {reach ? `${question.total} of ${reach} voted` : 'Waiting for votes'}
              {question.status === 'closed' && ' · voting closed'}
            </p>
          </>
        ) : (
          <h1 className="text-[clamp(2rem,5vw,4.2rem)] leading-tight font-bold text-zinc-400">
            {audience
              ? `${audience} ${audience === 1 ? 'person has' : 'people have'} joined.`
              : 'Waiting for people to join…'}
            <br />
            <span className="text-[0.5em] font-medium">Publish a question to start voting.</span>
          </h1>
        )}
      </section>

      {/* Presenter controls — hidden in full-screen projector mode */}
      {!projector && (
        <section className="grid gap-3 border-t border-zinc-800 bg-zinc-900 px-[clamp(1rem,4vw,3rem)] py-4">
          <form onSubmit={publishNow} className="flex flex-wrap gap-2">
            <TextInput
              aria-label="New question"
              placeholder="Type a statement, e.g. “AI will change how we teach”"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={280}
              className="flex-[1_1_16rem]"
            />
            <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
              Publish now
            </Button>
            <Button type="button" onClick={() => addDraft.mutate(text, clearOnSuccess)} disabled={busy || !text.trim()}>
              Save for later
            </Button>
          </form>

          {!!drafts.data?.length && (
            <div>
              <h2 className="mb-2 text-xs font-semibold tracking-widest text-zinc-400 uppercase">
                Up next ({drafts.data.length})
              </h2>
              <ol className="grid max-h-56 gap-1.5 overflow-y-auto">
                {drafts.data.map((draft) => (
                  <li
                    key={draft.id}
                    className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 py-2 pr-2 pl-3"
                  >
                    <span className="min-w-0 flex-1">{draft.text}</span>
                    <Button variant="primary" size="sm" onClick={() => publishDraft.mutate(draft.id)} disabled={busy}>
                      Publish
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDraft.mutate(draft.id)}
                      disabled={busy}
                      aria-label={`Remove "${draft.text}"`}
                    >
                      ✕
                    </Button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => question && closeQuestion.mutate(question.id)} disabled={busy || question?.status !== 'open'}>
              Close voting
            </Button>
            <Button onClick={toggleProjector}>Full screen</Button>
          </div>
          <ErrorText>{mutationError && describeError(mutationError)}</ErrorText>
        </section>
      )}
    </main>
  )
}
