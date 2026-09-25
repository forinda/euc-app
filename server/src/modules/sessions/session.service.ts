import { randomUUID } from 'node:crypto'
import { Service, Inject, HttpException } from '@forinda/kickjs'
import { MAX_DRAFTS } from './session.code'
import { SESSION_REPOSITORY, type SessionRepository } from './session.repository'
import { SESSION_REALTIME, type RealtimeRole, type SessionRealtime } from './session.realtime'
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

/** Codes are case-insensitive on the way in; stored upper-case. */
const normalize = (code: string) => code.trim().toUpperCase()

@Service()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly repo: SessionRepository,
    @Inject(SESSION_REALTIME) private readonly realtime: SessionRealtime,
  ) {}

  async create(dto: CreateSessionDTO) {
    const session = await this.repo.create({ title: dto.title || null, presenterKey: randomUUID() })
    // The only response that ever carries the presenter key.
    return { code: session.code, title: session.title, presenterKey: session.presenterKey }
  }

  async getSnapshot(code: string): Promise<SessionSnapshot> {
    const snapshot = await this.repo.snapshot(normalize(code))
    if (!snapshot) throw HttpException.notFound(`Session ${code} not found`)
    return snapshot
  }

  /** The session for `code` (case-insensitive), or 404. */
  async requireSession(code: string): Promise<StoredSession> {
    const session = await this.repo.find(normalize(code))
    if (!session) throw HttpException.notFound(`Session ${code} not found`)
    return session
  }

  /**
   * A signed grant for one browser to follow the session live. 503 when no
   * realtime service is configured, which tells the client to poll instead.
   */
  async realtimeToken(code: string, role: RealtimeRole, deviceId: string) {
    const session = await this.requireSession(code)
    if (!this.realtime.enabled) throw new HttpException(503, 'Live updates are not configured')
    return this.realtime.createTokenRequest(session.code, role, deviceId)
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
    const { yes, no, total } = await this.applied(result, 'Question')
    return { choice: dto.choice, yes, no, total }
  }

  /** Publish a change to everyone watching, or turn a miss into a 404. */
  private async applied(result: Change | 'not-found', missing: string): Promise<QuestionSnapshot> {
    if (result === 'not-found') throw HttpException.notFound(`${missing} not found`)
    // Awaited so a serverless function doesn't return (and freeze) mid-publish.
    // Never throws: delivery is best-effort (see session.realtime.ts).
    await this.realtime.publish(result.snapshot)
    return result.question
  }
}
