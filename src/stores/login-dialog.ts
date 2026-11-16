import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type LoginDialogReason = 'required' | 'expired'

export interface LoginDialogContext {
  /** `expired` renders the session-expired copy instead of the generic wall copy. */
  reason: LoginDialogReason
  /**
   * The action that was interrupted by the login requirement. It runs once,
   * after the dialog has closed, so the caller can resume without redirecting.
   */
  onSuccess?: () => void | Promise<void>
}

/**
 * Global in-place sign-in dialog.
 *
 * Two entry points:
 * - a session expiring mid-use (the page stays mounted, unsaved input survives);
 * - a lightweight action that needs an account (`required`), where a full-page
 *   redirect would throw away the user's context.
 *
 * Page-level flows that can resume (e.g. "save profile") call `open({ onSuccess })`
 * after a 401 and the retry runs on the same page once the user signs in.
 */
export const useLoginDialogStore = defineStore('login-dialog', () => {
  const isOpen = ref(false)
  const context = ref<LoginDialogContext>({ reason: 'required' })

  const reason = computed(() => context.value.reason)

  /**
   * Open the dialog, or replace the context when it is already open. Later
   * callers win: the global 401 handler opens without a retry, then the page
   * that knows how to resume re-opens with `onSuccess`.
   */
  function open(next: Partial<LoginDialogContext> = {}): void {
    context.value = {
      reason: next.reason ?? context.value.reason,
      onSuccess: next.onSuccess ?? context.value.onSuccess,
    }
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
    context.value = { reason: 'required' }
  }

  /** Close first, then resume the interrupted action exactly once. */
  function complete(): void {
    const pending = context.value.onSuccess
    close()
    if (pending) void pending()
  }

  return { isOpen, context, reason, open, close, complete }
})
