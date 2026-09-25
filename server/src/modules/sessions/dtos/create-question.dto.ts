import { z } from 'zod'

export const createQuestionSchema = z.object({
  text: z.string().trim().min(1).max(280),
})

export type CreateQuestionDTO = z.infer<typeof createQuestionSchema>
