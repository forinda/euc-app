import { SpaAdapter } from '@forinda/kickjs/spa'
import { SocketIoAdapter } from '@forinda/kickjs-ws/socket.io'
import { SessionInfraAdapter } from './session-infra.adapter'
import { env } from '../config'

export const adapters = [
  // Picks the session store (and, later, realtime) implementation from env.
  SessionInfraAdapter(),
  // Live session updates (src/modules/sessions/session.gateway.ts). The web
  // app reaches it on its own origin — through the Vite proxy in dev, served
  // by this process in production — so no CORS config is needed.
  SocketIoAdapter(),
  // Serves the built frontend in production, with index.html as the fallback
  // for client routes like /join/:code. Inert until the build exists, so
  // `kick dev` (where Vite serves the client) is unaffected. /api stays out
  // of the fallback by default; /socket.io is handled by the engine before
  // it, but excluded too so it can never be answered with HTML.
  SpaAdapter({ clientDir: env.CLIENT_DIR, exclude: ['/socket.io'] }),
]
