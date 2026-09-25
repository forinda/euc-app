import { randomInt } from 'node:crypto'

// No I/L/O/0/1 — codes are read off a projector and typed on phones.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

/** A random join code. Callers retry on the rare collision. */
export function newSessionCode() {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join('')
}

/** Sessions expire after this long without activity. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60

/** Per-session cap on prepared questions. */
export const MAX_DRAFTS = 100
