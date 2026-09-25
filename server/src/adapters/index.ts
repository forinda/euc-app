import { SpaAdapter } from '@forinda/kickjs/spa'
import { env } from '../config'
import { SessionInfraAdapter } from './session-infra.adapter'

/**
 * The adapter list for one app instance. Called from createAppOptions()
 * (src/app-options.ts), so each entry point gets fresh adapter instances.
 */
export function createAdapters({ serveClient }: { serveClient: boolean }) {
  return [
    // Picks the session store (memory / Upstash Redis) and realtime service
    // (Ably / none) from env.
    SessionInfraAdapter(),
    // Serves the built frontend, with index.html as the fallback for client
    // routes like /join/:code. Only for a long-lived server (`kick dev`,
    // Docker). On Vercel the platform's CDN serves web/dist instead.
    ...(serveClient ? [SpaAdapter({ clientDir: env.CLIENT_DIR })] : []),
  ]
}
