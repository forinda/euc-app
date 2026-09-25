import type { QueryFieldConfig } from '@forinda/kickjs'

export const TASK_QUERY_CONFIG: QueryFieldConfig = {
  filterable: ['title', 'done'],
  sortable: ['title', 'createdAt', 'updatedAt'],
  searchable: ['title', 'notes'],
}
