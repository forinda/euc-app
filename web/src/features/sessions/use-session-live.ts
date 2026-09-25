import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Ably from 'ably'
import { hasStatus, isNotFound } from '../../lib/errors'
import { sessionKeys } from './keys'
import { sessionQueries } from './queries'
import type { Snapshot, SocketRole } from './types'

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'polling' | 'not-found'

/** Poll interval when live updates are off (no Ably key) or Ably fails. */
const POLL_MS = 2000

// Must match the server (session.realtime.ts).
const channelName = (code: string) => `session:${code}`
const PRESENTER_CLIENT_PREFIX = 'presenter:'

/** Unique audience devices in presence. Presenter screens never count. */
function countAudience(members: Ably.PresenceMessage[]) {
  const devices = new Set<string>()
  for (const m of members) if (m.clientId && !m.clientId.startsWith(PRESENTER_CLIENT_PREFIX)) devices.add(m.clientId)
  return devices.size
}

/**
 * Keeps `sessionQueries.detail(code)` current, so screens just `useQuery` it.
 *
 * - Ably configured: subscribes to the session channel and writes each live
 *   snapshot into the cache, but only if its `version` is newer. Updates
 *   from concurrent serverless invocations can arrive out of order.
 * - Audience screens enter presence; presenter screens count it
 *   (`audienceCount`, unique devices).
 * - Ably not configured (503 from the token route) or failing: polls the
 *   snapshot every 2 s instead (`status: 'polling'`, `audienceCount: null`).
 */
export function useSessionLive(code: string, role: SocketRole = 'audience') {
  const qc = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const [audienceCount, setAudienceCount] = useState<number | null>(null)

  // Polling fallback: this observer refetches the shared cache entry.
  // The projector keeps polling even without focus (the speaker may be in
  // another window); phones pause in the background and catch up on refocus.
  const polling = status === 'polling'
  useQuery({
    ...sessionQueries.detail(code),
    refetchInterval: polling ? POLL_MS : false,
    refetchIntervalInBackground: polling && role === 'presenter',
    refetchOnWindowFocus: polling ? 'always' : false,
  })

  useEffect(() => {
    let cancelled = false
    let client: Ably.Realtime | null = null
    const detailKey = sessionKeys.detail(code)
    const fetchToken = () => qc.fetchQuery(sessionQueries.realtimeToken(code, role))
    const fallBackToPolling = () => {
      if (cancelled) return
      setAudienceCount(null)
      setStatus('polling')
    }

    async function connect() {
      let firstToken: Awaited<ReturnType<typeof fetchToken>> | undefined
      try {
        firstToken = await fetchToken()
      } catch (err) {
        if (cancelled) return
        if (isNotFound(err)) setStatus('not-found')
        else fallBackToPolling() // 503 = live updates off; anything else = best effort
        if (!hasStatus(err, 503) && !isNotFound(err)) console.warn('Live updates unavailable, polling instead', err)
        return
      }
      if (cancelled) return

      client = new Ably.Realtime({
        // First connect reuses the token we just fetched; renewals fetch anew.
        authCallback: (_params, callback) => {
          const pending = firstToken
          firstToken = undefined
          ;(pending ? Promise.resolve(pending) : fetchToken()).then(
            (token) => callback(null, token),
            (err) => callback(err instanceof Error ? err.message : String(err), null),
          )
        },
      })

      let everConnected = false
      client.connection.on((change) => {
        if (cancelled) return
        if (change.current === 'connected') {
          everConnected = true
          setStatus('live')
        } else if (change.current === 'failed') fallBackToPolling()
        else if (change.current !== 'closing' && change.current !== 'closed')
          setStatus(everConnected ? 'reconnecting' : 'connecting')
      })

      const channel = client.channels.get(channelName(code))
      // Attached without continuity (first attach, or after a long drop):
      // anything published meanwhile was missed, so refetch once.
      channel.on('attached', (change) => {
        if (!change.resumed) qc.invalidateQueries({ queryKey: detailKey })
      })

      try {
        await channel.subscribe('snapshot', (message) => {
          const next = message.data as Snapshot
          qc.setQueryData<Snapshot>(detailKey, (prev) => (!prev || next.version > prev.version ? next : prev))
        })
        if (role === 'audience') {
          await channel.presence.enter()
        } else {
          const recount = async () => {
            const members = await channel.presence.get()
            if (!cancelled) setAudienceCount(countAudience(members))
          }
          await channel.presence.subscribe(() => void recount())
          await recount()
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Live channel failed, polling instead', err)
          client.close()
          fallBackToPolling()
        }
      }
    }

    void connect()
    return () => {
      cancelled = true
      client?.close()
    }
  }, [code, role, qc])

  return { status, audienceCount }
}
