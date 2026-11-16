<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from '@lucide/vue'

import BaseModal from '@/components/ui/BaseModal.vue'
import { useLoginForm } from '@/composables/useLoginForm'
import { useToast } from '@/composables/useToast'
import { useLoginDialogStore } from '@/stores/login-dialog'

/**
 * In-place sign-in surface. Mounted by `App.vue` only while open, so every open
 * starts from a clean form.
 *
 * The dialog owns the toast and closing; the caller only supplies `onSuccess`
 * when it can resume an interrupted action.
 */
const { t } = useI18n()
const { toast } = useToast()
const dialog = useLoginDialogStore()

const { form, errors, formError, showPassword, submitting, submit } = useLoginForm()

const title = computed(() =>
  dialog.reason === 'expired' ? t('auth.dialog.expiredTitle') : t('auth.dialog.requiredTitle'),
)
const description = computed(() =>
  dialog.reason === 'expired'
    ? t('auth.dialog.expiredDescription')
    : t('auth.dialog.requiredDescription'),
)

async function handleSubmit(): Promise<void> {
  if (!(await submit())) return

  toast({ title: t('auth.dialog.success'), variant: 'success' })
  dialog.complete()
}
</script>

<template>
  <BaseModal
    :open="dialog.isOpen"
    :title="title"
    :description="description"
    size="sm"
    @close="dialog.close()"
  >
    <form id="login-dialog-form" class="space-y-4" novalidate @submit.prevent="handleSubmit">
      <div>
        <label for="login-dialog-email" class="field-label">{{ t('auth.fields.email') }}</label>
        <div class="relative">
          <Mail
            class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="login-dialog-email"
            v-model="form.email"
            type="email"
            name="email"
            autocomplete="email"
            inputmode="email"
            class="input pl-10"
            :class="{ 'border-rose-500 focus:ring-rose-500/20': errors.email }"
            :aria-invalid="Boolean(errors.email)"
            :aria-describedby="errors.email ? 'login-dialog-email-error' : undefined"
            :placeholder="t('auth.fields.emailPlaceholder')"
            :disabled="submitting"
            data-autofocus
            @input="errors.email = undefined"
          />
        </div>
        <p v-if="errors.email" id="login-dialog-email-error" class="field-error" role="alert">
          {{ errors.email }}
        </p>
      </div>

      <div>
        <label for="login-dialog-password" class="field-label">
          {{ t('auth.fields.password') }}
        </label>
        <div class="relative">
          <LockKeyhole
            class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="login-dialog-password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            name="password"
            autocomplete="current-password"
            class="input pr-11 pl-10"
            :class="{ 'border-rose-500 focus:ring-rose-500/20': errors.password }"
            :aria-invalid="Boolean(errors.password)"
            :aria-describedby="errors.password ? 'login-dialog-password-error' : undefined"
            :placeholder="t('auth.fields.passwordPlaceholder')"
            :disabled="submitting"
            @input="errors.password = undefined"
          />
          <button
            type="button"
            class="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            :aria-label="
              showPassword ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')
            "
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" class="size-4" aria-hidden="true" />
            <Eye v-else class="size-4" aria-hidden="true" />
          </button>
        </div>
        <p v-if="errors.password" id="login-dialog-password-error" class="field-error" role="alert">
          {{ errors.password }}
        </p>
      </div>

      <p
        v-if="formError"
        class="rounded-xl border border-rose-500/25 bg-rose-500/5 px-3.5 py-3 text-xs font-medium text-rose-700 dark:text-rose-300"
        role="alert"
      >
        {{ formError }}
      </p>

      <button type="submit" class="btn btn-primary w-full" :disabled="submitting">
        <LoaderCircle v-if="submitting" class="animate-spin" aria-hidden="true" />
        <span>{{ submitting ? t('auth.login.submitting') : t('auth.dialog.submit') }}</span>
      </button>
    </form>

    <template #footer>
      <button type="button" class="btn btn-ghost btn-sm" @click="dialog.close()">
        {{ t('auth.dialog.cancel') }}
      </button>
    </template>
  </BaseModal>
</template>
