import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { presenterKeyStore } from '../../lib/storage'
import { sessionKeys } from './keys'
import { PRESENTER_KEY_HEADER } from './types'

export const presenterHeaders = (code: string) => ({ [PRESENTER_KEY_HEADER]: presenterKeyStore.get(code) ?? '' })

export const sessionQueries = {
  /**
   * The public snapshot. Fetched once over HTTP; after that useSessionSocket
   * writes every live `snapshot` into this cache entry, so it never goes stale.
   */
  detail: (code: string) =>
    queryOptions({
      queryKey: sessionKeys.detail(code),
      queryFn: () => api.get('/sessions/:code', { params: { code } }),
      staleTime: Infinity,
    }),

  /** Prepared questions — presenter only, so only enabled with a stored key. */
  drafts: (code: string) =>
    queryOptions({
      queryKey: sessionKeys.drafts(code),
      queryFn: () => api.get('/sessions/:code/drafts', { params: { code }, headers: presenterHeaders(code) }),
      enabled: !!presenterKeyStore.get(code),
    }),
}
