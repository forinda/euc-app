import 'reflect-metadata'
// Side-effect import — registers the extended env schema with kickjs
// **before** any controller / service / @Value gets resolved. Without
// this line ConfigService.get('YOUR_KEY') returns undefined because the
// cached schema would still be the base shape. See guide/configuration.
import './config'
import { bootstrap, expressRuntime } from '@forinda/kickjs'
import { SpaAdapter } from '@forinda/kickjs/spa'
import { modules } from './modules'

// Export the app for the Vite plugin (dev mode)
export const app = await bootstrap({ modules, runtime: expressRuntime(),
  adapters: [
    // Serves the built frontend from this origin in production.
    // Inert until the client build exists, so `kick dev` (where Vite
    // serves the client and proxies /api here) is unaffected.
    SpaAdapter({ clientDir: "../web/dist" }),
  ] })
