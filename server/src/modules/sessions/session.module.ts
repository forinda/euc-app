/**
 * Session module — live Yes/No audience polls.
 *
 * A presenter creates a session (join code + secret presenter key), publishes
 * questions one at a time, and the audience votes from their phones. Every
 * change is pushed live (see session.realtime.ts).
 *
 * The store and the realtime service are bound by SessionInfraAdapter, which
 * picks implementations from env (src/adapters/session-infra.adapter.ts).
 */
import { defineModule } from '@forinda/kickjs'
import { SessionController } from './session.controller'

// Eagerly load every module file so decorators register in the DI container.
import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.d.ts'], { eager: true })

export const SessionModule = defineModule({
  name: 'SessionModule',
  build: () => ({
    routes() {
      return {
        path: '/sessions',
        controller: SessionController,
      }
    },
  }),
})
