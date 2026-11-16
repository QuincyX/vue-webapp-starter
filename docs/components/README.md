# 共享组件行为说明

这里的每一份文档描述**一个共享交互组件的行为契约**：部件结构、`data-slot` / `data-state`、键盘与焦点、ARIA、动效和已知限制。它是这类事实的唯一来源，`architecture.md` 只保留约定与入口，不复制细节。

## 为什么单独成文

- **E2E 与 agent 需要稳定选择器**：模板有 20+ 条用户路径断言，过去只能依赖 class 与中文 `aria-label`。`data-slot` 把"选哪个部件"从样式实现里解耦出来。
- **行为不可视**：焦点陷阱、Escape、滚动锁、焦点归还没有任何截图能证明，只能靠测试和文档一起钉住。
- **规则不该膨胀 AGENTS.md**：AGENTS.md 只留路由与红线；每个组件怎么用、有什么坑写在这里。

## 约定

### `data-slot`

- 根部件用组件名小写连字符：`modal`、`drawer`、`toast`、`task-checkbox`、`theme-toggle`、`locale-switcher`。
- 内部部件用 `<组件>-<部件>`：`modal-panel`、`modal-title`、`toast-close`、`drawer-panel`。
- 一个 `data-slot` 在同一组件实例内不重复；列表项（`toast`）在列表内按项重复。
- E2E 新增断言优先用 `data-slot`；已有 `data-testid` 保留，不为了统一而改（会牵动既有用例）。
- 组件测试用 `data-slot` 定位部件，不要用 class。

### `data-state`

- 只在组件**有状态**时出现，值是有限枚举，不写自由文本。
- 当前值域：`open`、`closed`、`checked`、`unchecked`、`light`、`dark`。
- 需要表达"变体"而不是"状态"时用 `data-variant`（如 toast 的 `success` / `error` / `info`）或 `data-size`（如 modal 的 `sm` / `md` / `lg`）。
- 样式可以据此加钩子，例如 Tailwind 的 `data-[state=checked]:` 变体；不要为状态另造 CSS 类名。

## 索引

| 组件                       | 文档                                       | 行为测试                                                                                                                             |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `BaseModal`                | [base-modal.md](./base-modal.md)           | [base-modal.spec.ts](../../src/__tests__/base-modal.spec.ts)                                                                         |
| `AppSidebar`（移动端抽屉） | [drawer.md](./drawer.md)                   | [tasks.spec.ts](../../e2e/tasks.spec.ts)（E2E）                                                                                      |
| `ToastContainer`           | [toast.md](./toast.md)                     | [ui-contract.spec.ts](../../src/__tests__/ui-contract.spec.ts)                                                                       |
| `TaskCheckbox`             | [task-checkbox.md](./task-checkbox.md)     | [ui-contract.spec.ts](../../src/__tests__/ui-contract.spec.ts)、[task-list-item.spec.ts](../../src/__tests__/task-list-item.spec.ts) |
| `ThemeToggle`              | [theme-toggle.md](./theme-toggle.md)       | [ui-contract.spec.ts](../../src/__tests__/ui-contract.spec.ts)                                                                       |
| `LocaleSwitcher`           | [locale-switcher.md](./locale-switcher.md) | [ui-contract.spec.ts](../../src/__tests__/ui-contract.spec.ts)                                                                       |

## 与 Vue 官方规范的关系

Vue 官方**没有**组件行为契约类规范，也**没有**官方 agent skill（`vuejs` 组织下无 `skills/`，npm 无 `@vue/skill`）。可对照的是四份原则级材料，本节说明哪些照官方、哪些是官方空白处的项目契约：

| 官方材料                                                                                                              | 我们怎么用                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Accessibility 指南](https://vuejs.org/guide/best-practices/accessibility)                                            | 照做：`useId()` 生成关联 id、表单控件显式 `for`/`id`、装饰图标 `aria-hidden`、按钮显式 `type="button"`、语义化 landmark。空白：不涉及 dialog 焦点陷阱、滚动锁、返回焦点、部件命名与状态属性——这些由本目录定义 |
| [Style Guide · Element attribute order](https://vuejs.org/style-guide/rules-recommended.html#element-attribute-order) | `data-slot`/`data-state` 归入 Other Attributes；`vue/attributes-order` 在 `eslint.config.ts` 里提升为 `error`，顺序错了 CI 直接失败                                                                           |
| [Testing 指南](https://vuejs.org/guide/scaling-up/testing)                                                            | 组件测试用 VTU + jsdom、E2E 用 Playwright；"test what a component does, not how it does it"——所以组件测试断 `data-slot`、`data-state` 与可访问名称，不断 class                                                |
| [VTU Crash Course](https://test-utils.vuejs.org/guide/essentials/a-crash-course)                                      | 官方明确建议用 `data-*` 而不是 class/id 做测试选择器（"classes and ids tend to change"）；我们用 `data-slot` 承担结构定位，`data-testid` 只留给已有 E2E                                                       |

查官方原文时用官方给 agent 的入口，不要引用第三方"Vue skill"：`https://vuejs.org/llms.txt`（索引）、`https://vuejs.org/llms-full.txt`（全文）、以及每页的 `*.md`（如 `/guide/best-practices/accessibility.md`）。skills 注册站里标为 "Official" 的 vue skill 实际是 `vercel-labs/json-render` 的 Vue 渲染器说明，与 Vue 工程规范无关。

### 工具提示：a11y lint 的默认值是坑

若引入 `eslint-plugin-vuejs-accessibility`，必须覆盖 `label-has-for` 的默认值：

```js
'vuejs-accessibility/label-has-for': ['error', { required: { some: ['nesting', 'id'] } }]
```

插件默认是 `{ every: ['nesting', 'id'] }`（旧 jsx-a11y 语义，要求两者同时满足），会把"显式 `for`/`id`"这种正确写法也报出来。在本仓库按默认值试跑时 25 处告警里有 22 处是它造成的误报；改成 `some` 后只剩隐藏 file input 与焦点陷阱容器两类提示。该插件目前**不是**本仓库依赖，需要时按 [依赖策略](../engineering.md#7-依赖策略) 评估。

## 什么时候要写新文档

新增共享组件，且它满足**任一条**时才需要：

1. 自带键盘、焦点或滚动行为（打开/关闭、陷阱、roving tabindex）。
2. 有内部状态并暴露 `data-state`。
3. 通过 Teleport、`aria-live` 或焦点归还影响页面其他部分。

纯展示组件（徽标、图标、分割线）和只有透传 class 的包装组件不需要单独文档。

## 维护要求

- 改动组件的行为（键盘、焦点、关闭条件、`data-state` 值域、ARIA 名称）时，**同一次变更**更新对应文档和测试。
- 文档只写"当前实现是什么"和"为什么这样"，不写未来计划；未实现的行为写成"已知限制"。
- 相关约定：[架构说明 §7 新增共享 UI](../architecture.md#7-扩展位置)、[工程说明 §6.2 Vue 与组件](../engineering.md#62-vue-与组件)。
