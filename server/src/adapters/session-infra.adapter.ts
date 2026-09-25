/**
 * Session infrastructure adapter: decides which implementations back the
 * sessions module, from env.
 *
 * - Store (SESSION_REPOSITORY): in-memory by default. Correct only for one
 *   long-running process (local dev, tests, a single Docker container).
 *
 * The sessions module only depends on the tokens, so swapping an
 * implementation happens here and nowhere else. Factories read env lazily
 * (on first resolve), and each instance is created once per app.
 */
import { defineAdapter, Logger, type AdapterContext } from '@forinda/kickjs'
import { SESSION_REPOSITORY, type SessionRepository } from '@/modules/sessions/session.repository'
import { createMemorySessionRepository } from '@/modules/sessions/session.repository.memory'

const log = Logger.for('SessionInfraAdapter')

function createRepository(): SessionRepository {
  log.info('Session store: in-memory (single process only)')
  return createMemorySessionRepository()
}

export const SessionInfraAdapter = defineAdapter({
  name: 'SessionInfraAdapter',
  build: () => {
    let repository: SessionRepository | null = null

    return {
      // Runs during setup(), so it covers `kick dev`, createHandler (Vercel)
      // and createTestApp alike.
      beforeStart(ctx: AdapterContext): void {
        ctx.container.registerFactory(SESSION_REPOSITORY, () => (repository ??= createRepository()))
      },
    }
  },
})
