import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { getVoterId, presenterKeyStore } from '../../lib/storage'
import { sessionKeys } from './keys'
import { PRESENTER_KEY_HEADER, type SocketRole } from './types'

export const presenterHeaders = (code: string) => ({ [PRESENTER_KEY_HEADER]: presenterKeyStore.get(code) ?? '' })

export const sessionQueries = {
  /**
   * The public snapshot. Fetched once over HTTP; after that useSessionLive
   * keeps it current: live snapshots from Ably, or polling when Ably is off.
   */
  detail: (code: string) =>
    queryOptions({
      queryKey: sessionKeys.detail(code),
      queryFn: () => api.get('/sessions/:code', { params: { code } }),
      staleTime: Infinity,
    }),

  /**
   * A signed grant to connect to the session's live channel (Ably). Fetched
   * fresh every time (tokens are single-use). 503 means live updates are off.
   */
  realtimeToken: (code: string, role: SocketRole) =>
    queryOptions({
      queryKey: sessionKeys.realtimeToken(code, role),
      queryFn: () =>
        api.get('/sessions/:code/realtime-token', { params: { code }, query: { role, deviceId: getVoterId() } }),
      staleTime: 0,
      gcTime: 0,
      retry: false,
    }),

  /** Prepared questions — presenter only, so only enabled with a stored key. */
  drafts: (code: string) =>
    queryOptions({
      queryKey: sessionKeys.drafts(code),
      queryFn: () => api.get('/sessions/:code/drafts', { params: { code }, headers: presenterHeaders(code) }),
      enabled: !!presenterKeyStore.get(code),
    }),
}
