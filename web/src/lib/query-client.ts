import { QueryClient } from '@tanstack/react-query'
import { KickClientError } from '@forinda/kickjs-client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx won't fix itself on retry (kickjs.app/guide/typed-client-recipes).
      retry: (count, error) => (error instanceof KickClientError && error.status < 500 ? false : count < 3),
      refetchOnWindowFocus: false,
    },
  },
})
