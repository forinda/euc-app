import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { healthKeys } from './keys'

export const healthQueries = {
  status: () =>
    queryOptions({
      queryKey: healthKeys.all,
      queryFn: () => api.get('/hello/health'),
      refetchInterval: 30_000,
    }),
}
