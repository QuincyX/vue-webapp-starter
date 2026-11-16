# TaskCheckbox

任务行的完成状态开关，用 `button` 模拟 `checkbox` 而不是原生 `input`，以便放进任务行的排版里。实现见 [TaskCheckbox.vue](../../src/components/tasks/TaskCheckbox.vue)，使用者是 [TaskListItem.vue](../../src/components/tasks/TaskListItem.vue)。

## 接口

| 名称      | 类型      | 说明                                         |
| --------- | --------- | -------------------------------------------- |
| `checked` | `boolean` | 完成状态；由任务 Store 派生，组件不自己保存  |
| `title`   | `string`  | 任务标题，用于拼可访问名称                   |
| `toggle`  | emit      | 点击后发出，不带参数；由父组件按任务 id 处理 |

## 部件与状态

| `data-slot`     | 元素     | 说明                                            |
| --------------- | -------- | ----------------------------------------------- |
| `task-checkbox` | `button` | `role="checkbox"`、`aria-checked`、`data-state` |

| 属性         | 值                    | 条件           |
| ------------ | --------------------- | -------------- |
| `data-state` | `checked`/`unchecked` | 跟随 `checked` |

## 键盘与可访问性

- 原生 `button` 语义：`Enter` 与 `Space` 都能切换，不需要自定义按键处理。
- `aria-label` 随状态切换文案（标记完成 / 标记未完成并带任务标题），因此读屏不会只听到"复选框"。
- 点击带 `.stop`，避免冒泡触发任务行的编辑跳转。
- 每行一个独立的 Tab 停靠点；没有实现 roving tabindex 的方向键移动。

## 已知限制

- 没有 `indeterminate`（半选）状态；批量选择场景需要另建组件。
- 视觉勾选由 `Check` 图标 + `text-transparent` 实现，图标本身 `aria-hidden`，状态只由 `aria-checked` 与色彩表达——改动配色时必须保住 3:1 的对比度。
- 没有乐观更新动画；状态回滚由 Store 负责。

## 测试

[ui-contract.spec.ts](../../src/__tests__/ui-contract.spec.ts) 断言 `data-slot`、`data-state` 与 `aria-checked`；[task-list-item.spec.ts](../../src/__tests__/task-list-item.spec.ts) 断言点击后发出 `toggle`。
