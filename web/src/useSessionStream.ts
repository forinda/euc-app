import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { Snapshot } from './session'

export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'not-found'

/** Server → client events on the `/sessions` namespace (server/src/modules/sessions/session.gateway.ts). */
interface SessionEvents {
  snapshot: (snapshot: Snapshot) => void
  'not-found': (payload: { code: string }) => void
}

/**
 * Live session state over Socket.IO. The server sends a full snapshot on
 * every (re)connect, so a dropped connection resyncs by itself; socket.io
 * handles reconnecting with backoff.
 */
export function useSessionStream(code: string, role: 'audience' | 'presenter' = 'audience') {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [status, setStatus] = useState<StreamStatus>('connecting')

  useEffect(() => {
    // Same origin: the Vite proxy forwards /socket.io in dev, and the API
    // process serves the app in production. WebSocket-only transport avoids
    // long-polling, which would need sticky sessions behind a load balancer.
    const socket: Socket<SessionEvents> = io('/sessions', { query: { code, role }, transports: ['websocket'] })
    socket.on('snapshot', (next) => {
      setSnapshot(next)
      setStatus('live')
    })
    socket.on('not-found', () => setStatus('not-found'))
    socket.on('disconnect', (reason) => {
      // The server disconnects an unknown code on purpose; don't show "reconnecting" for that.
      if (reason !== 'io server disconnect') setStatus('reconnecting')
    })
    socket.on('connect_error', () => setStatus('reconnecting'))
    return () => {
      socket.close()
    }
  }, [code, role])

  return { snapshot, status }
}
