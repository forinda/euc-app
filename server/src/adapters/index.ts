import { SpaAdapter } from '@forinda/kickjs/spa'
import { SocketIoAdapter } from '@forinda/kickjs-ws/socket.io'

export const adapters = [
  // Live session updates (src/modules/sessions/session.gateway.ts). The web
  // app reaches it on its own origin — through the Vite proxy in dev, served
  // by this process in production — so no CORS config is needed.
  SocketIoAdapter(),
  // Serves the built frontend from this origin in production. Inert until
  // the client build exists, so `kick dev` (where Vite serves the client and
  // proxies /api and /socket.io here) is unaffected.
  SpaAdapter({ clientDir: '../web/dist' }),
]
