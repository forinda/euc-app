import { loadEnvFromSchema } from '@forinda/kickjs/config'
import { fromZod } from '@forinda/kickjs-schema/zod'
import { z } from 'zod'

/**
 * Project environment schema (Zod).
 *
 * `fromZod` wraps the Zod schema as a `KickSchema` so the env loader,
 * validate middleware, and swagger spec generator all see the same
 * shape. The default export is the contract `kick typegen` reads to
 * populate `KickEnv` via `InferSchemaOutput<typeof _envSchema>` —
 * that's what makes `@Value('FOO')` autocomplete and
 * `process.env.FOO` typed.
 *
 * @example
 *   DATABASE_URL: z.string().url(),
 *   JWT_SECRET: z.string().min(32),
 *   REDIS_URL: z.string().url().optional(),
 */
const envSchema = fromZod(
  z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    // Built web app served by SpaAdapter. Relative paths resolve from the
    // process's working directory, so set an absolute path in production
    // (the Dockerfile does) — the default only works when started from server/.
    CLIENT_DIR: z.string().default('../web/dist'),
    // Session store (see src/adapters/session-infra.adapter.ts). When both are
    // set, sessions live in Upstash Redis; otherwise in memory. Vercel's
    // Upstash integration may inject the KV_REST_API_* names instead.
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    KV_REST_API_URL: z.url().optional(),
    KV_REST_API_TOKEN: z.string().min(1).optional(),
    // DATABASE_URL: z.string().url(),
  }),
)

/**
 * IMPORTANT — side effect: register the schema with kickjs's env cache
 * **at module-load time**. `ConfigService` and `@Value()` both consume
 * this cache, and they will fall back to the base schema (or undefined)
 * if no extended schema has been registered before they're resolved.
 *
 * As long as `src/index.ts` imports this file (`import './config'`) at
 * the top — before `bootstrap()` runs — every controller and service
 * in the app sees the typed extended values.
 */
export const env = loadEnvFromSchema(envSchema)

export default envSchema
