# 架构说明

本文描述 `vue-vite-starter` 的运行时结构、模块职责、数据流和扩展位置。它回答“代码为什么这样分层”和“新功能应该放在哪里”。

> 修改分层、模块边界、路由/状态/API 架构时，必须同步更新本文和 [框架变更记录](./framework-changelog.md)。

## 1. 定位与边界

这是一个浏览器端 SPA 工程模板，当前包含可运行的账号与任务工作台示例：

- 前端：Vue 3 + Vue Router + Pinia + Tailwind CSS
- 数据：任务、主题和语言默认持久化在 `localStorage`；账号身份由鉴权 API 提供；读多写少的数据可经 `src/utils/localCache.ts` 缓存
- 后端：通过 `src/api/` 提供 Axios 请求层；开发/预览/E2E 使用 `server/auth-mock.ts` 的本地 HTTP 适配层，生产需替换真实鉴权服务
- 认证：邮箱 + 密码注册/登录、Bearer 会话、受保护路由、资料与密码修改；不接第三方登录
- 国际化：中英文，运行时切换
- PWA：`vite-plugin-pwa` 生成 manifest 与 Service Worker，应用外壳可离线打开；安装入口在设置页
- 部署：静态资源 + SPA history fallback；生产后端需实现 `/api/auth/*`

当前**不包含**：SSR、第三方 OAuth、邮箱验证、找回密码、MFA、生产数据库、支付、上传和异步生成任务。这些属于产品能力，不应在没有明确需求时自动加入模板。

> 非平凡业务功能的规格、计划、任务和验收记录在 [specs/](../specs/README.md)；其中账号模块见 [001-account-auth](../specs/001-account-auth/spec.md)。

## 2. 运行时的分层

```text
┌──────────────────────────────────────────────┐
│ Views / Layouts / Feature Components         │
│ 页面编排、交互、展示                          │
└───────────────┬──────────────────────────────┘
                │ composables / props / events
┌───────────────▼──────────────────────────────┐
│ Pinia Stores / Composables                   │
│ 认证会话、任务状态、派生数据、持久化、主题     │
└───────────────┬──────────────────────────────┘
                │ typed calls
┌───────────────▼──────────────────────────────┐
│ src/api                                      │
│ Axios 实例、拦截器、错误归一化、信封解包、     │
│ Zod 响应校验                                  │
└───────────────┬──────────────────────────────┘
                │ HTTP
┌───────────────▼──────────────────────────────┐
│ Browser APIs / Auth API / Backend            │
│ localStorage / Intl / SW Cache / /api/*      │
└──────────────────────────────────────────────┘
```

横向支撑：

- `src/i18n/`：语言检测、语言包、`html lang` 与日期格式化
- `src/assets/main.css`：Tailwind、Design Token、基础组件类
- `src/types/`：Zod Schema 与领域类型
- `src/config/env.ts`：环境变量校验
- `src/utils/localCache.ts`：内存 + `localStorage` 的 TTL 缓存
- `src/layouts/`、`src/components/layout/`：应用壳与导航
- `vite.config.ts` 的 `VitePWA`：manifest、预缓存与自动更新

## 3. 目录职责

| 路径                                                        | 职责                                                          | 不应包含                 |
| ----------------------------------------------------------- | ------------------------------------------------------------- | ------------------------ |
| [src/main.ts](../src/main.ts)                               | 创建应用、安装 Pinia/i18n/Router、401 监听、等待路由          | 业务逻辑                 |
| [src/App.vue](../src/App.vue)                               | 根据路由 meta 切换默认/认证布局、全局 Toast                   | 页面级状态               |
| [src/router/](../src/router/)                               | 路由表、懒加载、titleKey、认证守卫、滚动行为                  | 数据请求                 |
| [src/layouts/](../src/layouts/)                             | 默认应用壳与认证页壳、页面标题、全局布局                      | 任务领域逻辑             |
| [src/views/](../src/views/)                                 | 页面目录：`<route>/index.vue` + 页面私有子组件/逻辑/数据      | 跨页面共享组件、全局状态 |
| [src/components/ui/](../src/components/ui/)                 | 跨业务复用 UI（Modal、Toast、切换器、安装入口、全局 loading） | 任务/用户领域状态        |
| [src/components/auth/](../src/components/auth/)             | 就地登录弹窗（会话过期、需要登录的轻量动作）                  | 页面级表单状态           |
| [src/stores/loading.ts](../src/stores/loading.ts)           | 全局阻塞 loading 的任务栈                                     | 业务数据                 |
| [src/stores/login-dialog.ts](../src/stores/login-dialog.ts) | 登录弹窗开关、原因与登录后要续接的动作                        | 表单状态                 |
| [src/components/layout/](../src/components/layout/)         | 顶栏、侧边栏等应用壳组件                                      | 页面级业务规则           |
| [src/components/tasks/](../src/components/tasks/)           | 任务示例领域组件                                              | 全局基础设施             |
| [src/components/brand/](../src/components/brand/)           | 品牌 Logo 与反色变体                                          | 业务状态                 |
| [src/stores/auth.ts](../src/stores/auth.ts)                 | 会话状态、登录/注册/退出、资料/密码、bootstrap                | DOM 操作、HTTP 实现细节  |
| [src/stores/pinia.ts](../src/stores/pinia.ts)               | 单例 Pinia 实例，供 Router 守卫使用                           | 业务状态                 |
| [src/stores/tasks.ts](../src/stores/tasks.ts)               | 任务状态、持久化、统计、导入导出                              | DOM 操作、HTTP 实现细节  |
| [src/stores/health.ts](../src/stores/health.ts)             | **远端 Store 范式**：请求单飞、errorCode、派生状态            | 缓存、路由跳转           |
| [src/api/](../src/api/)                                     | HTTP 客户端、拦截器、错误模型、鉴权/任务接口                  | Vue 组件、Pinia          |
| [src/api/envelope.ts](../src/api/envelope.ts)               | `{ code, data, message }` 类信封的解包与 Schema 校验          | 具体业务字段             |
| [src/i18n/](../src/i18n/)                                   | 语言包、语言状态、locale 持久化                               | 业务状态                 |
| [src/composables/](../src/composables/)                     | 可复用组合式逻辑（表单、API 错误文案、主题、安装引导）        | 页面专属逻辑             |
| [src/types/](../src/types/)                                 | Schema、公共类型、路由 meta 扩展                              | 运行时副作用             |
| [src/data/](../src/data/)                                   | 本地示例数据种子                                              | 生产 API 请求            |
| [src/utils/](../src/utils/)                                 | 无状态工具（日期、格式化、安全 redirect、TTL 缓存）           | 领域状态                 |
| [src/config/](../src/config/)                               | 环境配置校验                                                  | 业务配置                 |
| [server/](../server/)                                       | 仅开发/预览/E2E 的本地鉴权 HTTP 适配层                        | 生产服务端代码           |
| [specs/](../specs/README.md)                                | 功能规格、计划、任务与验收记录                                | 运行时业务代码           |
| [docs/components/](./components/README.md)                  | 共享交互组件的行为契约（`data-slot`、键盘、ARIA、状态属性）   | 实现细节与未来计划       |
| [e2e/](../e2e/)                                             | Playwright 用户路径测试；`fixtures.ts` 提供网络层假接口       | 单元测试                 |
| [src/**tests**/](../src/__tests__/)                         | Vitest 单测与组件测试                                         | E2E                      |
| [types/](../types/)                                         | 仅服务于 TS7 `tsc` 检查的 shim                                | 运行时声明               |
| [scripts/](../scripts/)                                     | 工程校验脚本（文档链接、纯转发组件）                          | 应用运行时代码           |
| [deploy/](../deploy/)                                       | 可复现构建、S3 发布与 Nginx SPA 示例                          | 应用运行时代码           |

## 4. 启动顺序

1. 浏览器加载 [index.html](../index.html)，先绘制内联**静态首屏骨架**：只含布局与色块，不含需要 i18n 的文案，因此 FCP 不等待入口 bundle。
2. 内联脚本读取 `orbit.theme.v1`，在首屏前设置 `.dark`，避免主题闪烁；骨架颜色使用与设计 Token 一致的 oklch 值。
3. [src/main.ts](../src/main.ts) 先调用 `useInstallPrompt().init()`，避免错过一次性 `beforeinstallprompt` 事件。
4. 创建 Vue 应用并安装单例 Pinia。
5. 安装 vue-i18n，初始化当前 locale，设置 `<html lang>`。
6. 安装 Vue Router，注册 `orbit:unauthorized` 监听。
7. 首次导航触发守卫：`useAuthStore(pinia).bootstrap()` 读取 token 并调用 `/auth/me`；未登录访问业务路由时跳转 `/login?redirect=...`。
8. `await router.isReady()` 后挂载 [App.vue](../src/App.vue)，骨架被整体替换。
9. `App.vue` 按 `route.meta.layout` 选择 `DefaultLayout` 或 `AuthLayout`；两个布局都根据 `titleKey` 维护文档标题。登录弹窗按需异步加载，`GlobalLoading` 与 Toast 常驻。
10. 生产构建中 Service Worker 由 `main.ts` 在 `window load` 后的空闲回调里注册（`requestIdleCallback`，3 秒封顶；不支持时退回 1.5 秒定时器），预缓存下载不与首屏争带宽；`vite-plugin-pwa` 通过 `injectRegister: null` 不再注入注册脚本。

> 为什么不在 `router.isReady()` 之前挂载：本模板的布局取决于 `route.meta.layout`，提前挂载会先用错误的布局渲染再切换。骨架已经承担了“首帧可见”的职责，两者叠加反而会引入闪烁。

## 5. 状态与数据所有权

| 数据               | 所有者                                              | 持久化键                | 说明                                                                                  |
| ------------------ | --------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| 任务列表、筛选统计 | [tasks store](../src/stores/tasks.ts)               | `orbit.tasks.v1`        | 经 `taskRepository`（local 适配器）读写；损坏则回退示例数据                           |
| 数据接入方式       | [api/repository.ts](../src/api/repository.ts)       | 无                      | `Repository<T, TInput>` 接缝；local / rest / memory 三适配器                          |
| 当前账号           | [auth store](../src/stores/auth.ts)                 | 无（内存）              | 通过 `/auth/me` 恢复；由 API 提供                                                     |
| Access Token       | [token.ts](../src/api/token.ts)                     | `orbit.access-token.v1` | 仅示例；生产建议 HttpOnly Cookie                                                      |
| 主题模式           | [useTheme](../src/composables/useTheme.ts)          | `orbit.theme.v1`        | `createGlobalState` 单例                                                              |
| 界面语言           | [i18n](../src/i18n/index.ts)                        | `orbit.locale.v1`       | `html lang` 同步更新                                                                  |
| Toast              | [useToast](../src/composables/useToast.ts)          | 无                      | 内存中的全局单例                                                                      |
| 全局阻塞 loading   | [loading store](../src/stores/loading.ts)           | 无（内存）              | 任务栈；并发操作各自持有 id                                                           |
| 登录弹窗           | [login-dialog store](../src/stores/login-dialog.ts) | 无（内存）              | 原因 + 登录后要续接的动作；关闭即清空                                                 |
| 后端连接状态       | [health store](../src/stores/health.ts)             | 无（内存）              | 远端 Store 范式：单飞请求 + errorCode                                                 |
| 读多写少数据缓存   | [localCache](../src/utils/localCache.ts)            | `orbit.cache.v1.*`      | 内存 + localStorage，TTL 默认 30 分钟；**内置工具，示例未使用**，接后端列表时按需接入 |
| 路由状态           | Vue Router                                          | 浏览器 history          | `titleKey` 只存文案 key                                                               |
| 列表筛选状态       | [useListQuery](../src/composables/useListQuery.ts)  | 浏览器 history（query） | 默认值不写入 URL；只操作自己声明的键，深链参数原样保留                                |
| 服务端账号数据     | API 层                                              | `.data/auth-users.json` | 仅本地开发适配层；生产由真实后端数据库负责                                            |

规则：**业务持久化必须在 Store 或明确的基础设施模块中完成，视图不得直接操作业务存储。认证状态只以 Auth Store 为唯一读入口。**

## 6. 关键数据流

### 6.1 本地任务

```text
TasksView / Dashboard
  → useTaskStore action
  → taskRepository（Repository 适配器，默认 localRepository）
      - 读：read() 同步播种首屏；list() 供 hydrate() 单飞补读
      - 写：create / update / remove（replaceAll 仅本地演示工具使用）
  → localStorage（Zod 校验 + 失败回退示例数据）
  → reactive task[]
  → 统计 / 排序 / 周趋势 computed
  → 页面重新渲染
```

读取与导入都经过 `taskListSchema`，保证本地数据、导入数据和表单数据使用一致边界。

Store 不再直接读写 storage：写入统一经 `taskRepository`，Store 只维护响应式副本。换后端只改 [api/tasks.ts](../src/api/tasks.ts) 里 `taskRepository` 的初始化（`localRepository` → `restRepository`），会暴露两处**编译错误**而不是运行时故障——具体是哪两处、怎么处理，见 [数据适配器 §4](./data-adapters.md#4-换后端)。

### 6.2 远程请求

```text
Store / View
  → src/api/*.ts
  → request<T>()
  → Axios request interceptor
      - Bearer token
      - X-Request-Id
      - Accept-Language
  → API
  → response/error interceptor
      - 统一 ApiError
      - shouldClearSession() 判定会话失效 → 清除 token 并派发 orbit:unauthorized
  → Zod 校验响应（或在 envelopeRequest 中与信封解包一起完成）
  → 调用方
```

约束：

- 组件不直接调用 Axios。
- API 响应不直接断言为业务类型。
- API 错误通过 `ApiError.code` 交给 i18n 展示，视图不解析 Axios 内部结构；视图统一用 `useApiError()` 翻译，不要手拼 `apiError.<code>` 模板字符串。
- 会话失效只有 [http.ts](../src/api/http.ts) 的 `shouldClearSession()` 一处判定。后端用业务码或 Cookie 表达未登录时，只改这里，不要在页面里补 401 判断。
- 登录/注册页按 HTTP 状态补充业务错误（401 凭据错误、409 邮箱占用、400 校验失败），集中在 `useLoginForm` / `useRegisterForm`。
- 后端返回 `{ code, data, message }`（或 `{ error, msg, data }`）信封时，用 [envelope.ts](../src/api/envelope.ts) 的 `envelopeRequest()`：解包与 Schema 校验一次完成，业务码失败会归一化为 `ApiError('business')`。
- 请求取消、上传、轮询和幂等属于具体业务协议，应在对应 API 模块中封装，而不是散落在页面。
- **离开 SPA 的第三方跳转地址必须由 API 返回**（OAuth 授权页、支付收银台、分享授权页）：`window.location.assign()` 带不上 `Authorization`、`Accept-Language` 或客户端标识头，前端自行拼接 URL 会在多租户后端上直接 400。做法是先请求接口拿到 `{ url }`（走统一实例与拦截器），再由页面跳转。

### 6.3 远端 Store：错误码、单飞与缓存

```text
Store.check() / Store.loadPage()
  → 已有 in-flight 请求 → 复用同一个 Promise（单飞）
  → src/api/*.ts
  → 成功：写数据 + latency/时间戳
  → 失败：写 errorCode（ApiErrorCode），不保存 error 对象
  → 视图：useApiError().codeToMessage(store.errorCode)
```

[health store](../src/stores/health.ts) 是模板里的最小远端 Store 范例，它示范了四条约定：

1. **单飞**：`inFlight` 让重复点击复用同一个请求，而不是并发打后端。
2. **错误码而非错误对象**：Store 只存 `errorCode` / `requestId`，翻译留给视图。
3. **派生状态**：`isHealthy` / `isLoading` 用 `computed`，组件不重复计算。
4. **不持久化**：健康检查在刷新后没有意义；持久化只用于用户确实拥有的状态。

带筛选或分页的列表还要补两条（模板当前没有此类页面，接第一个真实列表时按此实现）：

- **请求竞态**：每次请求自增 `requestSeq`，响应回来时只有 `seq === requestSeq` 才能写状态，否则丢弃；`finally` 中的 `loading = false` 同样要判断。
- **缓存优先**：先 `localCache.peek(queryKey)` 同步渲染，命中且新鲜则跳过请求；过期则先渲染旧数据再校准，失败时保留旧数据。

缓存配方（`localCache` 只提供机制，规则在调用方）：

1. **键包含全部查询维度**：资源、每一个筛选、关键词、页码、页大小；维度变化时升级前缀版本（如 `lists.v1.*` → `lists.v2.*`），旧条目自然失效，不写迁移代码。
2. **列表按 ID 再索引一份**：一次列表响应同时写“查询键”和“实体 ID 键”，供详情页、站内跳转等“列表外命中”的场景复用（`localCache.setMany([{ key, data }])`）。
3. **只缓存成功且非空的结果**：把“服务暂不可用”固定缓存 30 分钟比不缓存更糟；空列表应继续走网络。
4. **读取时校验结构**：`localCache.peekValidated(key, isT)` 用 Zod 派生的守卫或小型结构检查，结构升级后旧条目视为未命中，而不是渲染缺字段的数据。
5. **stale-while-revalidate**：`peek` 返回 `stale`，调用方先渲染旧数据再校准；失败时保留旧数据。
6. **引用稳定**：内容没变时用 `sameItems(current, next)` 保留原数组引用，避免整页重绘。

约束：**用户拥有的状态（任务、草稿、账号）不得放进 TTL 缓存**——过期删除会导致数据丢失，它们走 Store 的显式 Schema 持久化。

### 6.4 认证与会话

```text
LoginView / RegisterView
  → useAuthStore.login/register
  → src/api/auth.ts
  → POST /api/auth/login|register
  → { token, user }
  → setAccessToken + auth.user
  → router.replace(redirect)

刷新页面
  → router.beforeEach
  → auth.bootstrap()
  → GET /api/auth/me
  → authenticated | guest

任意 API 返回 401（拦截器判定为会话失效）
  → response interceptor 清除 token
  → window 派发 orbit:unauthorized
  → main.ts：若此前确实已登录
       → 清理 Auth Store + 重置 loading 任务栈
       → 打开就地登录弹窗（页面不卸载，已填内容保留）
       → 登录成功 → 关闭弹窗 → 执行页面登记的 onSuccess 续接动作
  → 若当前在登录/注册页 → 只清理状态，不再弹窗
  → 游客（从未登录）→ 仍由路由守卫整页跳转 /login?redirect=<当前路径>
```

- 为什么区分两种失效路径：游客没有可恢复的现场，整页登录墙更明确；已登录用户正在操作，整页跳转会丢失表单，所以用弹窗就地续接。
- 续接动作由知道如何重试的页面登记：例如设置页保存资料时捕获 401，调用 `loginDialog.open({ reason: 'expired', onSuccess: () => saveProfile() })`；后到的调用会替换先到的上下文（全局处理器先开弹窗，页面再补上 `onSuccess`）。
- 不要把重试逻辑放进 HTTP 拦截器：拦截器不知道请求的副作用是否可重放，自动重放写操作可能造成重复提交。

- `requiresAuth`：业务页必须登录。
- `guestOnly`：登录/注册页在已登录时跳回目标页。
- `layout: 'auth'`：登录/注册使用 `AuthLayout`，不渲染侧边栏。
- 已登录用户的 401 不整页跳转：`main.ts` 打开就地登录弹窗，页面保持挂载，登录后执行 `onSuccess` 续接；游客仍走 `redirect` 参数。
- 本地开发鉴权适配层见 [server/auth-mock.ts](../server/auth-mock.ts)，**不是生产后端**；生产必须实现同一 API 契约。

### 6.5 国际化

```text
localStorage / navigator.language
  → i18n/index.ts 选择初始 locale
  → LocaleSwitcher / Settings
  → setLocale()
  → i18n.global.locale
  → 所有 t() / Intl 格式化重新计算
  → html lang + 文档标题 + Accept-Language
```

- 语言包：`src/i18n/messages/zh-CN.ts`、`en-US.ts`。
- `en-US` 受 `MessageSchema` 类型约束，必须覆盖中文语言包的全部键。
- 日期相对文案在 [src/utils/date.ts](../src/utils/date.ts) 中通过全局 i18n 输出。
- 两份语言包必须在同一次变更中更新。

### 6.6 主题

```text
内联脚本（首屏）
  → .dark class

useTheme (createGlobalState)
  → useLocalStorage('orbit.theme.v1')
  → usePreferredDark()
  → isDark computed
  → watchEffect 更新 .dark 与 meta[theme-color]
```

### 6.7 路由与标题

- 所有页面路由使用动态 `import()`。
- `meta.titleKey` 是必填字段；`meta.descriptionKey` 用于说明。
- 业务路由设置 `requiresAuth: true`；登录/注册设置 `guestOnly: true` 与 `layout: 'auth'`。
- 文档标题在 `DefaultLayout` 与 `AuthLayout` 中各维护一次，跟随 `titleKey` 与 locale。
- `scrollBehavior` 负责 savedPosition 和 hash。

### 6.8 PWA、Service Worker 与安装

```text
vite build
  → vite-plugin-pwa（generateSW, autoUpdate）
  → manifest.webmanifest（name 来自 VITE_APP_TITLE，start_url=/?source=pwa）
  → sw.js 预缓存 JS/CSS/HTML/SVG/PNG，navigateFallback=/index.html
  → 不注入注册脚本（injectRegister: null）；main.ts 在 load + 空闲时动态 import('virtual:pwa-register') 注册
  → devOptions 关闭，开发/测试不注册

安装入口
  → main.ts 在挂载前 useInstallPrompt().init()
  → Chromium：捕获 beforeinstallprompt → 设置页「安装到设备」
  → iOS Safari：无该事件 → 显示「分享 → 添加到主屏幕」
  → standalone / 已安装 → 不渲染入口

主题
  → useTheme 同步 meta[theme-color]（浅色 #f6f5f1 / 深色 #111318）
```

约束：

- API 请求不进预缓存：`navigateFallbackDenylist` 排除 `/api/`，离线时接口按错误态处理。
- Service Worker 只在 `pnpm build` 产物中启用；E2E 用 `serviceWorkers: 'block'` 保证可重复。
- 注册延后到空闲：首次访问可能来不及完成预缓存，第二次访问才具备完整离线能力；换来的是首屏不与预缓存抢带宽。
- 更换品牌时只改 `VITE_APP_TITLE`、`index.html` 的 apple 元信息与 `public/icons/*`，不要改动 SW 策略。

## 7. 扩展位置

### 新增页面

页面采用“一个地址一个目录”的结构，路由入口固定为 `index.vue`：

```text
src/views/
├── home/index.vue          # /
├── tasks/index.vue         # /tasks
├── settings/index.vue      # /settings
├── login/index.vue         # /login
├── register/index.vue      # /register
├── not-found/index.vue     # 404
└── foo/                    # /foo
    ├── index.vue           # 页面入口
    ├── components/         # 仅 foo 使用的子组件
    ├── composables/        # 仅 foo 使用的逻辑
    ├── data.ts             # 仅 foo 使用的数据/常量
    └── types.ts            # 仅 foo 使用的类型
```

规则：

1. 新建页面必须创建 `src/views/<page>/index.vue`，目录名对应 URL 路径段；使用 kebab-case。
2. 根路径 `/` 使用 `src/views/home/index.vue`，404 使用 `src/views/not-found/index.vue`。
3. 页面私有的 Vue 子组件、composables、数据、类型和资源都放在该页面目录内，可继续使用子目录；它们只能被当前页面目录引用。
4. **禁止页面目录之间互相导入**，例如 `views/tasks` 不得导入 `views/settings` 的内容。
5. 跨页面复用必须提升到共享层：`src/components/`、`src/composables/`、`src/stores/`、`src/types/`、`src/utils/` 或 `src/api/`。共享层也不得反向导入某个页面目录。
6. 路由只引用页面的 `index.vue`，不得新增 `src/views/FooView.vue` 这类平铺页面文件。
7. 页面入口过大时，将子组件、页面逻辑和数据拆到同目录的 `components/`、`composables/`、`data.ts`、`types.ts`，不要复制到共享层。
8. 在 [router](../src/router/index.ts) 中添加懒加载路由、`titleKey` 与 `requiresAuth`（业务页默认 true）。
9. 在中文和英文语言包中补充路由标题。
10. 业务页使用 `DefaultLayout`；认证页设置 `layout: 'auth'`，不重复实现应用壳。
11. 若改变路由架构或 meta 约定，更新本文与框架变更记录。
12. 非平凡功能先在 [specs/](../specs/README.md) 中完成规格与任务。
13. 禁止纯转发组件：页面入口不得只是 `import Page from './components/Page.vue'` + `<Page />`；页面内容直接写在 `index.vue`，或由页面模板编排有独立职责的子组件。验证命令 `pnpm check:components`（已并入 `pnpm lint`）。

### 新增账号相关能力

1. 身份状态只写入 [auth store](../src/stores/auth.ts)，页面不直接读写 token。
2. API 调用走 [auth.ts](../src/api/auth.ts)，请求/响应均经过 Zod。
3. 会话过期由 Axios 401 拦截器和 `orbit:unauthorized` 事件统一处理。
4. 生产接入时替换 `server/auth-mock.ts` 对应的真实 `/api/auth/*`，并改用更安全的 Cookie 策略。
5. 新增字段或接口时同步 `specs/001-account-auth`、本文、工程说明和框架变更记录。

### 新增 API 模块

1. 在 `src/api/` 添加模块，复用 [http.ts](../src/api/http.ts) 的 `request<T>()`。
2. 用 Zod Schema 校验响应；后端有信封时用 [envelope.ts](../src/api/envelope.ts) 的 `envelopeRequest()`，不要在页面里判断 `payload.code`。
3. 统一抛出 `ApiError`，不要返回 AxiosResponse。
4. 需要新的错误语义时扩展 `ApiErrorCode`，同时更新 [errors.ts](../src/api/errors.ts)、`apiError.*` 双语语言包、本文和变更记录。
5. 会话失效规则变化时只改 `http.ts` 的 `shouldClearSession()`；不要新增第二处 token 清理。
6. **资源型模块优先暴露 `Repository`，而不是散装函数**：按 [数据适配器](./data-adapters.md) 绑一个适配器（本地演示用 `localRepository`，接真实后端用 `restRepository`，测试用 `memoryRepository`），让 Store 依赖接口而不是实现。非资源型（健康探针、鉴权、上传）仍按上面五条写成普通函数模块。

### 新增 Store

1. 业务状态放 `src/stores/`，使用 Setup Store。
2. 派生值用 `computed`，派生统计不要写进组件重复计算。
3. 持久化与远端取数一律经 `Repository`，Store 不直接碰 `localStorage`、`fetch` 或 Axios（见 [数据适配器](./data-adapters.md)）。需要同步首屏时用 `LocalRepository.read()`；需要等请求时用单飞 `hydrate()`。
4. 跨语言的展示文案不进入 Store，由组件通过 i18n 生成。
5. 远端 Store 以 [health.ts](../src/stores/health.ts) 为最小范式：单飞请求、只暴露 `errorCode`、不持久化没有意义的数据；列表类再加请求竞态与缓存优先（见 6.3）。
6. 分页/筛选状态在引入 `useListQuery` 之前仍由页面持有；滚动位置、定时器、`IntersectionObserver` 始终属于页面。

### 新增共享 UI

1. 通用组件放 `src/components/ui/`。
2. 使用 `src/assets/main.css` 中的 Design Token 与 `.btn` / `.card` / `.input` 等既有类。
3. 必须支持键盘焦点、`aria-*` 与 `prefers-reduced-motion`。
4. 不把业务数据或 API 调用塞进共享 UI。
5. 交互组件必须暴露稳定的 `data-slot`（根部件用组件名，内部部件用 `<组件>-<部件>`）；有内部状态的部件用 `data-state` 表达有限枚举值（`open`/`checked`/`light` 等），变体用 `data-variant`、尺寸用 `data-size`。E2E 与服务 agent 靠这些属性定位部件，不依赖 class；已有 `data-testid` 保留，不为了统一而改名。
6. 有键盘/焦点/状态行为的共享组件，必须在 `docs/components/` 写一份行为说明（部件表、键盘、ARIA、状态属性、限制、测试位置），并在行为变化时同批更新；纯展示组件不需要。约定与索引见 [共享组件行为](./components/README.md)。
7. 阻塞式覆盖层（`GlobalLoading`）与就地登录弹窗（`LoginDialog`）已在 `App.vue` 挂载为单例；新页面不要再自建第二套 loading 遮罩或登录弹窗，用 `useLoadingStore().run()` 与 `useLoginDialogStore().open()`。

### 新增语言

1. 新增语言包并满足 `MessageSchema`。
2. 在 `SUPPORTED_LOCALES` 注册。
3. 在 i18n 的 messages 映射中注册。
4. 更新本文、工程说明和变更记录。

## 8. 测试架构

- **单元测试**：纯函数、Schema、Store、API 拦截器、缓存、信封解包、Auth Store。
- **组件测试**：共享 UI 与任务组件的事件契约；弹窗/抽屉类组件额外覆盖焦点、键盘与滚动锁契约（见 [components/](./components/README.md)）。
- **E2E**：按域拆分——`auth`（守卫/回跳/注册/密码/校验）、`session-expiry`（会话过期就地续接、游客登录墙）、`tasks`（任务与移动端抽屉）、`settings`（主题、语言、后端连接成功与失败）、`responsive`（390/768/1440 无横向溢出）。
- **E2E 假接口**：`e2e/fixtures.ts` 通过 `page.route` 在浏览器网络层拦截请求，自动处理 CORS/OPTIONS 与清理；用于模拟超时、5xx、业务错误码等本地 mock 无法表达的情况。
- **公共工具**：`e2e/helpers.ts` 提供登录、清理会话与溢出断言，避免每个 spec 复制。
- **类型检查**：TS7 检查 `.ts` 与配置；`vue-tsc`（TS6 API）检查 SFC 模板。
- **文档检查**：`pnpm docs:check` 校验关键文档、specs 与相对链接有效。
- **结构检查**：`pnpm check:components` 阻止页面入口退化成无逻辑的转发组件（已并入 `pnpm lint`）。

测试策略与命令见 [engineering.md](./engineering.md)。

## 9. 已知约束与技术债

| 约束                      | 影响                               | 处理方式                                                                       |
| ------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| TypeScript 7 + TS6 兼容层 | `tsc` 与 `vue-tsc` 使用不同 API    | 保留别名；上游支持 TS7 后再统一                                                |
| 无 SSR                    | 所有代码可假设浏览器环境           | 不在服务端运行                                                                 |
| 任务数据仅本地            | 多设备/多用户不共享                | 把 `taskRepository` 换成 `restRepository`，见 [数据适配器](./data-adapters.md) |
| 本地鉴权适配层            | 仅开发/预览/E2E 可用，不是生产服务 | 生产实现同一 `/api/auth/*` 契约与数据库                                        |
| Token 存 localStorage     | 生产安全性不足                     | 生产改 HttpOnly Cookie + CSRF 策略                                             |
| 无邮箱验证/找回密码       | 不能直接作为完整生产账号系统       | 需要时作为独立功能规格引入                                                     |
| 语言包同步加载            | 两种语言都进入首屏 chunk           | 语言增多时再按需加载                                                           |
| PWA 预缓存应用外壳        | 发版后首屏可能短暂命中旧 chunk     | `autoUpdate` + `no-cache` 入口文件，见 deploy/publish.sh                       |
| iOS 无安装 API            | 只能引导「添加到主屏幕」           | 保持手动提示，不做强制弹窗                                                     |
| 无服务端渲染              | SEO 能力有限                       | 如需要另立架构变更                                                             |

这些是当前有意的取舍，不是隐式 bug。修改任何一项都必须按 [AGENTS.md](../AGENTS.md) 的矩阵更新文档。

## 10. 相关文档

- [功能规格与流程](../specs/README.md)
- [账号模块规格](../specs/001-account-auth/spec.md)
- [数据适配器](./data-adapters.md)
- [工程说明与约束](./engineering.md)
- [框架变更记录](./framework-changelog.md)
- [Agent 工程指南](../AGENTS.md)
- [项目 README](../README.md)
