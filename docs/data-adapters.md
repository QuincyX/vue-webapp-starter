# 数据适配器（Repository）

[repository.ts](../src/api/repository.ts) 是数据层的唯一接缝。Store 依赖 `Repository` 接口，具体数据从哪来由**一行初始化**决定：本地存储、真实后端、还是内存。

这样做的目的不是抽象本身，而是让"接后端"成为一次适配器替换，而不是重写 Store 的每个 action。

## 1. 接口

```ts
export interface Repository<T, TInput> {
  list(params?: ListParams, signal?: AbortSignal): Promise<ListResult<T>>
  get(id: string): Promise<T | null>
  create(input: TInput): Promise<T>
  update(id: string, input: TInput): Promise<T>
  remove(id: string): Promise<void>
}
```

五个方法，刻意不做更多。额外能力（整表替换、同步读）挂**适配器自己的类型**上，而不是接口：

```ts
export type LocalRepository<T, TInput> = Repository<T, TInput> & {
  read: () => T[] // localStorage 是同步 API，首屏播种用它
  replaceAll: (rows: T[]) => Promise<void> // 导入 / 清空 / 重置
}
```

原因：REST 适配器**做不到**整表替换。把它留在接口里，换后端时是一次静默的行为变化；放在具体类型上，换后端时是编译错误——在调用点强制你决定"这个演示功能该删还是该改"。

## 2. 三个适配器

| 适配器             | 数据来源                              | 分页/筛选            | 持久化 | 用途                             |
| ------------------ | ------------------------------------- | -------------------- | ------ | -------------------------------- |
| `localRepository`  | `localStorage` + Zod 校验 + seed 回退 | **忽略**，全量返回   | 是     | 无后端的示例资源（当前 `tasks`） |
| `restRepository`   | `request<T>()` → 真实 API             | **转发**到后端 query | 否     | 接真实后端                       |
| `memoryRepository` | 进程内数组                            | 忽略，全量返回       | 否     | 组件测试、零配置演示             |

`localRepository` 与 `memoryRepository` 都需要两件事：`toEntity(input)`（怎么生成 id 与时间戳）与 `merge(current, input)`（怎么把一次编辑合并进实体）。两者都是纯函数，放在资源的 `api/<resource>.ts` 里。

## 3. 绑定一个资源

以任务切片为例（[api/tasks.ts](../src/api/tasks.ts)）：

```ts
export const taskRepository = localRepository<Task, TaskDraft>({
  storageKey: TASKS_STORAGE_KEY,
  schema: taskListSchema,
  seed: createSeedTasks,
  toEntity,
  merge,
})
```

Store 只认接口：

```ts
const tasks = ref<Task[]>(taskRepository.read()) // 首屏同步播种

function hydrate(): Promise<void> {
  hydrating ??= (async () => {
    const { rows } = await taskRepository.list()
    tasks.value = rows
  })()
  return hydrating
}

async function createTask(draft: TaskDraft): Promise<Task> {
  const task = await taskRepository.create(draft)
  tasks.value.unshift(task)
  return task
}
```

派生统计（`stats`、`weeklyActivity` 等）仍基于 `tasks.value` 全量计算——本地适配器返回全量，所以这一层不变。

## 4. 换后端

改 `api/<resource>.ts` 里的初始化，Store 不动：

```ts
export const taskRepository = restRepository<Task, TaskDraft>({
  basePath: '/tasks',
  listSchema: taskListSchema,
  itemSchema: taskSchema,
})
```

随后会有两处编译错误，**这是设计意图**：

| 错误                | 位置                                           | 处理                                             |
| ------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `read` 不存在       | `ref<Task[]>(taskRepository.read())`           | 改成 `ref<Task[]>([])`，让页面 `await hydrate()` |
| `replaceAll` 不存在 | `clearTasks` / `resetDemoData` / `importTasks` | 删掉导入/清空/重置三个演示功能，或改为逐条调用   |

不要为了消掉错误给 `restRepository` 补一个 `read()` 返回空数组——那会把"首屏没有数据"伪装成"数据已就绪"。

## 5. 契约测试

[repository.spec.ts](../src/__tests__/repository.spec.ts) 里的 `runContract()` 是适配器的验收标准：任何声称是 `Repository` 的实现都必须通过同一组断言（list 全量、create 不丢行、get 缺失返回 `null`、update 就地生效并推进更新时间、remove 只删目标行）。

新增适配器时**不要**复制测试，把工厂函数传进 `runContract()` 即可。这条约束的意义是：适配器之间的差异只允许在"额外能力"上，不允许在五个核心方法上。

## 6. 已知边界

- `localRepository` 忽略 `ListParams` 的分页与筛选，全量返回。需要服务端分页时它不适合，直接用 `restRepository`。
- `restRepository` 期望 `list` 返回 JSON 数组、其余返回单个对象。后端用 `{ code, data, message }` 信封时先用 [envelope.ts](../src/api/envelope.ts) 解包。
- 没有乐观更新：写操作等后端返回后再更新 Store 副本。需要乐观 UI 时在 Store 层加，不要在适配器里加——适配器只管"数据从哪来"。
- 没有请求去重/缓存：那属于 Store 或 [localCache](../src/utils/localCache.ts)，见 [架构说明 §6.3](./architecture.md#63-远端-store错误码单飞与缓存)。
