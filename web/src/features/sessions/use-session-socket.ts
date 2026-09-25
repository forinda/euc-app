import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { sessionKeys } from './keys'
import type { Snapshot, SocketRole } from './types'

export type SocketStatus = 'connecting' | 'live' | 'reconnecting' | 'not-found'

/** Server → client events on `/sessions` (server/src/modules/sessions/session.gateway.ts). */
interface ServerEvents {
  snapshot: (snapshot: Snapshot) => void
  'not-found': (payload: { code: string }) => void
}

/**
 * Keeps `sessionQueries.detail(code)` live: every `snapshot` the server
 * pushes is written into the query cache, so components just `useQuery` it.
 * The server sends a full snapshot on every (re)connect, so a dropped
 * connection resyncs by itself; socket.io reconnects with backoff.
 */
export function useSessionSocket(code: string, role: SocketRole = 'audience') {
  const qc = useQueryClient()
  const [status, setStatus] = useState<SocketStatus>('connecting')

  useEffect(() => {
    // Same origin: the Vite proxy forwards /socket.io in dev, and the API
    // process serves the app in production. WebSocket-only transport avoids
    // long-polling, which would need sticky sessions behind a load balancer.
    const socket: Socket<ServerEvents> = io('/sessions', { query: { code, role }, transports: ['websocket'] })
    socket.on('snapshot', (snapshot) => {
      qc.setQueryData(sessionKeys.detail(code), snapshot)
      setStatus('live')
    })
    socket.on('not-found', () => setStatus('not-found'))
    socket.on('disconnect', (reason) => {
      // The server disconnects an unknown code on purpose; that isn't "reconnecting".
      if (reason !== 'io server disconnect') setStatus('reconnecting')
    })
    socket.on('connect_error', () => setStatus('reconnecting'))
    return () => {
      socket.close()
    }
  }, [code, role, qc])

  return status
}
