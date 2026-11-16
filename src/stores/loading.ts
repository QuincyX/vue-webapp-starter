import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/** i18n key used when a caller does not name the operation. */
export const DEFAULT_LOADING_MESSAGE_KEY = 'globalLoading.default'

interface LoadingTask {
  id: number
  messageKey: string
}

/**
 * Blocking, full-page loading state.
 *
 * A stack of named tasks instead of a boolean: concurrent or nested operations
 * each hold their own id, so the first one to finish cannot dismiss the overlay
 * that a later one opened. The visible message is the top of the stack.
 *
 * Use `run()` when possible — it always releases its own task in `finally`, so a
 * rejected request cannot leave the page blocked.
 */
export const useLoadingStore = defineStore('loading', () => {
  const tasks = ref<LoadingTask[]>([])
  let nextId = 1

  const isLoading = computed(() => tasks.value.length > 0)
  const messageKey = computed(
    () => tasks.value[tasks.value.length - 1]?.messageKey ?? DEFAULT_LOADING_MESSAGE_KEY,
  )

  function begin(messageKey: string = DEFAULT_LOADING_MESSAGE_KEY): number {
    const id = nextId++
    tasks.value.push({ id, messageKey })
    return id
  }

  /** End the task identified by `id`; without an id, drop the most recent one. */
  function end(id?: number): void {
    if (id === undefined) {
      tasks.value.pop()
      return
    }

    tasks.value = tasks.value.filter((task) => task.id !== id)
  }

  async function run<T>(
    task: () => Promise<T>,
    messageKey: string = DEFAULT_LOADING_MESSAGE_KEY,
  ): Promise<T> {
    const id = begin(messageKey)

    try {
      return await task()
    } finally {
      end(id)
    }
  }

  /** Safety valve for session changes (sign-out, 401) so no stale task survives. */
  function reset(): void {
    tasks.value = []
  }

  return { tasks, isLoading, messageKey, begin, end, run, reset }
})
