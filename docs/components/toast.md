# ToastContainer

全局轻提示：单例挂在 [App.vue](../../src/App.vue)，数据来自 [useToast.ts](../../src/composables/useToast.ts) 的模块级状态。

## 用法

```ts
const { toast } = useToast()
toast('已保存')
toast({ title: '连接失败', description: '请稍后重试', variant: 'error' })
```

`duration` 默认：`error` 6000ms、其余 4000ms；传 `0` 表示不自动关闭。

## 部件与 `data-slot`

| `data-slot`    | 元素     | 说明                                                                |
| -------------- | -------- | ------------------------------------------------------------------- |
| `toast-region` | `ol`     | 固定右下（移动端贴底），`aria-live="polite"`、`aria-atomic="false"` |
| `toast`        | `li`     | 每条通知；带 `data-variant`，保留 `data-testid="toast"`             |
| `toast-close`  | `button` | `aria-label` 来自 `toast.close`                                     |

## 状态属性

| 属性           | 值                           | 条件           |
| -------------- | ---------------------------- | -------------- |
| `data-variant` | `success` / `error` / `info` | 每条通知的变体 |

## 交互与可访问性

- 不抢焦点、不锁滚动：提示是旁路信息，不能打断正在输入的表单。
- 新通知通过 `aria-live="polite"` 区域播报；`aria-atomic="false"` 让读屏只读新增条目。
- 关闭按钮在 Tab 序列里可达；没有 `Escape` 批量关闭，也不做悬停暂停。
- 图标是 `aria-hidden`，语义只靠标题与描述文本，因此标题必须自带信息量（"已保存"而不是"成功"）。

## 已知限制

- 通知数组是模块级 `ref`，跨组件实例共享；单元测试必须显式清空（见 `ui-contract.spec.ts` 的 `afterEach`）。
- 没有暂停计时、没有最大条数上限；数量失控时靠调用方控制。
- 不渲染富内容（按钮/链接），需要操作入口时用页面内提示，不要塞进 toast。

## 测试

[ui-contract.spec.ts](../../src/__tests__/ui-contract.spec.ts) 断言 `toast-region` / `toast` / `toast-close` 的 `data-slot`、`data-variant` 与保留的 `data-testid`；用户路径由 [e2e/settings.spec.ts](../../e2e/settings.spec.ts) 覆盖（连接成功提示）。
