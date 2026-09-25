import { z } from 'zod'

export const streamQuerySchema = z.object({
  role: z.enum(['audience', 'presenter']).optional(),
})
