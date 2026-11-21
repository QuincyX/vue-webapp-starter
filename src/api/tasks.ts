import { createSeedTasks } from '@/data/tasks'
import type { Task, TaskDraft } from '@/types/task'
import { taskListSchema } from '@/types/task'
import { localRepository } from './repository'

/**
 * Versioned storage key. A changed shape means a new key (and dropping the old one),
 * never an in-place migration layer — see `docs/engineering.md` 6.3.
 */
export const TASKS_STORAGE_KEY = 'orbit.tasks.v1'

function toEntity(draft: TaskDraft): Task {
  const timestamp = new Date().toISOString()

  return {
    ...draft,
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function merge(current: Task, draft: TaskDraft): Task {
  return { ...current, ...draft, updatedAt: new Date().toISOString() }
}

/**
 * The single data source for the task slice.
 *
 * Bound to `localRepository` because the demo runs without a backend. Connecting a real
 * API is an adapter swap in this one line — the store does not change:
 *
 * ```ts
 * export const taskRepository = restRepository<Task, TaskDraft>({
 *   basePath: '/tasks',
 *   listSchema: taskListSchema,
 *   itemSchema: taskSchema,
 * })
 * ```
 *
 * Two consequences of that swap, both caught by the compiler rather than by production:
 * `replaceAll` (used by the import/clear/reset demo tooling) does not exist on a REST
 * adapter, and `read()` does not either, so `store.tasks` starts empty until `hydrate()`
 * resolves. See `docs/data-adapters.md` 4.
 */
export const taskRepository = localRepository<Task, TaskDraft>({
  storageKey: TASKS_STORAGE_KEY,
  schema: taskListSchema,
  seed: createSeedTasks,
  toEntity,
  merge,
})
