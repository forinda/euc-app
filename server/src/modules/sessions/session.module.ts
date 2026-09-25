/**
 * Session module — live Yes/No audience polls.
 *
 * A presenter creates a session (join code + secret presenter key), publishes
 * questions one at a time, and the audience votes from their phones. Every
 * change is pushed to `GET /sessions/:code/stream` subscribers over SSE.
 */
import { defineModule } from '@forinda/kickjs'
import { SESSION_REPOSITORY, createSessionRepository } from './session.repository'
import { SESSION_EVENTS, createSessionEvents } from './session.events'
import { SessionController } from './session.controller'

// Eagerly load every module file so decorators register in the DI container.
import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.d.ts'], { eager: true })

export const SessionModule = defineModule({
  name: 'SessionModule',
  build: () => ({
    register(container) {
      container.registerFactory(SESSION_REPOSITORY, () => createSessionRepository())
      container.registerFactory(SESSION_EVENTS, () => createSessionEvents())
    },

    routes() {
      return {
        path: '/sessions',
        controller: SessionController,
      }
    },
  }),
})
