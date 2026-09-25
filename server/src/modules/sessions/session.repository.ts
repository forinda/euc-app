/**
 * Session repository — in-memory, so sessions vanish on restart (plan D8).
 *
 * Expiry is lazy: an idle session is dropped when next read, and every create
 * sweeps the rest. No timers, so nothing keeps the process or a test alive.
 */
import { randomInt } from 'node:crypto'
import { createToken } from '@forinda/kickjs'
import type { Session } from './session.types'

// No I/L/O/0/1 — codes are read off a projector and typed on phones.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export interface SessionRepositoryOptions {
  ttlMs?: number
  now?: () => number
}

export function createSessionRepository({
  ttlMs = 12 * 60 * 60 * 1000,
  now = Date.now,
}: SessionRepositoryOptions = {}) {
  const store = new Map<string, Session>()
  const isExpired = (s: Session) => now() - s.lastActivityAt > ttlMs

  function newCode() {
    let code: string
    do {
      code = Array.from(
        { length: CODE_LENGTH },
        () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
      ).join('')
    } while (store.has(code))
    return code
  }

  return {
    create(init: Pick<Session, 'title' | 'presenterKey'>): Session {
      for (const [code, s] of store) if (isExpired(s)) store.delete(code)
      const session: Session = {
        ...init,
        code: newCode(),
        questions: new Map(),
        activeQuestionId: null,
        createdAt: new Date(now()).toISOString(),
        lastActivityAt: now(),
      }
      store.set(session.code, session)
      return session
    },

    find(code: string): Session | undefined {
      const session = store.get(code)
      if (session && isExpired(session)) {
        store.delete(code)
        return undefined
      }
      return session
    },

    touch(session: Session) {
      session.lastActivityAt = now()
    },
  }
}

export type SessionRepository = ReturnType<typeof createSessionRepository>

export const SESSION_REPOSITORY = createToken<SessionRepository>('app/Session/repository')
