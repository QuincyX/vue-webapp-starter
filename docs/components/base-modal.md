# BaseModal

整页阻塞式弹窗：Teleport 到 `body`，带遮罩、标题、描述、正文与可选 footer。实现见 [BaseModal.vue](../../src/components/ui/BaseModal.vue)。

使用者：表单型弹窗（[TaskFormModal.vue](../../src/components/tasks/TaskFormModal.vue)、[LoginDialog.vue](../../src/components/auth/LoginDialog.vue)）与确认型弹窗（[settings/index.vue](../../src/views/settings/index.vue)、[tasks/index.vue](../../src/views/tasks/index.vue)）。

## 接口

| 名称          | 类型                   | 说明                                |
| ------------- | ---------------------- | ----------------------------------- |
| `open`        | `boolean`              | 由父组件控制显隐；`false` 时不渲染  |
| `title`       | `string`               | 必填；同时用于 `aria-labelledby`    |
| `description` | `string?`              | 可选；存在时用于 `aria-describedby` |
| `size`        | `'sm' \| 'md' \| 'lg'` | 面板最大宽度，默认 `md`             |
| `close`       | emit                   | Escape、遮罩点击、关闭按钮都会触发  |

插槽：默认插槽进正文，`footer` 插槽只在传入时才渲染 footer 区域。

## 部件与 `data-slot`

| `data-slot`         | 元素              | 说明                                                               |
| ------------------- | ----------------- | ------------------------------------------------------------------ |
| `modal`             | 最外层 fixed 容器 | 固定 `data-state="open"`（`false` 时整棵不渲染）                   |
| `modal-backdrop`    | 遮罩              | `aria-hidden="true"`，点击关闭                                     |
| `modal-panel`       | `section`         | `role="dialog"`、`aria-modal="true"`、`tabindex="-1"`、`data-size` |
| `modal-header`      | `header`          | 含标题、描述与关闭按钮                                             |
| `modal-title`       | `h2`              | `aria-labelledby` 指向它                                           |
| `modal-description` | `p`               | 仅在传入 `description` 时渲染                                      |
| `modal-close`       | `button`          | `aria-label` 来自 `modal.close`                                    |
| `modal-body`        | 正文容器          | `overflow-y-auto`，高度上限由面板控制                              |
| `modal-footer`      | `footer`          | 仅在传入 `footer` 插槽时渲染                                       |

## 键盘与焦点

- 键盘监听挂在 `modal-panel`（`role="dialog"`）上，不挂在遮罩容器：组件测试要把 `keydown` 派发到 panel 或它的后代。
- `Escape`：关闭并 `stopPropagation`，避免冒泡到外层快捷键处理器。
- `Tab` / `Shift+Tab`：在面板内可聚焦元素之间循环；面板内没有可聚焦元素时把焦点交给面板本身。
- 打开时的焦点顺序：`[data-autofocus]` → 第一个可聚焦元素 → 面板。
- **表单弹窗必须给首个输入框加 `data-autofocus`**：DOM 顺序上标题栏的关闭按钮排在正文之前，不指定就会先落在关闭按钮上。
- 关闭后焦点归还给打开前的元素（通常是触发按钮），并恢复 `body` 原有的内联 `overflow` 值。

## 状态属性

| 属性         | 值             | 条件           |
| ------------ | -------------- | -------------- |
| `data-state` | `open`         | 面板已渲染     |
| `data-size`  | `sm`/`md`/`lg` | 由 `size` 属性 |

## 动效

过渡类 `.modal-enter/leave` 与 `.modal-panel` 位移定义在 [main.css](../../src/assets/main.css)；全局 `prefers-reduced-motion: reduce` 规则把过渡压到 0.01ms，组件本身不判断该媒体查询。

## 已知限制

- **不处理嵌套**：同时打开两个 `BaseModal` 时，后开的不会接管滚动锁，先关闭的那个会把 `body` 滚动提前释放。需要嵌套时先改为单实例 + 内容切换。
- 没有 `beforeClose` 钩子：`close` 只表达意图，脏数据拦截由父组件自己判断。
- 不做初始焦点兜底校验：`data-autofocus` 指向的元素若不可聚焦，会静默退回第一个可聚焦元素。

## 测试

[base-modal.spec.ts](../../src/__tests__/base-modal.spec.ts) 覆盖：`data-slot`/`data-state`/`data-size` 契约、滚动锁、`data-autofocus` 优先级、Escape 关闭与焦点归还、Tab 两个方向的循环、footer 插槽条件渲染。

用户路径由 [e2e/tasks.spec.ts](../../e2e/tasks.spec.ts) 与 [e2e/session-expiry.spec.ts](../../e2e/session-expiry.spec.ts) 覆盖。
