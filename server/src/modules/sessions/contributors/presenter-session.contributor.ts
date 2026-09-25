import { timingSafeEqual } from 'node:crypto'
import { defineHttpContextDecorator, HttpException } from '@forinda/kickjs'
import { SessionService } from '../session.service'
import type { Session } from '../session.types'

/** Header the presenter screen sends on speaker-only routes. */
export const PRESENTER_KEY_HEADER = 'x-presenter-key'

declare module '@forinda/kickjs' {
  interface ContextMeta {
    /** The `:code` session, verified against the request's presenter key. */
    presenterSession: Session
  }
}

/**
 * Presenter auth for speaker-only routes.
 *
 * Resolves `ctx.require('presenterSession')` to the `:code` session when the
 * `x-presenter-key` header matches it. Not optional, so a throw here skips the
 * handler and reaches the request error handler: 404 for an unknown session,
 * 403 for a missing or wrong key.
 *
 * Looks the session up through `SessionService` rather than the repository
 * token, so it always reads the same store as the handlers — even if the
 * repository binding is re-registered (a second app boot, an HMR rebuild)
 * while the service singleton still holds the original.
 */
export const PresenterSession = defineHttpContextDecorator({
  key: 'presenterSession',
  deps: { sessions: SessionService },
  resolve: (ctx, { sessions }) => {
    const session = sessions.requireSession(String(ctx.params.code ?? ''))

    const header = ctx.headers[PRESENTER_KEY_HEADER]
    const given = Buffer.from(typeof header === 'string' ? header : '')
    const expected = Buffer.from(session.presenterKey)
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw HttpException.forbidden('Presenter key missing or invalid')
    }
    return session
  },
})
