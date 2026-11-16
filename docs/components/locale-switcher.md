# LocaleSwitcher

语言切换器：**原生 `<select>`**，外面包一层 `label` 提供可访问名称与图标。实现见 [LocaleSwitcher.vue](../../src/components/ui/LocaleSwitcher.vue)。

使用者：[AppHeader.vue](../../src/components/layout/AppHeader.vue)（紧凑版）、[AuthLayout.vue](../../src/layouts/AuthLayout.vue)（紧凑版）、[settings/index.vue](../../src/views/settings/index.vue)（卡片版）。

## 接口

| 名称      | 类型                  | 说明                               |
| --------- | --------------------- | ---------------------------------- |
| `variant` | `'compact' \| 'card'` | 影响尺寸与选项文案，默认 `compact` |

选项来自 `SUPPORTED_LOCALES`：紧凑版显示短标签，卡片版显示完整语言名。没有 `value`/`change` 对外接口——组件直接调用 `setLocale`。

## 部件与 `data-slot`

| `data-slot`       | 元素     | 说明                                                       |
| ----------------- | -------- | ---------------------------------------------------------- |
| `locale-switcher` | `label`  | 包裹图标、`sr-only` 文本与 `select`，点击区域更大          |
| `locale-select`   | `select` | 原生下拉，保留 `data-testid="locale-switcher"`（E2E 依赖） |

## 行为

- `change` 后调用 `setLocale()`：写入 `localStorage` 的 `orbit.locale.v1` 并同步 `document.documentElement.lang`。界面文案、日期与数字格式由 vue-i18n 响应式更新，文档标题由路由层按 `meta.titleKey` 更新。
- 选择非法值（不在 `SUPPORTED_LOCALES` 内）会被忽略，不做兜底写入。
- 页面上可能同时存在多个实例（顶栏 + 设置页卡片），它们共享同一个 i18n locale，改一处全部同步。E2E 因此用 `.last()` 定位。

## 键盘与可访问性

- 完全复用原生 `select`：方向键、首字母跳转、`Alt+↓`、移动端原生选择器都不需要自己实现。
- 可访问名称来自 `label` 内的 `sr-only` 文本（`common.language`），图标 `aria-hidden`。
- 用的是**包裹式** `label`（不是 `for`/`id`）：`label` 同时是视觉容器，整块都能点。Vue 官方 a11y 指南认为显式 `for`/`id` 对辅助技术更可靠，改成显式关联需要额外套一层容器；当前取舍是包裹 + `sr-only`，可访问名称稳定。换结构时同步更新本文与 `ui-contract.spec.ts`。

## 已知限制

- 不提供"仅某页面生效"的语言覆盖；语言是全局状态。
- 没有隐藏语言入口的机制（例如"界面不提供中文选项，但保留已保存偏好"）；需要时在 `SUPPORTED_LOCALES` 与 `variant` 之外单独设计。
- 采用原生下拉意味着无法做富选项（旗标、分组、搜索）。**不要为了样式把它换成自绘 listbox**：会失去移动端原生选择器，并让 `e2e` 的 `selectOption` 失效。

## 测试

[ui-contract.spec.ts](../../src/__tests__/ui-contract.spec.ts) 断言两个 `data-slot` 与保留的 `data-testid`；切换语言与文案更新的用户路径由 [e2e/settings.spec.ts](../../e2e/settings.spec.ts) 覆盖。
