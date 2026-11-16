# ThemeToggle

浅色/深色一键切换按钮，出现在顶栏与认证页。实现见 [ThemeToggle.vue](../../src/components/ui/ThemeToggle.vue)，状态来自 [useTheme.ts](../../src/composables/useTheme.ts)。

## 部件与状态

| `data-slot`    | 元素     | 说明                                                          |
| -------------- | -------- | ------------------------------------------------------------- |
| `theme-toggle` | `button` | `aria-label` 与 `title` 随状态切换，`data-state` 反映当前主题 |

| 属性         | 值               | 条件             |
| ------------ | ---------------- | ---------------- |
| `data-state` | `light` / `dark` | 由 `isDark` 派生 |

## 行为

- 点击在 `dark` 与 `light` 之间切换：`isDark` 为真时设为 `light`，否则设为 `dark`。
- **不会切回 `system`**：一旦手动切换，`mode` 就是显式的 `dark`/`light` 并写入 `localStorage` 的 `orbit.theme.v1`。跟随系统只在用户从未手动选择时生效。
- 主题应用是 `useTheme` 的副作用（切 `html.dark`、更新 `meta[name="theme-color"]`），按钮本身不碰 DOM。
- 图标 `Sun` / `Moon` 都是 `aria-hidden`，语义由 `aria-label` 承担（切换到浅色 / 切换到深色）。

## 状态共享

`useTheme` 用 VueUse 的 `createGlobalState`，所有消费者共享同一组 ref 与 effect：在设置页切换，顶栏图标立即同步，不需要事件总线。

## 测试

[ui-contract.spec.ts](../../src/__tests__/ui-contract.spec.ts) 断言 `data-slot`、`data-state`（测试环境的 `matchMedia` 垫片固定返回浅色）与可访问名称；主题持久化由 [e2e/settings.spec.ts](../../e2e/settings.spec.ts) 覆盖。
