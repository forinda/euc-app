import { z } from 'zod'

export const realtimeTokenQuerySchema = z.object({
  role: z.enum(['audience', 'presenter']).default('audience'),
  /** The browser's per-device id (the voter id), so one device counts once. */
  deviceId: z.uuid(),
})
