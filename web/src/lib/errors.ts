import { KickClientError } from '@forinda/kickjs-client'

export const isNotFound = (err: unknown) => err instanceof KickClientError && err.status === 404

/** Human-readable message from a typed-client error (RFC 9457 problem details when present). */
export function describeError(err: unknown) {
  if (err instanceof KickClientError) {
    const body = err.body as { detail?: string; message?: string } | undefined
    return body?.detail ?? body?.message ?? `Request failed (${err.status})`
  }
  return 'Network error. Check your connection.'
}
