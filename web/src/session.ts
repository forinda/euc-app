import { KickClientError } from '@forinda/kickjs-client'

// Straight from the generated client map — the shape every SSE `snapshot` carries.
export type Snapshot = KickClientApi.Api['GET /sessions/:code']['response']
export type Choice = 'yes' | 'no'

export const PRESENTER_KEY_HEADER = 'x-presenter-key'

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Anonymous per-device voter id — one vote per device per question. */
export function getVoterId(): string {
  const store = storage()
  let id = store?.getItem('voterId')
  if (!id) {
    id = crypto.randomUUID()
    store?.setItem('voterId', id)
  }
  return id
}

export const presenterKey = {
  get: (code: string) => storage()?.getItem(`presenter:${code}`) ?? null,
  set: (code: string, key: string) => storage()?.setItem(`presenter:${code}`, key),
}

export const myVote = {
  get: (questionId: string) => (storage()?.getItem(`vote:${questionId}`) as Choice | null) ?? null,
  set: (questionId: string, choice: Choice) => storage()?.setItem(`vote:${questionId}`, choice),
}

export function joinUrl(code: string) {
  return `${location.origin}${location.pathname}#/join/${code}`
}

export function describeError(err: unknown) {
  if (err instanceof KickClientError) {
    const body = err.body as { detail?: string; message?: string } | undefined
    return body?.detail ?? body?.message ?? `Request failed (${err.status})`
  }
  return 'Network error. Check your connection.'
}
