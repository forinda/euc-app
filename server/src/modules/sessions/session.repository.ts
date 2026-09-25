/**
 * Session storage, behind our own interface.
 *
 * Two implementations: in-memory (session.repository.memory.ts), for local dev
 * and tests, and Upstash Redis, for Vercel, where each function instance has
 * its own memory. `SessionInfraAdapter` (src/adapters) picks one from env and
 * binds it to SESSION_REPOSITORY. Nothing else knows which store is running.
 *
 * Every change to public state returns a `Change`: the affected question and
 * the resulting snapshot. The service can publish that without reading the
 * store again.
 */
import { createToken } from '@forinda/kickjs'
import type { Change, Choice, Draft, SessionSnapshot, StoredSession } from './session.types'

export interface SessionRepository {
  create(init: { title: string | null; presenterKey: string }): Promise<StoredSession>
  find(code: string): Promise<StoredSession | null>
  snapshot(code: string): Promise<SessionSnapshot | null>

  /** Closes the active question (if any) and opens a new one. */
  publishQuestion(code: string, text: string): Promise<Change | 'not-found'>
  closeQuestion(code: string, questionId: string): Promise<Change | 'not-found'>
  /** One vote per voter; voting again replaces the earlier choice. */
  vote(
    code: string,
    questionId: string,
    voterId: string,
    choice: Choice,
  ): Promise<Change | 'not-found' | 'closed'>

  /** Prepared questions, oldest first. Presenter-only; never in the snapshot. */
  listDrafts(code: string): Promise<Draft[]>
  addDraft(code: string, text: string): Promise<Draft | 'not-found' | 'limit'>
  /** Returns whether the draft existed. */
  deleteDraft(code: string, draftId: string): Promise<boolean>
  /** Publishes a prepared question and removes it from the list, in one step. */
  publishDraft(code: string, draftId: string): Promise<Change | 'not-found'>
}

export const SESSION_REPOSITORY = createToken<SessionRepository>('app/Session/repository')
