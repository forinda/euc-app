/**
 * Presence + coalesced broadcasts for live sessions, delivered over Socket.IO.
 *
 * Each session is a room (named by its code) in the `/sessions` namespace.
 * Broadcasts are coalesced per session: a burst of votes schedules one flush
 * `intervalMs` later, which builds the snapshot once and emits it to the
 * room. A room of 500 voting at once costs a few emits, not 500 × 500.
 *
 * Single-process only — scaling past one instance needs the Socket.IO Redis
 * adapter (see SocketIoAdapter's `adapter` option).
 */
import { createToken } from '@forinda/kickjs'
import type { SessionSnapshot } from './session.types'

export const SESSIONS_NAMESPACE = '/sessions'
export type ListenerRole = 'audience' | 'presenter'
type Emit = (code: string, snapshot: SessionSnapshot) => void

export function createSessionEvents({
  emit,
  intervalMs = 250,
}: {
  emit: Emit
  intervalMs?: number
}) {
  // code → socket id → role, so the presenter's own screens don't count as audience.
  const presence = new Map<string, Map<string, ListenerRole>>()
  const pending = new Map<string, () => SessionSnapshot | undefined>()

  function flush(code: string) {
    const build = pending.get(code)
    pending.delete(code)
    const snapshot = build?.()
    if (snapshot) emit(code, snapshot)
  }

  return {
    join(code: string, socketId: string, role: ListenerRole) {
      let sockets = presence.get(code)
      if (!sockets) presence.set(code, (sockets = new Map()))
      sockets.set(socketId, role)
    },

    leave(code: string, socketId: string) {
      const sockets = presence.get(code)
      sockets?.delete(socketId)
      if (sockets && !sockets.size) presence.delete(code)
    },

    /** Connected audience devices (sockets not marked as presenter). */
    audienceCount(code: string) {
      let n = 0
      for (const role of presence.get(code)?.values() ?? []) if (role === 'audience') n++
      return n
    },

    /** Schedule a broadcast; `build` runs once at flush time, so it sees the latest state. */
    publish(code: string, build: () => SessionSnapshot | undefined) {
      if (!presence.has(code)) return
      const scheduled = pending.has(code)
      pending.set(code, build)
      if (!scheduled) setTimeout(() => flush(code), intervalMs)
    },
  }
}

export type SessionEvents = ReturnType<typeof createSessionEvents>

export const SESSION_EVENTS = createToken<SessionEvents>('app/Session/events')
