import { z } from 'zod'
import { createTaskSchema } from './create-task.dto'

export const updateTaskSchema = createTaskSchema.partial()

export type UpdateTaskDTO = z.infer<typeof updateTaskSchema>
