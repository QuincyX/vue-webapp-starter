# AppSidebar（移动端抽屉）

应用壳侧边栏：`lg` 及以上是固定侧栏，以下变成从左侧滑出的抽屉。实现见 [AppSidebar.vue](../../src/components/layout/AppSidebar.vue)，唯一使用者是 [DefaultLayout.vue](../../src/layouts/DefaultLayout.vue)。

## 接口

| 名称         | 类型      | 说明                                                        |
| ------------ | --------- | ----------------------------------------------------------- |
| `mobileOpen` | `boolean` | 抽屉显隐；只影响 `lg` 以下的抽屉，桌面侧栏一直渲染          |
| `close`      | emit      | 遮罩点击、关闭按钮、`SidebarContent` 的 `navigate` 都会触发 |

## 部件与 `data-slot`

| `data-slot`       | 元素       | 说明                                                                      |
| ----------------- | ---------- | ------------------------------------------------------------------------- |
| `sidebar-desktop` | `aside`    | 桌面固定侧栏，`hidden lg:flex`；移动端不显示但仍在 DOM                    |
| `drawer`          | 最外层容器 | 仅在 `mobileOpen` 时渲染，`data-state="open"`                             |
| `drawer-backdrop` | 遮罩       | `aria-hidden="true"`，点击关闭                                            |
| `drawer-panel`    | `aside`    | `role="dialog"`、`aria-modal="true"`、`aria-label` 来自 `nav.mobileLabel` |
| `drawer-close`    | `button`   | `aria-label` 来自 `header.closeMenu`                                      |

## 键盘与焦点

- `Tab` / `Shift+Tab`：在面板内可聚焦元素之间循环。
- 打开时聚焦关闭按钮；关闭后焦点归还给打开前的元素。
- **不监听 `Escape`**：与 `BaseModal` 不同，抽屉只靠遮罩点击、关闭按钮或导航关闭。这是当前实现，不是遗漏——移动端以触摸为主。
- **不锁 `body` 滚动**：抽屉打开时背景仍可滚动。需要锁定时要显式加，别假设它已经做了。

## 状态属性

| 属性         | 值     | 条件                          |
| ------------ | ------ | ----------------------------- |
| `data-state` | `open` | 仅在抽屉渲染时出现在 `drawer` |

## 动效

`.drawer-enter/leave` 与 `.drawer-panel` 横向位移定义在 [main.css](../../src/assets/main.css)；`prefers-reduced-motion` 由全局规则统一关闭。

## 已知限制

- 桌面侧栏与抽屉是两套 DOM，`SidebarContent` 被渲染两次；不要在 `SidebarContent` 里放单实例状态。
- 断点切换（`lg`）时抽屉不自动关闭，靠布局隐藏；如果要改这一点，同时要补 `resize` 相关 E2E。

## 测试

行为契约由 E2E 覆盖：[e2e/tasks.spec.ts](../../e2e/tasks.spec.ts) 断言移动端抽屉 `role="dialog"` 与可访问名称，[e2e/responsive.spec.ts](../../e2e/responsive.spec.ts) 断言 390/768/1440 无横向溢出。没有单独的组件测试——它依赖路由与 Store，用 jsdom 搭一套的成本高于收益。
