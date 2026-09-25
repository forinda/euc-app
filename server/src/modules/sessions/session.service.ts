import { randomUUID } from 'node:crypto'
import { Service, Inject, HttpException } from '@forinda/kickjs'
import { SESSION_REPOSITORY, type SessionRepository } from './session.repository'
import { SESSION_EVENTS, type ListenerRole, type SessionEvents } from './session.events'
import type { CreateSessionDTO } from './dtos/create-session.dto'
import type { CreateQuestionDTO } from './dtos/create-question.dto'
import type { VoteDTO } from './dtos/vote.dto'
import type { Question, QuestionSnapshot, Session, SessionSnapshot } from './session.types'

@Service()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly repo: SessionRepository,
    @Inject(SESSION_EVENTS) private readonly events: SessionEvents,
  ) {}

  create(dto: CreateSessionDTO) {
    const session = this.repo.create({ title: dto.title || null, presenterKey: randomUUID() })
    // The only response that ever carries the presenter key.
    return { code: session.code, title: session.title, presenterKey: session.presenterKey }
  }

  getSnapshot(code: string): SessionSnapshot {
    return this.toSnapshot(this.requireSession(code))
  }

  /** Joins and leaves change the audience count, so both broadcast a snapshot. */
  subscribe(code: string, fn: (snapshot: SessionSnapshot) => void, role: ListenerRole) {
    const session = this.requireSession(code)
    const unsubscribe = this.events.subscribe(session.code, fn, role)
    this.broadcast(session)
    return () => {
      unsubscribe()
      this.broadcast(session)
    }
  }

  // Presenter-only: callers pass the session the PresenterSession contributor verified.
  publishQuestion(session: Session, dto: CreateQuestionDTO): QuestionSnapshot {
    const previous = session.activeQuestionId && session.questions.get(session.activeQuestionId)
    if (previous) close(previous)

    const question: Question = {
      id: randomUUID(),
      text: dto.text,
      status: 'open',
      votes: new Map(),
      createdAt: new Date().toISOString(),
    }
    session.questions.set(question.id, question)
    session.activeQuestionId = question.id
    this.changed(session)
    return toQuestionSnapshot(question)
  }

  closeQuestion(session: Session, questionId: string): QuestionSnapshot {
    const question = this.requireQuestion(session, questionId)
    close(question)
    this.changed(session)
    return toQuestionSnapshot(question)
  }

  vote(code: string, questionId: string, dto: VoteDTO) {
    const session = this.requireSession(code)
    const question = this.requireQuestion(session, questionId)
    if (question.status === 'closed')
      throw HttpException.conflict('Voting on this question is closed')
    question.votes.set(dto.voterId, dto.choice)
    this.changed(session)
    const { yes, no, total } = toQuestionSnapshot(question)
    return { choice: dto.choice, yes, no, total }
  }

  /** The session for `code` (case-insensitive), or 404. */
  requireSession(code: string): Session {
    const session = this.repo.find(code.toUpperCase())
    if (!session) throw HttpException.notFound(`Session ${code} not found`)
    return session
  }

  private requireQuestion(session: Session, questionId: string): Question {
    const question = session.questions.get(questionId)
    if (!question) throw HttpException.notFound('Question not found')
    return question
  }

  private changed(session: Session) {
    this.repo.touch(session)
    this.broadcast(session)
  }

  private broadcast(session: Session) {
    this.events.publish(
      session.code,
      () => this.repo.find(session.code) && this.toSnapshot(session),
    )
  }

  private toSnapshot(session: Session): SessionSnapshot {
    const active = session.activeQuestionId
      ? session.questions.get(session.activeQuestionId)
      : undefined
    return {
      code: session.code,
      title: session.title,
      audience: this.events.audienceCount(session.code),
      question: active ? toQuestionSnapshot(active) : null,
    }
  }
}

function close(question: Question) {
  if (question.status === 'closed') return
  question.status = 'closed'
  question.closedAt = new Date().toISOString()
}

function toQuestionSnapshot(q: Question): QuestionSnapshot {
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
