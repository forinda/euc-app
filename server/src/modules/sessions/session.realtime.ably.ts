/**
 * SessionRealtime over Ably. The server publishes over Ably's REST API (no
 * connection to hold, so it works in serverless functions), and browsers
 * connect with token requests signed here: the API key never leaves the server.
 */
import * as Ably from 'ably'
import { Logger } from '@forinda/kickjs'
import {
  PRESENTER_CLIENT_PREFIX,
  sessionChannel,
  type RealtimeTokenRequest,
  type SessionRealtime,
} from './session.realtime'

const log = Logger.for('AblyRealtime')

/** How long a browser's token lasts before Ably asks our API for a fresh one. */
const TOKEN_TTL_MS = 60 * 60 * 1000

export function createAblyRealtime(apiKey: string): SessionRealtime {
  const rest = new Ably.Rest({
    key: apiKey,
    // Publishing is awaited inside the request, so an Ably outage must not
    // hold a vote hostage: the defaults (10 s per request plus 15 s of
    // fallback-host retries) are cut to about 3 s in the worst case. Delivery is
    // best-effort anyway (see session.realtime.ts).
    httpRequestTimeout: 2000,
    httpMaxRetryDuration: 3000,
  })

  return {
    enabled: true,

    async publish(snapshot) {
      try {
        // Awaited by the caller: in a serverless function, work left running
        // after the response may be frozen before it finishes.
        await rest.channels.get(sessionChannel(snapshot.code)).publish('snapshot', snapshot)
      } catch (error) {
        // Best-effort: clients catch up via `version` / refetch (see session.realtime.ts).
        log.warn(
          `Publishing to ${sessionChannel(snapshot.code)} failed: ${(error as Error).message}`,
        )
      }
    },

    async createTokenRequest(code, role, deviceId): Promise<RealtimeTokenRequest> {
      // Subscribe + presence on this session's channel only. No publish.
      const capability = JSON.stringify({ [sessionChannel(code)]: ['subscribe', 'presence'] })
      // One clientId per device, so two tabs on one phone count once.
      const clientId = role === 'presenter' ? `${PRESENTER_CLIENT_PREFIX}${deviceId}` : deviceId
      return rest.auth.createTokenRequest({ clientId, capability, ttl: TOKEN_TTL_MS })
    },
  }
}
