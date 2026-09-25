/**
 * Task repository.
 *
 * Backed by an in-memory Map: a working store with no dependencies.
 *
 * The factory's return type IS the contract: `TaskRepository` is derived
 * from it, so the implementation and its interface cannot drift apart. To swap
 * stores, write another factory returning a compatible shape and bind that one
 * in the module — nothing else has to change.
 */
import { randomUUID } from 'node:crypto'
import { createToken, HttpException } from '@forinda/kickjs'
import type { FilterItem, ParsedQuery } from '@forinda/kickjs'
import type { TaskResponseDTO } from './dtos/task-response.dto'
import type { CreateTaskDTO } from './dtos/create-task.dto'
import type { UpdateTaskDTO } from './dtos/update-task.dto'

function matchesFilter(task: TaskResponseDTO, { field, operator, value }: FilterItem): boolean {
  // `done` is optional on the entity; an unset flag reads as "not done".
  const actual =
    field === 'done'
      ? String(task.done ?? false)
      : String(task[field as keyof TaskResponseDTO] ?? '')
  switch (operator) {
    case 'eq':
      return actual === value
    case 'neq':
      return actual !== value
    case 'contains':
      return actual.toLowerCase().includes(value.toLowerCase())
    default:
      return true
  }
}

export function createTaskRepository() {
  const store = new Map<string, TaskResponseDTO>()

  return {
    async findById(id: string): Promise<TaskResponseDTO | null> {
      return store.get(id) ?? null
    },

    async findAll(): Promise<TaskResponseDTO[]> {
      return [...store.values()]
    },

    async findPaginated(parsed: ParsedQuery): Promise<{ data: TaskResponseDTO[]; total: number }> {
      // The allow-list in TASK_QUERY_CONFIG has already dropped unknown fields.
      const search = parsed.search.toLowerCase()
      const matches = [...store.values()].filter(
        (task) =>
          parsed.filters.every((f) => matchesFilter(task, f)) &&
          (!search || `${task.title} ${task.notes ?? ''}`.toLowerCase().includes(search)),
      )
      const sort = parsed.sort.length
        ? parsed.sort
        : [{ field: 'createdAt', direction: 'desc' as const }]
      matches.sort((a, b) => {
        for (const { field, direction } of sort) {
          const cmp = String(a[field as keyof TaskResponseDTO] ?? '').localeCompare(
            String(b[field as keyof TaskResponseDTO] ?? ''),
          )
          if (cmp) return direction === 'asc' ? cmp : -cmp
        }
        return 0
      })
      const { offset, limit } = parsed.pagination
      return { data: matches.slice(offset, offset + limit), total: matches.length }
    },

    async create(dto: CreateTaskDTO): Promise<TaskResponseDTO> {
      const now = new Date().toISOString()
      const entity = { id: randomUUID(), ...dto, createdAt: now, updatedAt: now } as TaskResponseDTO
      store.set(entity.id, entity)
      return entity
    },

    async update(id: string, dto: UpdateTaskDTO): Promise<TaskResponseDTO> {
      const existing = store.get(id)
      if (!existing) throw HttpException.notFound('Task not found')
      const updated = { ...existing, ...dto, updatedAt: new Date().toISOString() }
      store.set(id, updated)
      return updated
    },

    async delete(id: string): Promise<void> {
      if (!store.has(id)) throw HttpException.notFound('Task not found')
      store.delete(id)
    },
  }
}

/** The contract, derived from the factory rather than declared beside it. */
export type TaskRepository = ReturnType<typeof createTaskRepository>

/**
 * Collision-safe DI token bound to `TaskRepository`.
 * `container.resolve(TASK_REPOSITORY)` and
 * `@Inject(TASK_REPOSITORY)` both return the typed
 * contract — no manual generic, no `any` cast.
 *
 * The `'euc-app-server/'` prefix matches the project scope so
 * `kick-lint`'s `token-reserved-prefix` rule never fires —
 * adopters must NOT use the reserved `'kick/'` namespace.
 */
export const TASK_REPOSITORY = createToken<TaskRepository>('euc-app-server/Task/repository')
