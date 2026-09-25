/**
 * Session module — live Yes/No audience polls.
 *
 * A presenter creates a session (join code + secret presenter key), publishes
 * questions one at a time, and the audience votes from their phones. Every
 * change is pushed to the session's Socket.IO room (see session.gateway.ts).
 */
import { defineModule } from '@forinda/kickjs'
import { SOCKET_IO } from '@forinda/kickjs-ws/socket.io'
import { SESSION_EVENTS, SESSIONS_NAMESPACE, createSessionEvents } from './session.events'
import { SessionController } from './session.controller'

// Eagerly load every module file so decorators register in the DI container.
import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./**/*.d.ts'], { eager: true })

export const SessionModule = defineModule({
  name: 'SessionModule',
  build: () => ({
    register(container) {
      // The store (SESSION_REPOSITORY) is bound by SessionInfraAdapter, which
      // picks an implementation from env. See src/adapters/session-infra.adapter.ts.
      container.registerFactory(SESSION_EVENTS, () =>
        createSessionEvents({
          // Resolved per emit: SocketIoAdapter registers SOCKET_IO at startup,
          // after modules register. Without the adapter (unit tests) there
          // are no sockets to reach, so emitting is a no-op.
          emit: (code, snapshot) => {
            if (!container.has(SOCKET_IO)) return
            container.resolve(SOCKET_IO).of(SESSIONS_NAMESPACE).to(code).emit('snapshot', snapshot)
          },
        }),
      )
    },

    routes() {
      return {
        path: '/sessions',
        controller: SessionController,
      }
    },
  }),
})
