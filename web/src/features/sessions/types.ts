import { publicOrigin } from '../../lib/public-url'

// All derived from the generated client map — no hand-written API shapes.
type Api = KickClientApi.Api

export type Snapshot = Api['GET /sessions/:code']['response']
export type Question = NonNullable<Snapshot['question']>
export type Draft = Api['GET /sessions/:code/drafts']['response'][number]
export type Choice = Api['PUT /sessions/:code/questions/:id/vote']['body']['choice']
export type SocketRole = 'audience' | 'presenter'

export const PRESENTER_KEY_HEADER = 'x-presenter-key'

/** "9VVYMK" → "9VV YMK": easier to read off a projector. */
export const chunkCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`

export const percent = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)

/** The link a phone opens to join (also encoded in the QR code). */
export const joinUrl = (code: string) => `${publicOrigin()}/join/${code}`
