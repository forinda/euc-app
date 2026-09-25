// Per-device state. localStorage can throw (private mode, blocked storage),
// so every access degrades to "not remembered" rather than crashing.
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

export const presenterKeyStore = {
  get: (code: string) => storage()?.getItem(`presenter:${code}`) ?? null,
  set: (code: string, key: string) => storage()?.setItem(`presenter:${code}`, key),
}

export const myVoteStore = {
  get: (questionId: string) => (storage()?.getItem(`vote:${questionId}`) as 'yes' | 'no' | null) ?? null,
  set: (questionId: string, choice: 'yes' | 'no') => storage()?.setItem(`vote:${questionId}`, choice),
}
