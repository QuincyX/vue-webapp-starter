<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'

import GlobalLoading from '@/components/ui/GlobalLoading.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { useLoginDialogStore } from '@/stores/login-dialog'

/**
 * The sign-in dialog is loaded on demand: it is only needed after a 401 or a
 * gated action, so its chunk should not compete with the first screen.
 * `GlobalLoading` stays synchronous because it must paint the same frame a
 * blocking operation starts.
 */
const LoginDialog = defineAsyncComponent(() => import('@/components/auth/LoginDialog.vue'))

const route = useRoute()
const loginDialog = useLoginDialogStore()

const layout = computed(() => (route.meta.layout === 'auth' ? AuthLayout : DefaultLayout))
</script>

<template>
  <component :is="layout" />
  <LoginDialog v-if="loginDialog.isOpen" />
  <GlobalLoading />
  <ToastContainer />
</template>
