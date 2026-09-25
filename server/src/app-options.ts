/**
 * The app's options, in one place. Both entry points build from this:
 * - src/index.ts: `bootstrap()`, a long-lived server (`kick dev`, Docker)
 * - src/serverless.ts: `createHandler()`, a Vercel function
 *
 * Add modules, adapters, middleware or runtime settings here, and both get
 * them. Only what genuinely differs between the two is a parameter.
 */
import { expressRuntime, type ApplicationOptions } from '@forinda/kickjs'
import { modules } from './modules'
import { createAdapters } from './adapters'

export interface AppOptionsInput {
  /**
   * Serve the built web app (web/dist) from this process. True for a
   * long-lived server; false on Vercel, whose CDN serves the static files.
   */
  serveClient: boolean
}

export function createAppOptions({ serveClient }: AppOptionsInput): ApplicationOptions {
  return {
    modules,
    adapters: createAdapters({ serveClient }),
    runtime: expressRuntime(),
  }
}
