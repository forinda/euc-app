import { useEffect, useState } from 'react'
import { KickClientError } from '@forinda/kickjs-client'
import { api } from './api'
import type { Snapshot } from './session'

export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'not-found'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Live session state over SSE. `api.stream()` is fetch-based and does not
 * reconnect on its own, so this loops with backoff; the server sends a full
 * snapshot on every connect, so a reconnect resyncs without extra requests.
 */
export function useSessionStream(code: string) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [status, setStatus] = useState<StreamStatus>('connecting')

  useEffect(() => {
    let stopped = false
    let close: (() => void) | undefined
    let attempt = 0

    async function run() {
      while (!stopped) {
        try {
          const stream = await api.stream('/sessions/:code/stream', { params: { code } })
          close = () => stream.close()
          for await (const ev of stream) {
            if (ev.event !== 'snapshot') continue
            attempt = 0
            setSnapshot(ev.data)
            setStatus('live')
          }
        } catch (err) {
          if (err instanceof KickClientError && err.status === 404) {
            setStatus('not-found')
            return
          }
        }
        if (stopped) return
        setStatus('reconnecting')
        await sleep(Math.min(1000 * 2 ** attempt++, 10_000))
      }
    }

    run()
    return () => {
      stopped = true
      close?.()
    }
  }, [code])

  return { snapshot, status }
}
