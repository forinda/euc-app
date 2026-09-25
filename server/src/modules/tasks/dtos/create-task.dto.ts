import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).optional(),
  done: z.boolean().optional(),
})

export type CreateTaskDTO = z.infer<typeof createTaskSchema>
