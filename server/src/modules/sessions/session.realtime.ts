/**
 * Live session updates, behind our own interface.
 *
 * Implementations: Ably (session.realtime.ably.ts) when ABLY_API_KEY is set,
 * otherwise `disabledRealtime`, where clients fall back to polling.
 * `SessionInfraAdapter` picks one and binds it to SESSION_REALTIME.
 *
 * Delivery is best-effort: a failed publish must never fail the vote or
 * question that caused it. Clients recover on their own: every snapshot
 * carries a `version`, they refetch after a missed stretch, and the snapshot
 * is always readable over HTTP.
 */
import { createToken } from '@forinda/kickjs'
import type { SessionSnapshot } from './session.types'

export type RealtimeRole = 'audience' | 'presenter'

/** A signed, short-lived grant a browser exchanges for a realtime connection. */
export interface RealtimeTokenRequest {
  keyName: string
  clientId?: string
  capability: string
  timestamp: number
  nonce: string
  mac: string
  ttl?: number
}

export interface SessionRealtime {
  /** False when no realtime service is configured: clients poll instead. */
  readonly enabled: boolean
  /** Push the snapshot to everyone watching the session. Never throws. */
  publish(snapshot: SessionSnapshot): Promise<void>
  /**
   * A token request letting one browser subscribe to the session's channel
   * and join its presence (for the audience count). Browsers can never publish.
   */
  createTokenRequest(
    code: string,
    role: RealtimeRole,
    deviceId: string,
  ): Promise<RealtimeTokenRequest>
}

export const SESSION_REALTIME = createToken<SessionRealtime>('app/Session/realtime')

/** The channel a session's updates and presence live on. */
export const sessionChannel = (code: string) => `session:${code}`

/**
 * Presenter screens connect with this clientId prefix and never enter
 * presence. The audience count ignores them either way.
 */
export const PRESENTER_CLIENT_PREFIX = 'presenter:'

export const disabledRealtime: SessionRealtime = {
  enabled: false,
  async publish() {},
  async createTokenRequest() {
    throw new Error('Realtime is not configured')
  },
}
