import { createApp } from 'vue'

import App from './App.vue'
import { UNAUTHORIZED_EVENT } from './api/http'
import { useInstallPrompt } from './composables/useInstallPrompt'
import { i18n } from './i18n'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useLoadingStore } from './stores/loading'
import { useLoginDialogStore } from './stores/login-dialog'
import { pinia } from './stores/pinia'
import '@/assets/main.css'

// Register before mounting: `beforeinstallprompt` fires early and only once.
useInstallPrompt().init()

const app = createApp(App)

app.use(pinia)
app.use(i18n)
app.use(router)

/**
 * Session expiry is handled in place: the current page stays mounted, so
 * unsaved input survives, and the user finishes signing in through a dialog
 * instead of being bounced to /login and back.
 *
 * Guests (never signed in) keep the existing route-guard redirect; there is
 * nothing to restore for them.
 */
window.addEventListener(UNAUTHORIZED_EVENT, () => {
  const auth = useAuthStore(pinia)
  // Bootstrap handles its own 401 without racing the initial navigation guard.
  if (!auth.initialized) return

  const hadSession = auth.isAuthenticated
  auth.handleUnauthorized()
  useLoadingStore(pinia).reset()

  const current = router.currentRoute.value
  if (!hadSession) return
  if (current.meta.layout === 'auth') return

  useLoginDialogStore(pinia).open({ reason: 'expired' })
})

app.config.errorHandler = (error, instance, info) => {
  console.error('[Orbit] Unhandled application error', { error, instance, info })
}

await router.isReady()
app.mount('#app')

/**
 * Service worker registration waits for `load` and then the first idle slot, so
 * precaching never competes with the first screen for bandwidth. The PWA plugin
 * no longer injects its own registration script (`injectRegister: null`).
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener(
    'load',
    () => {
      const register = (): void => {
        void import('virtual:pwa-register').then(({ registerSW }) => {
          registerSW({ immediate: true })
        })
      }

      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(register, { timeout: 3000 })
      } else {
        window.setTimeout(register, 1500)
      }
    },
    { once: true },
  )
}
