import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * `BaseModal` 的键盘/焦点/滚动锁契约。这些行为没有视觉断言可以兜底，
 * 只能靠测试钉住；行为变更时必须同步 docs/components/base-modal.md。
 */
function createHarness(options: { autoFocus?: boolean; withFooter?: boolean } = {}) {
  let closeCount = 0

  const Harness = defineComponent({
    setup() {
      const open = ref(false)

      function onClose(): void {
        open.value = false
        closeCount += 1
      }

      return () =>
        h('div', [
          h(
            'button',
            { type: 'button', class: 'trigger', onClick: () => (open.value = true) },
            '打开',
          ),
          h(
            BaseModal,
            {
              open: open.value,
              title: '编辑任务',
              description: '改标题后保存。',
              size: 'lg',
              onClose,
            },
            {
              default: () => [
                h('input', {
                  class: 'title-input',
                  'aria-label': '标题',
                  ...(options.autoFocus ? { 'data-autofocus': '' } : {}),
                }),
                h('button', { type: 'button', class: 'save' }, '保存'),
              ],
              ...(options.withFooter
                ? { footer: () => h('button', { type: 'button', class: 'footer-btn' }, '取消') }
                : {}),
            },
          ),
        ])
    },
  })

  return { Harness, closeCount: () => closeCount }
}

const mounted: VueWrapper[] = []

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

async function flush(): Promise<void> {
  await nextTick()
  await nextTick()
}

async function openModal(wrapper: VueWrapper): Promise<HTMLElement> {
  const trigger = wrapper.get('button.trigger').element as HTMLElement
  trigger.focus()
  await wrapper.get('button.trigger').trigger('click')
  await flush()

  const modals = document.querySelectorAll<HTMLElement>('[data-slot="modal"]')
  const modal = modals[modals.length - 1]
  expect(modal, 'modal did not open').toBeDefined()
  return modal as HTMLElement
}

function within(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector)
  expect(element, `missing element: ${selector}`).not.toBeNull()
  return element as HTMLElement
}

function mountHarness(harness: ReturnType<typeof createHarness>['Harness']): VueWrapper {
  const wrapper = mount(harness, { attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

function dispatchKey(target: Element, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe('BaseModal', () => {
  it('renders the slot/state contract and locks body scroll while open', async () => {
    const { Harness } = createHarness()
    const wrapper = mountHarness(Harness)
    const modal = await openModal(wrapper)

    expect(modal.getAttribute('data-state')).toBe('open')
    const panel = within(modal, '[data-slot="modal-panel"]')
    expect(panel.getAttribute('data-size')).toBe('lg')
    expect(panel.getAttribute('role')).toBe('dialog')
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(within(modal, '[data-slot="modal-title"]').textContent).toContain('编辑任务')
    expect(within(modal, '[data-slot="modal-description"]').textContent).toContain('改标题后保存。')
    expect(within(modal, '[data-slot="modal-close"]').getAttribute('aria-label')).toBe('关闭对话框')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('focuses the first focusable element when no data-autofocus is set', async () => {
    const { Harness } = createHarness()
    const wrapper = mountHarness(Harness)
    const modal = await openModal(wrapper)

    expect(document.activeElement).toBe(within(modal, '[data-slot="modal-close"]'))
  })

  it('prefers the data-autofocus element', async () => {
    const { Harness } = createHarness({ autoFocus: true })
    const wrapper = mountHarness(Harness)
    const modal = await openModal(wrapper)

    expect(document.activeElement).toBe(within(modal, 'input.title-input'))
  })

  it('closes on Escape, restores focus and body scroll', async () => {
    const { Harness, closeCount } = createHarness()
    const wrapper = mountHarness(Harness)
    const modal = await openModal(wrapper)

    dispatchKey(within(modal, '[data-slot="modal-panel"]'), { key: 'Escape' })
    await flush()

    expect(closeCount()).toBe(1)
    expect(document.querySelector('[data-slot="modal"]')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(wrapper.get('button.trigger').element)
  })

  it('wraps Tab from the last element to the first', async () => {
    const { Harness } = createHarness({ withFooter: true })
    const wrapper = mountHarness(Harness)
    const modal = await openModal(wrapper)

    const last = within(modal, '[data-slot="modal-footer"] button')
    last.focus()
    const event = dispatchKey(last, { key: 'Tab' })
    await flush()

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(within(modal, '[data-slot="modal-close"]'))
  })

  it('wraps Shift+Tab from the first element to the last', async () => {
    const { Harness } = createHarness({ withFooter: true })
    const wrapper = mountHarness(Harness)
    const modal = await openModal(wrapper)

    const first = within(modal, '[data-slot="modal-close"]')
    first.focus()
    const event = dispatchKey(first, { key: 'Tab', shiftKey: true })
    await flush()

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(within(modal, '[data-slot="modal-footer"] button'))
  })

  it('renders the footer slot only when one is provided', async () => {
    const withoutFooter = createHarness()
    const first = mountHarness(withoutFooter.Harness)
    const firstModal = await openModal(first)
    expect(firstModal.querySelector('[data-slot="modal-footer"]')).toBeNull()
    first.unmount()

    const withFooter = createHarness({ withFooter: true })
    const second = mountHarness(withFooter.Harness)
    const secondModal = await openModal(second)
    expect(secondModal.querySelector('[data-slot="modal-footer"]')).not.toBeNull()
  })
})
