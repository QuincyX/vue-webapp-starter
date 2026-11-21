import { computed, onScopeDispose, reactive, watch, type ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Keeps a page's list/filter state in the URL.
 *
 * Why: filter state in local `ref`s is lost on reload and cannot be shared. The URL is
 * already the state carrier for deep links (`?edit=`, `?new=`), so list dimensions belong
 * there too — and only there, to avoid two sources of truth.
 *
 * Three behaviours worth knowing:
 *
 * 1. **Writes use `replace`, not `push`.** Changing a filter should not add a history
 *    entry per keystroke.
 * 2. **Values equal to `defaults` are removed from the URL**, so a pristine page has a
 *    clean `/?` and only non-default state is visible/shareable.
 * 3. **Only the keys in `defaults` are touched.** Anything else in the query (deep-link
 *    parameters) is preserved verbatim.
 */
export interface ListQueryOptions<T extends Record<string, string>> {
  /** Also the set of keys this composable owns. Keep it to real, stable dimensions. */
  defaults: T
  /**
   * Optional allow-list per key. A value in the URL that is not listed falls back to its
   * default — the same "reject and fall back" posture used for persisted data.
   */
  allowed?: Partial<Record<keyof T, readonly string[]>>
  /**
   * Delay before writing to the URL. Use it for text inputs so typing does not navigate on
   * every keystroke; `filters` itself updates immediately either way.
   */
  debounceMs?: number
}

export interface ListQuery<T extends Record<string, string>> {
  /** Reactive and writable: bind it directly (`v-model="filters.search"`). */
  filters: T
  /** Restore every owned key to its default, which also clears them from the URL. */
  reset: () => void
  /** True when any owned key differs from its default. */
  isDirty: ComputedRef<boolean>
}

export function useListQuery<T extends Record<string, string>>(
  options: ListQueryOptions<T>,
): ListQuery<T> {
  const { defaults, allowed, debounceMs = 0 } = options
  const route = useRoute()
  const router = useRouter()
  const keys = Object.keys(defaults)

  function readFromRoute(): Record<string, string> {
    const next: Record<string, string> = { ...defaults }

    for (const key of keys) {
      const raw = route.query[key]
      // Repeated params (`?a=1&a=2`) and absent params both fall back to the default.
      if (typeof raw !== 'string') continue

      const whitelist = allowed?.[key]
      if (whitelist && !whitelist.includes(raw)) continue

      next[key] = raw
    }

    return next
  }

  const filters = reactive<Record<string, string>>(readFromRoute()) as T

  function matchesRoute(): boolean {
    const current = readFromRoute()
    return keys.every((key) => current[key] === filters[key])
  }

  function writeToRoute(): void {
    const query = { ...route.query }

    for (const key of keys) {
      const value = filters[key]

      if (value === undefined || value === defaults[key]) delete query[key]
      else query[key] = value
    }

    void router.replace({ query })
  }

  let timer: ReturnType<typeof setTimeout> | null = null

  function cancelPendingWrite(): void {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  watch(
    filters,
    () => {
      // Already in sync: this change came *from* the URL (back/forward navigation).
      if (matchesRoute()) return

      cancelPendingWrite()

      if (debounceMs <= 0) {
        writeToRoute()
        return
      }

      timer = setTimeout(writeToRoute, debounceMs)
    },
    { deep: true },
  )

  watch(
    () => route.query,
    () => {
      // A queued write would resurrect the pre-navigation state, so drop it first.
      cancelPendingWrite()

      const next = readFromRoute()
      if (keys.every((key) => next[key] === filters[key])) return

      Object.assign(filters, next)
    },
    { deep: true },
  )

  onScopeDispose(cancelPendingWrite)

  const isDirty = computed(() => keys.some((key) => filters[key] !== defaults[key]))

  function reset(): void {
    Object.assign(filters, defaults)
  }

  return { filters, reset, isDirty }
}
