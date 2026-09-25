import { SpaAdapter } from '@forinda/kickjs/spa'
import { env } from '../config'
import { SessionInfraAdapter } from './session-infra.adapter'

export const adapters = [
  // Picks the session store (memory / Upstash Redis) and realtime service
  // (Ably / none) from env.
  SessionInfraAdapter(),
  // Serves the built frontend when this runs as a long-lived Node server
  // (Docker), with index.html as the fallback for client routes like
  // /join/:code. On Vercel the platform serves the static app instead.
  SpaAdapter({ clientDir: env.CLIENT_DIR }),
]
