import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLoginDialogStore } from '@/stores/login-dialog'

describe('login dialog store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens with the required reason by default', () => {
    const dialog = useLoginDialogStore()

    dialog.open()

    expect(dialog.isOpen).toBe(true)
    expect(dialog.reason).toBe('required')
  })

  it('lets a later caller attach a resume action while the dialog is open', () => {
    const dialog = useLoginDialogStore()
    const resume = vi.fn<() => void>()

    dialog.open({ reason: 'expired' })
    dialog.open({ reason: 'expired', onSuccess: resume })

    expect(dialog.isOpen).toBe(true)
    expect(dialog.reason).toBe('expired')

    dialog.complete()

    expect(resume).toHaveBeenCalledTimes(1)
    expect(dialog.isOpen).toBe(false)
  })

  it('does not run the resume action while merely closing', () => {
    const dialog = useLoginDialogStore()
    const resume = vi.fn<() => void>()

    dialog.open({ onSuccess: resume })
    dialog.close()

    expect(resume).not.toHaveBeenCalled()
    expect(dialog.isOpen).toBe(false)
  })

  it('runs the resume action exactly once', () => {
    const dialog = useLoginDialogStore()
    const resume = vi.fn<() => void>()

    dialog.open({ onSuccess: resume })
    dialog.complete()
    dialog.complete()

    expect(resume).toHaveBeenCalledTimes(1)
  })
})
