/**
 * In-process pub/sub for live session updates.
 *
 * Broadcasts are coalesced per session: a burst of votes schedules one flush
 * `intervalMs` later, which builds the snapshot once and fans it out. A room
 * of 500 voting at once costs a few flushes, not 500 × 500 writes.
 *
 * Single-process only — scaling past one instance needs Redis pub/sub here.
 */
import { createToken } from '@forinda/kickjs'
import type { SessionSnapshot } from './session.types'

type Listener = (snapshot: SessionSnapshot) => void

export function createSessionEvents({ intervalMs = 250 }: { intervalMs?: number } = {}) {
  const listeners = new Map<string, Set<Listener>>()
  const pending = new Map<string, () => SessionSnapshot | undefined>()

  function flush(code: string) {
    const build = pending.get(code)
    pending.delete(code)
    const snapshot = build?.()
    if (!snapshot) return
    for (const fn of listeners.get(code) ?? []) fn(snapshot)
  }

  return {
    subscribe(code: string, fn: Listener): () => void {
      let set = listeners.get(code)
      if (!set) listeners.set(code, (set = new Set()))
      set.add(fn)
      return () => {
        set.delete(fn)
        if (!set.size) listeners.delete(code)
      }
    },

    /** Schedule a broadcast; `build` runs once at flush time, so it sees the latest state. */
    publish(code: string, build: () => SessionSnapshot | undefined) {
      if (!listeners.has(code)) return
      const scheduled = pending.has(code)
      pending.set(code, build)
      if (!scheduled) setTimeout(() => flush(code), intervalMs)
    },
  }
}

export type SessionEvents = ReturnType<typeof createSessionEvents>

export const SESSION_EVENTS = createToken<SessionEvents>('app/Session/events')
