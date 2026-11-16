import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import TaskCheckbox from '@/components/tasks/TaskCheckbox.vue'
import LocaleSwitcher from '@/components/ui/LocaleSwitcher.vue'
import ThemeToggle from '@/components/ui/ThemeToggle.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useToast } from '@/composables/useToast'

/**
 * 共享交互组件的 `data-slot` / `data-state` 契约。
 * 约定见 docs/components/README.md：E2E、样式与 agent 依赖这些稳定选择器，
 * `data-testid` 只保留给已有 E2E 用例。
 *
 * 抽屉（`AppSidebar`）依赖路由与 Store，其契约由 e2e/tasks.spec.ts 的移动端用例覆盖。
 */
const wrappers: VueWrapper[] = []

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''

  const { toasts, dismiss } = useToast()
  for (const item of toasts.value) dismiss(item.id)
})

function track(wrapper: VueWrapper): VueWrapper {
  wrappers.push(wrapper)
  return wrapper
}

describe('shared UI slot contract', () => {
  it('TaskCheckbox: data-slot 与 checked/unchecked 状态', () => {
    const off = track(mount(TaskCheckbox, { props: { checked: false, title: '写测试' } }))
    const offBox = off.get('[data-slot="task-checkbox"]')
    expect(offBox.attributes('data-state')).toBe('unchecked')
    expect(offBox.attributes('role')).toBe('checkbox')
    expect(offBox.attributes('aria-checked')).toBe('false')

    const on = track(mount(TaskCheckbox, { props: { checked: true, title: '写测试' } }))
    const onBox = on.get('[data-slot="task-checkbox"]')
    expect(onBox.attributes('data-state')).toBe('checked')
    expect(onBox.attributes('aria-checked')).toBe('true')
  })

  it('ThemeToggle: data-slot 与 light/dark 状态', () => {
    // setup.ts 的 matchMedia 垫片固定返回 matches: false，因此初始为浅色。
    const wrapper = track(mount(ThemeToggle))
    const button = wrapper.get('[data-slot="theme-toggle"]')
    expect(button.attributes('data-state')).toBe('light')
    expect(button.attributes('aria-label')).toBeTruthy()
  })

  it('LocaleSwitcher: 新增 data-slot，保留 E2E 依赖的 data-testid', () => {
    const wrapper = track(mount(LocaleSwitcher))
    expect(wrapper.find('[data-slot="locale-switcher"]').exists()).toBe(true)

    const select = wrapper.get('[data-slot="locale-select"]')
    expect(select.element.tagName).toBe('SELECT')
    expect(select.attributes('data-testid')).toBe('locale-switcher')
  })

  it('ToastContainer: region / toast / close 的 data-slot 与 data-variant', () => {
    const { toast } = useToast()
    toast({ title: '连接失败', description: '请稍后重试', variant: 'error', duration: 0 })

    track(mount(ToastContainer))

    // ToastRegion 通过 Teleport 挂到 body，不在组件根内查询。
    expect(document.querySelector('[data-slot="toast-region"]')).not.toBeNull()
    const item = document.querySelector('[data-slot="toast"]')
    expect(item?.getAttribute('data-variant')).toBe('error')
    expect(item?.getAttribute('data-testid')).toBe('toast')
    expect(document.querySelector('[data-slot="toast-close"]')).not.toBeNull()
  })
})
