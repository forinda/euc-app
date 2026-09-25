import { randomUUID } from 'node:crypto'
import { Service, Inject, HttpException } from '@forinda/kickjs'
import { MAX_DRAFTS } from './session.code'
import { SESSION_REPOSITORY, type SessionRepository } from './session.repository'
import { SESSION_EVENTS, type ListenerRole, type SessionEvents } from './session.events'
import type { CreateSessionDTO } from './dtos/create-session.dto'
import type { CreateQuestionDTO } from './dtos/create-question.dto'
import type { VoteDTO } from './dtos/vote.dto'
import type {
  Change,
  Draft,
  QuestionSnapshot,
  SessionSnapshot,
  StoredSession,
} from './session.types'

// TODO(ably step): drop `audience` — the count moves to Ably presence.
type LiveSnapshot = SessionSnapshot & { audience: number }

/** Codes are case-insensitive on the way in; stored upper-case. */
const normalize = (code: string) => code.trim().toUpperCase()

@Service()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly repo: SessionRepository,
    @Inject(SESSION_EVENTS) private readonly events: SessionEvents,
  ) {}

  async create(dto: CreateSessionDTO) {
    const session = await this.repo.create({ title: dto.title || null, presenterKey: randomUUID() })
    // The only response that ever carries the presenter key.
    return { code: session.code, title: session.title, presenterKey: session.presenterKey }
  }

  async getSnapshot(code: string): Promise<LiveSnapshot> {
    const snapshot = await this.repo.snapshot(normalize(code))
    if (!snapshot) throw HttpException.notFound(`Session ${code} not found`)
    return this.live(snapshot)
  }

  /** The session for `code` (case-insensitive), or 404. */
  async requireSession(code: string): Promise<StoredSession> {
    const session = await this.repo.find(normalize(code))
    if (!session) throw HttpException.notFound(`Session ${code} not found`)
    return session
  }

  /** A live socket joined: count it, tell the room, and return its first snapshot. */
  async connect(code: string, socketId: string, role: ListenerRole): Promise<LiveSnapshot> {
    const snapshot = await this.getSnapshot(code)
    this.events.join(snapshot.code, socketId, role)
    this.broadcast(snapshot)
    return this.live(snapshot)
  }

  async disconnect(code: string, socketId: string) {
    this.events.leave(code, socketId)
    const snapshot = await this.repo.snapshot(code)
    if (snapshot) this.broadcast(snapshot)
  }

  // Presenter-only below: callers pass the session the PresenterSession
  // contributor verified.

  async publishQuestion(session: StoredSession, dto: CreateQuestionDTO): Promise<QuestionSnapshot> {
    return this.applied(await this.repo.publishQuestion(session.code, dto.text), 'Session')
  }

  async closeQuestion(session: StoredSession, questionId: string): Promise<QuestionSnapshot> {
    return this.applied(await this.repo.closeQuestion(session.code, questionId), 'Question')
  }

  listDrafts(session: StoredSession): Promise<Draft[]> {
    return this.repo.listDrafts(session.code)
  }

  async addDraft(session: StoredSession, dto: CreateQuestionDTO): Promise<Draft> {
    const draft = await this.repo.addDraft(session.code, dto.text)
    if (draft === 'limit')
      throw HttpException.conflict(`A session can hold at most ${MAX_DRAFTS} prepared questions`)
    if (draft === 'not-found') throw HttpException.notFound(`Session ${session.code} not found`)
    return draft
  }

  async deleteDraft(session: StoredSession, draftId: string) {
    if (!(await this.repo.deleteDraft(session.code, draftId))) {
      throw HttpException.notFound('Prepared question not found')
    }
  }

  /** Publishes a prepared question and removes it from the list. */
  async publishDraft(session: StoredSession, draftId: string): Promise<QuestionSnapshot> {
    return this.applied(await this.repo.publishDraft(session.code, draftId), 'Prepared question')
  }

  async vote(code: string, questionId: string, dto: VoteDTO) {
    const result = await this.repo.vote(normalize(code), questionId, dto.voterId, dto.choice)
    if (result === 'closed') throw HttpException.conflict('Voting on this question is closed')
    const { yes, no, total } = this.applied(result, 'Question')
    return { choice: dto.choice, yes, no, total }
  }

  /** Publish a change to everyone watching, or turn a miss into a 404. */
  private applied(result: Change | 'not-found', missing: string): QuestionSnapshot {
    if (result === 'not-found') throw HttpException.notFound(`${missing} not found`)
    this.broadcast(result.snapshot)
    return result.question
  }

  private broadcast(snapshot: SessionSnapshot) {
    // Built at flush time so the audience count is current.
    this.events.publish(snapshot.code, () => this.live(snapshot))
  }

  private live(snapshot: SessionSnapshot): LiveSnapshot {
    return { ...snapshot, audience: this.events.audienceCount(snapshot.code) }
  }
}
