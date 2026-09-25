/**
 * Serverless entry for Vercel (`kick build:vercel` bundles this file).
 *
 * The same app as src/index.ts (both use createAppOptions in
 * src/app-options.ts), minus what a function can't use:
 * - No serving of the web app: Vercel serves web/dist from its CDN and routes
 *   /api/* here.
 * - No listening server: createHandler runs requests through the app directly.
 *
 * Sessions must live in Upstash Redis here (instances don't share memory),
 * and live updates go through Ably. SessionInfraAdapter picks both from env.
 */
import 'reflect-metadata'
// Must come first: registers the env schema before anything reads config.
import './config'
import { createHandler } from '@forinda/kickjs'
import { createAppOptions } from './app-options'

export const handler = createHandler(createAppOptions({ serveClient: false }))
