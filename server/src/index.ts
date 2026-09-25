import 'reflect-metadata'
// Side-effect import — registers the extended env schema with kickjs
// **before** any controller / service / @Value gets resolved. Without
// this line ConfigService.get('YOUR_KEY') returns undefined because the
// cached schema would still be the base shape. See guide/configuration.
import './config'
import { bootstrap } from '@forinda/kickjs'
import { createAppOptions } from './app-options'

// Long-lived server (`kick dev`, Docker). Options are shared with the Vercel
// entry (src/serverless.ts); change them in src/app-options.ts.
// Export the app for the Vite plugin (dev mode)
export const app = await bootstrap(createAppOptions({ serveClient: true }))
