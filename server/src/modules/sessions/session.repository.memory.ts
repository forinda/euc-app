/**
 * In-memory session store: the default for local dev and tests.
 *
 * Only correct for a single long-running process. On Vercel each function
 * instance has its own memory, so the Redis store is used there (see
 * session.repository.ts for how one is picked).
 *
 * Expiry is lazy: an idle session is dropped when next read, and every create
 * sweeps the rest. No timers, so nothing keeps the process or a test alive.
 */
import { randomUUID } from 'node:crypto'
import { MAX_DRAFTS, SESSION_TTL_SECONDS, newSessionCode } from './session.code'
import type { SessionRepository } from './session.repository'
import type {
  Change,
  Choice,
  Draft,
  QuestionSnapshot,
  QuestionStatus,
  SessionSnapshot,
  StoredSession,
} from './session.types'

interface MemQuestion {
  id: string
  text: string
  status: QuestionStatus
  /** voterId → choice. Re-voting overwrites, so each device counts once. */
  votes: Map<string, Choice>
  createdAt: string
  closedAt?: string
}

interface MemSession extends StoredSession {
  questions: Map<string, MemQuestion>
  /** Insertion order is the order the presenter added them. */
  drafts: Map<string, Draft>
  activeQuestionId: string | null
  version: number
  lastActivityAt: number
}

export interface MemoryRepositoryOptions {
  ttlSeconds?: number
  now?: () => number
}

export function createMemorySessionRepository({
  ttlSeconds = SESSION_TTL_SECONDS,
  now = Date.now,
}: MemoryRepositoryOptions = {}): SessionRepository {
  const store = new Map<string, MemSession>()
  const isExpired = (s: MemSession) => now() - s.lastActivityAt > ttlSeconds * 1000

  function get(code: string): MemSession | undefined {
    const session = store.get(code)
    if (session && isExpired(session)) {
      store.delete(code)
      return undefined
    }
    return session
  }

  const questionSnapshot = (q: MemQuestion): QuestionSnapshot => {
    let yes = 0
    for (const choice of q.votes.values()) if (choice === 'yes') yes++
    return {
      id: q.id,
      text: q.text,
      status: q.status,
      yes,
      no: q.votes.size - yes,
      total: q.votes.size,
    }
  }

  const snapshotOf = (s: MemSession): SessionSnapshot => {
    const active = s.activeQuestionId ? s.questions.get(s.activeQuestionId) : undefined
    return {
      code: s.code,
      title: s.title,
      version: s.version,
      question: active ? questionSnapshot(active) : null,
    }
  }

  /** Record a public change: bump the version and refresh expiry. */
  const changed = (s: MemSession, q: MemQuestion): Change => {
    s.version++
    s.lastActivityAt = now()
    return { question: questionSnapshot(q), snapshot: snapshotOf(s) }
  }

  function close(q: MemQuestion) {
    if (q.status === 'closed') return
    q.status = 'closed'
    q.closedAt = new Date(now()).toISOString()
  }

  function publish(s: MemSession, text: string): Change {
    const previous = s.activeQuestionId ? s.questions.get(s.activeQuestionId) : undefined
    if (previous) close(previous)
    const question: MemQuestion = {
      id: randomUUID(),
      text,
      status: 'open',
      votes: new Map(),
      createdAt: new Date(now()).toISOString(),
    }
    s.questions.set(question.id, question)
    s.activeQuestionId = question.id
    return changed(s, question)
  }

  return {
    async create(init: { title: string | null; presenterKey: string }): Promise<StoredSession> {
      for (const [code, s] of store) if (isExpired(s)) store.delete(code)
      let code: string
      do code = newSessionCode()
      while (store.has(code))
      const session: MemSession = {
        ...init,
        code,
        createdAt: new Date(now()).toISOString(),
        questions: new Map(),
        drafts: new Map(),
        activeQuestionId: null,
        version: 0,
        lastActivityAt: now(),
      }
      store.set(code, session)
      return {
        code,
        title: session.title,
        presenterKey: session.presenterKey,
        createdAt: session.createdAt,
      }
    },

    async find(code: string): Promise<StoredSession | null> {
      const s = get(code)
      return s
        ? { code: s.code, title: s.title, presenterKey: s.presenterKey, createdAt: s.createdAt }
        : null
    },

    async snapshot(code: string): Promise<SessionSnapshot | null> {
      const s = get(code)
      return s ? snapshotOf(s) : null
    },

    /** Closes the active question (if any) and opens a new one. */
    async publishQuestion(code: string, text: string): Promise<Change | 'not-found'> {
      const s = get(code)
      return s ? publish(s, text) : 'not-found'
    },

    async closeQuestion(code: string, questionId: string): Promise<Change | 'not-found'> {
      const s = get(code)
      const q = s?.questions.get(questionId)
      if (!s || !q) return 'not-found'
      close(q)
      return changed(s, q)
    },

    async vote(
      code: string,
      questionId: string,
      voterId: string,
      choice: Choice,
    ): Promise<Change | 'not-found' | 'closed'> {
      const s = get(code)
      const q = s?.questions.get(questionId)
      if (!s || !q) return 'not-found'
      if (q.status === 'closed') return 'closed'
      q.votes.set(voterId, choice)
      return changed(s, q)
    },

    async listDrafts(code: string): Promise<Draft[]> {
      return [...(get(code)?.drafts.values() ?? [])]
    },

    async addDraft(code: string, text: string): Promise<Draft | 'not-found' | 'limit'> {
      const s = get(code)
      if (!s) return 'not-found'
      if (s.drafts.size >= MAX_DRAFTS) return 'limit'
      const draft: Draft = { id: randomUUID(), text, createdAt: new Date(now()).toISOString() }
      s.drafts.set(draft.id, draft)
      s.lastActivityAt = now()
      return draft
    },

    /** Returns whether the draft existed. */
    async deleteDraft(code: string, draftId: string): Promise<boolean> {
      const s = get(code)
      if (!s?.drafts.delete(draftId)) return false
      s.lastActivityAt = now()
      return true
    },

    /** Publishes a prepared question and removes it from the list, in one step. */
    async publishDraft(code: string, draftId: string): Promise<Change | 'not-found'> {
      const s = get(code)
      const draft = s?.drafts.get(draftId)
      if (!s || !draft) return 'not-found'
      s.drafts.delete(draftId)
      return publish(s, draft.text)
    },
  }
}
