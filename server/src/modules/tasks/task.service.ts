import { Service, Inject } from '@forinda/kickjs'
import type { ParsedQuery } from '@forinda/kickjs'
import { TASK_REPOSITORY, type TaskRepository } from './task.repository'
import type { TaskResponseDTO } from './dtos/task-response.dto'
import type { CreateTaskDTO } from './dtos/create-task.dto'
import type { UpdateTaskDTO } from './dtos/update-task.dto'

@Service()
export class TaskService {
  constructor(@Inject(TASK_REPOSITORY) private readonly repo: TaskRepository) {}

  async findById(id: string): Promise<TaskResponseDTO | null> {
    return this.repo.findById(id)
  }

  async findAll(): Promise<TaskResponseDTO[]> {
    return this.repo.findAll()
  }

  async findPaginated(parsed: ParsedQuery) {
    return this.repo.findPaginated(parsed)
  }

  async create(dto: CreateTaskDTO): Promise<TaskResponseDTO> {
    return this.repo.create(dto)
  }

  async update(id: string, dto: UpdateTaskDTO): Promise<TaskResponseDTO> {
    return this.repo.update(id, dto)
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id)
  }
}
