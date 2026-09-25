/**
 * Session infrastructure adapter: decides which implementations back the
 * sessions module, from env.
 *
 * - Store (SESSION_REPOSITORY): Upstash Redis when UPSTASH_REDIS_REST_URL +
 *   UPSTASH_REDIS_REST_TOKEN (or Vercel's KV_REST_API_URL + KV_REST_API_TOKEN)
 *   are set. Otherwise in-memory, which is correct only for one long-running
 *   process (local dev, tests, a single Docker container).
 *
 * The sessions module only depends on the tokens, so swapping an
 * implementation happens here and nowhere else. Factories read env lazily
 * (on first resolve), and each instance is created once per app.
 */
import { defineAdapter, getEnv, Logger, type AdapterContext } from '@forinda/kickjs'
import { Redis } from '@upstash/redis'
import { SESSION_REPOSITORY, type SessionRepository } from '@/modules/sessions/session.repository'
import { createMemorySessionRepository } from '@/modules/sessions/session.repository.memory'
import { createRedisSessionRepository } from '@/modules/sessions/session.repository.redis'

const log = Logger.for('SessionInfraAdapter')

/** Upstash REST credentials from env, or null to use the in-memory store. */
function redisCredentials(): { url: string; token: string } | null {
  const url = getEnv('UPSTASH_REDIS_REST_URL') ?? getEnv('KV_REST_API_URL')
  const token = getEnv('UPSTASH_REDIS_REST_TOKEN') ?? getEnv('KV_REST_API_TOKEN')
  if (url && token) return { url, token }
  if (url || token) {
    // Half-configured is a deploy mistake, not a reason to quietly lose data
    // to per-instance memory.
    throw new Error(
      'Session store: an Upstash Redis URL or token is set without the other. Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or neither, for in-memory).',
    )
  }
  return null
}

export const SessionInfraAdapter = defineAdapter({
  name: 'SessionInfraAdapter',
  build: () => {
    let repository: SessionRepository | null = null
    let redis: Redis | null = null

    function createRepository(): SessionRepository {
      const credentials = redisCredentials()
      if (credentials) {
        log.info(`Session store: Upstash Redis (${new URL(credentials.url).host})`)
        // Stored strings must come back verbatim (see session.repository.redis.ts).
        redis = new Redis({ ...credentials, automaticDeserialization: false })
        return createRedisSessionRepository(redis)
      }
      log.info('Session store: in-memory (single process only)')
      return createMemorySessionRepository()
    }

    return {
      // Runs during setup(), so it covers `kick dev`, createHandler (Vercel)
      // and createTestApp alike.
      beforeStart(ctx: AdapterContext): void {
        ctx.container.registerFactory(SESSION_REPOSITORY, () => (repository ??= createRepository()))
      },

      /** Readiness: Redis must answer. Untouched or in-memory counts as up. */
      async onHealthCheck(): Promise<{ name: string; status: 'up' | 'down' }> {
        if (!redis) return { name: 'session-store', status: 'up' }
        try {
          await redis.ping()
          return { name: 'session-store', status: 'up' }
        } catch {
          return { name: 'session-store', status: 'down' }
        }
      },
    }
  },
})
