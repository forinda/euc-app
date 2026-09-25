import { z } from 'zod'

export const createSessionSchema = z.object({
  title: z.string().trim().max(120).optional(),
})

export type CreateSessionDTO = z.infer<typeof createSessionSchema>
