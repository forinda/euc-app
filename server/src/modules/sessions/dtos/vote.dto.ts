import { z } from 'zod'

export const voteSchema = z.object({
  voterId: z.uuid(),
  choice: z.enum(['yes', 'no']),
})

export type VoteDTO = z.infer<typeof voteSchema>
