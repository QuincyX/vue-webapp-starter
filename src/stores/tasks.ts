import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { TASKS_STORAGE_KEY, taskRepository } from '@/api/tasks'
import { priorityRank } from '@/constants/task'
import { createSeedTasks } from '@/data/tasks'
import type { Task, TaskDraft, TaskPriority, TaskStatus } from '@/types/task'
import { taskListSchema } from '@/types/task'
import { formatWeekday, isOverdue, toDateKey } from '@/utils/date'

export { TASKS_STORAGE_KEY, createSeedTasks }

function dueDateSortValue(task: Task): string {
  return task.dueDate ?? '9999-12-31'
}

export function compareTasks(left: Task, right: Task): number {
  const leftCompleted = left.status === 'done'
  const rightCompleted = right.status === 'done'
  if (leftCompleted !== rightCompleted) return leftCompleted ? 1 : -1

  const dueDateComparison = dueDateSortValue(left).localeCompare(dueDateSortValue(right))
  if (dueDateComparison !== 0) return dueDateComparison

  const priorityComparison = priorityRank[left.priority] - priorityRank[right.priority]
  if (priorityComparison !== 0) return priorityComparison

  return right.updatedAt.localeCompare(left.updatedAt)
}

/** Narrow an entity back to the editable fields, so edits go through the same schema. */
function toDraft(task: Task, status: TaskStatus = task.status): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    status,
    priority: task.priority,
    dueDate: task.dueDate,
    tags: task.tags,
  }
}

export const useTaskStore = defineStore('tasks', () => {
  // Seeded synchronously so the first paint already has data: `localStorage` is a
  // synchronous API and `read()` is a purely local operation. Writes still go through
  // the repository, never through the store.
  const tasks = ref<Task[]>(taskRepository.read())

  let hydrating: Promise<void> | null = null

  /**
   * Single-flight hydration, the same shape as `stores/health.ts`.
   *
   * With the local adapter this resolves on the next microtask (a re-read at worst).
   * With a REST adapter it is where the first request happens — which is why pages
   * await it before reading `tasks` for deep links.
   */
  function hydrate(): Promise<void> {
    hydrating ??= (async () => {
      const { rows } = await taskRepository.list()
      tasks.value = rows
    })()

    return hydrating
  }

  const statusCounts = computed<Record<TaskStatus, number>>(() => ({
    todo: tasks.value.filter((task) => task.status === 'todo').length,
    'in-progress': tasks.value.filter((task) => task.status === 'in-progress').length,
    done: tasks.value.filter((task) => task.status === 'done').length,
  }))

  const priorityCounts = computed<Record<TaskPriority, number>>(() => ({
    low: tasks.value.filter((task) => task.priority === 'low').length,
    medium: tasks.value.filter((task) => task.priority === 'medium').length,
    high: tasks.value.filter((task) => task.priority === 'high').length,
  }))

  const stats = computed(() => {
    const total = tasks.value.length
    const done = statusCounts.value.done
    const pendingTasks = tasks.value.filter((task) => task.status !== 'done')

    return {
      total,
      done,
      pending: total - done,
      inProgress: statusCounts.value['in-progress'],
      todo: statusCounts.value.todo,
      completionRate: total === 0 ? 0 : Math.round((done / total) * 100),
      overdue: pendingTasks.filter((task) => isOverdue(task.dueDate)).length,
      dueToday: pendingTasks.filter((task) => task.dueDate === toDateKey(new Date())).length,
    }
  })

  const pendingTasks = computed(() =>
    tasks.value.filter((task) => task.status !== 'done').sort(compareTasks),
  )

  const focusTasks = computed(() => pendingTasks.value.slice(0, 4))

  const upcomingTasks = computed(() =>
    tasks.value
      .filter((task) => task.status !== 'done' && task.dueDate)
      .sort(compareTasks)
      .slice(0, 4),
  )

  const recentActivity = computed(() =>
    [...tasks.value]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 5),
  )

  const weeklyActivity = computed(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))

      const dateKey = toDateKey(date)
      const count = tasks.value.filter(
        (task) => task.status === 'done' && toDateKey(task.updatedAt) === dateKey,
      ).length

      return {
        dateKey,
        label: formatWeekday(date),
        count,
      }
    })
  })

  const completedThisWeek = computed(() =>
    weeklyActivity.value.reduce((total, day) => total + day.count, 0),
  )

  async function createTask(draft: TaskDraft): Promise<Task> {
    const task = await taskRepository.create(draft)
    tasks.value.unshift(task)
    return task
  }

  async function updateTask(id: string, draft: TaskDraft): Promise<Task | null> {
    const index = tasks.value.findIndex((task) => task.id === id)
    if (index < 0) return null

    const updated = await taskRepository.update(id, draft)
    tasks.value.splice(index, 1, updated)
    return updated
  }

  async function toggleTask(id: string): Promise<void> {
    const task = tasks.value.find((item) => item.id === id)
    if (!task) return

    await updateTask(id, toDraft(task, task.status === 'done' ? 'todo' : 'done'))
  }

  async function removeTask(id: string): Promise<void> {
    await taskRepository.remove(id)
    tasks.value = tasks.value.filter((task) => task.id !== id)
  }

  async function resetDemoData(): Promise<void> {
    const seeded = createSeedTasks()
    await taskRepository.replaceAll(seeded)
    tasks.value = seeded
  }

  async function clearTasks(): Promise<void> {
    await taskRepository.replaceAll([])
    tasks.value = []
  }

  function exportTasks(): string {
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks: tasks.value,
      },
      null,
      2,
    )
  }

  /**
   * Whole-collection replace. Demo tooling only: `replaceAll` exists on the local adapter
   * and would fail to compile against a REST one, which is the intended signal to drop
   * the import/export UI when connecting a real backend.
   */
  async function importTasks(payload: unknown): Promise<number> {
    const candidate =
      payload && typeof payload === 'object' && 'tasks' in payload
        ? (payload as { tasks: unknown }).tasks
        : payload

    const parsed = taskListSchema.parse(candidate)
    await taskRepository.replaceAll(parsed)
    tasks.value = parsed
    return parsed.length
  }

  return {
    tasks,
    stats,
    statusCounts,
    priorityCounts,
    pendingTasks,
    focusTasks,
    upcomingTasks,
    recentActivity,
    weeklyActivity,
    completedThisWeek,
    hydrate,
    createTask,
    updateTask,
    toggleTask,
    removeTask,
    resetDemoData,
    clearTasks,
    exportTasks,
    importTasks,
  }
})
