# 工程说明与约束

本文是开发、评审和自动化执行的操作手册。Agent 的协作规则见 [AGENTS.md](../AGENTS.md)，系统结构见 [架构说明](./architecture.md)。

## 1. 环境要求

| 项       | 要求                                        |
| -------- | ------------------------------------------- |
| Node.js  | `^22.18.0 \|\| >=24.12.0`，推荐 Node 24 LTS |
| pnpm     | `>=11`，仓库固定 `11.28.5`                  |
| 包管理器 | 仅 pnpm；使用 `pnpm-lock.yaml`              |
| 浏览器   | 最近两个大版本的 evergreen 浏览器           |

项目在 `pnpm-workspace.yaml` 中固定了 `nodeLinker: hoisted`，用于兼容 Windows 上不擅长处理符号链接的工具链。不要随意改回 isolated。

## 2. 安装与启动

```bash
corepack enable
corepack prepare pnpm@11.28.5 --activate
pnpm install
pnpm dev
```

本地开发地址为 `http://localhost:5173`，生产预览为 `http://localhost:4173`。

需要对接真实后端时用同源代理模式，浏览器始终停在 `5173`，后端无需为本地来源配置 CORS：

```bash
pnpm dev:proxy   # vite --mode proxy
```

- 目标来自 `.env.proxy` 的 `API_PROXY_TARGET`（默认 `http://127.0.0.1:3000`），无 `VITE_` 前缀，不会进入客户端包。
- 该模式不挂载本地鉴权适配层；`/api` 请求全部转发到真实后端。
- `pnpm dev` / `pnpm preview` 仍使用本地适配层，两者互斥。

不要在仓库中提交 `node_modules/`、`dist/`、覆盖率、Playwright 报告或缓存。

### 2.1 本地鉴权适配层

当前仓库没有生产后端，`pnpm dev` 与 `pnpm preview` 通过 [server/auth-mock.ts](../server/auth-mock.ts) 挂载 `/api/auth/*` 与 `/api/health`：

- 演示账号：`demo@orbit.app` / `OrbitDemo123!`
- 注册数据写入 `.data/auth-users.json`（已 Git 忽略）
- 密码使用 Node `scrypt` + 随机 salt 哈希
- 会话 token 只存在进程内存，默认 7 天；服务重启后需重新登录
- 用户数据在服务重启后保留
- 该适配层只在 Vite 开发/预览服务器中运行，不进入前端 bundle

**这不是生产鉴权服务。** 生产静态部署必须由真实后端实现同一契约，包括数据库、限流、审计、邮件、Cookie/CSRF 和密钥管理。接口契约见 [001 账号模块计划](../specs/001-account-auth/plan.md#数据与接口)。不接入第三方登录。

### 2.2 PWA 与 Service Worker

- `vite-plugin-pwa` 只在 `pnpm build` 产物中生成与注册 Service Worker（`registerType: 'autoUpdate'`）。
- 注册被有意延后：`injectRegister: null` 关闭插件注入，[src/main.ts](../src/main.ts) 在 `window load` 后的空闲时调用 `requestIdleCallback`（3 秒封顶，不支持时退回 1.5 秒定时器）再动态 `import('virtual:pwa-register')`，预缓存不与首屏抢带宽。
- 因此首次访问可能来不及完成预缓存，二次访问才具备完整离线能力；这是性能取舍，不是缺陷。
- 开发服务器不注册（`devOptions.enabled = false`），因此 `pnpm dev` 不会出现旧壳缓存问题。
- 验证安装与离线能力必须用生产产物：

```bash
pnpm build
pnpm preview
```

- 桌面 Chromium：地址栏出现安装图标，或设置页「安装到设备」；iOS Safari 只能走「分享 → 添加到主屏幕」。
- E2E 通过 `serviceWorkers: 'block'` 屏蔽 SW，保证用例可重复；需要验证 SW 时单独跑手工检查，不要塞进主用例。
- 应用外壳离线可打开，`/api/*` 不在预缓存内，离线时接口按错误态处理。

## 3. 命令

| 命令                     | 用途                                                 | 是否进入 CI           |
| ------------------------ | ---------------------------------------------------- | --------------------- |
| `pnpm dev`               | Vite 开发服务器（本地鉴权适配层）                    | 否                    |
| `pnpm dev:proxy`         | 同源代理到真实后端（`.env.proxy`）                   | 否                    |
| `pnpm build`             | 类型检查 + 生产构建                                  | 是                    |
| `pnpm preview`           | 预览生产产物                                         | E2E 的 CI 路径        |
| `pnpm docs:check`        | 关键文档存在性与相对链接检查                         | 是                    |
| `pnpm check:components`  | 纯转发组件检查（lint 的第一道）                      | 是（并入 lint）       |
| `pnpm format:check`      | Prettier 检查                                        | 是                    |
| `pnpm format`            | 格式化并写回                                         | 否                    |
| `pnpm lint`              | Oxlint + ESLint，只检查                              | 是                    |
| `pnpm lint:fix`          | 自动修复可修复问题                                   | 否                    |
| `pnpm type-check`        | TS7 应用/配置检查 + Vue SFC 检查                     | 是                    |
| `pnpm type-check:app`    | 使用 TS7 检查 `.ts`                                  | 否                    |
| `pnpm type-check:node`   | 使用 TS7 检查 Node 配置                              | 否                    |
| `pnpm type-check:vue`    | 使用 vue-tsc 检查 SFC（TS6 API）                     | 是（并入 type-check） |
| `pnpm test:unit`         | Vitest watch                                         | 否                    |
| `pnpm test:unit:run`     | 单测单次运行                                         | 是                    |
| `pnpm test:coverage`     | V8 覆盖率                                            | 否                    |
| `pnpm test:e2e`          | Playwright，自动管理服务器                           | 是                    |
| `pnpm test:e2e:ui`       | Playwright UI 调试                                   | 否                    |
| `bash deploy/build.sh`   | 可复现发布构建（校验环境+构建，支持 `--build-only`） | 否（本地/发布流水线） |
| `bash deploy/publish.sh` | 上传 dist/ 到 S3（缓存策略分组）                     | 否                    |

## 4. 完整质量门禁

框架变更在本地提交前至少执行：

```bash
pnpm docs:check
pnpm format:check
pnpm lint            # 含 check:components
pnpm type-check
pnpm test:unit:run
pnpm build
```

涉及发布流程、`vite.config.ts` 或 `deploy/` 时，再执行一次发布构建脚本，确认环境校验与产物断言未被破坏：

```bash
bash deploy/build.sh --skip-install
```

涉及路由、交互、主题、语言或持久化时，再执行：

```bash
$env:CI = "true"                 # PowerShell，模拟生产预览
pnpm test:e2e
```

本地没有 Playwright Chromium 且网络受限时：

```powershell
pnpm exec playwright install chromium
# 或复用系统浏览器
$env:PLAYWRIGHT_CHANNEL = "msedge"
pnpm test:e2e
```

## 5. 变更分类与文档义务

分类标准、文档更新矩阵与"文档必须同批交付"的硬性要求只维护在 [AGENTS.md §3](../AGENTS.md#31-强制文档更新矩阵)。本节只说明按变更类型要跑什么。

- **业务变更**（仅示例任务领域）：格式、Lint、类型检查与相关测试；影响用户可见功能时检查 README 与截图。
- **框架变更**：完整质量门禁（§4）+ [框架变更记录](./framework-changelog.md) + 矩阵要求的文档。
- 事实权威来源见 [文档事实归属表](./README.md#事实归属)；命令、CI、环境变量与发布流程只在本文件维护。

### Agent 规则生命周期与审计

`AGENTS.md` 中的全局规则会进入所有任务上下文，因此必须像依赖一样审计，而不是只增不减。新增规则先通过 [全局规则准入](../AGENTS.md#32-全局规则准入)。

审计触发时机：

- 模型、DSH、TypeScript、Vite、测试工具或主要依赖升级后
- 至少每季度一次
- 出现规则冲突、反复过早停止、重复读取、上下文异常增长等信号时

审计方法：

1. 列出 `AGENTS.md`、`docs/` 和任务模板中的强制规则。
2. 标记重复、冲突、适用范围过宽、已被 DSH 或 lint/test 门禁覆盖、没有证据的条目。
3. 只保留项目事实、风险边界和有证据的失败检查；其余删除或合并，同一规则只留一处，其他地方给链接。
4. 将规则变更、理由和验证结果写入 [框架变更记录](./framework-changelog.md)。

不要因为“规则看起来专业”而保留它；也不要因为某次模型表现好就删除安全性或数据边界。规则变更必须有证据，且保持可回滚。

### 功能规格流程（Spec Kit Lite）

非平凡业务功能使用 [specs/](../specs/README.md) 中的轻量 SDD 流程。目标是减少需求歧义和跨会话漂移，不是给每个任务增加仪式。

| 阶段 | 产物                     | 门禁                                      |
| ---- | ------------------------ | ----------------------------------------- |
| 规格 | `specs/NNN-slug/spec.md` | 目标、非目标、P1 故事和验收场景经人工确认 |
| 计划 | `plan.md`                | 复用现有架构，列明文件、测试和文档影响    |
| 任务 | `tasks.md`               | 任务可追溯到 spec/plan，含精确路径        |
| 实现 | 代码 + 勾选 tasks        | 按 P1 切片验收                            |
| 收敛 | `verification.md`        | 验收场景有命令、测试或人工证据            |

规则：

- 不要求安装 Spec Kit CLI，也不要求完整 `/speckit-*` 九步流程。
- `spec.md` 只写 What/Why，技术方案放 `plan.md`，项目约束仍以 `AGENTS.md` / `docs/` 为准。
- `tasks.md` 是跨会话任务源；当前会话 todo 只作为执行镜像。

## 6. 编码约束

### 6.1 TypeScript

- 使用严格模式；不要用 `any`、`@ts-ignore` 或关闭 strict 绕过问题，未知数据用 `unknown` 经 Zod 收窄。
- 公共类型从 Schema 推导（`z.infer`）；路径别名统一用 `@/`。
- 实际编译器是 TS 7，Vue SFC 暂时由 TS 6 API 兼容层检查；兼容层文件不可删，理由见[架构说明](./architecture.md#9-已知约束与技术债)。

### 6.2 Vue 与组件

- 使用 Composition API + `<script setup lang="ts">`；Props/emits 用类型声明。
- 页面目录、入口与跨页复用规则见 [AGENTS.md 红线 8](../AGENTS.md#4-架构红线)，纯转发组件见[红线 9](../AGENTS.md#4-架构红线)。
- 共享 UI 放 `src/components/ui/`，应用壳放 `src/components/layout/`，任务示例组件放 `src/components/tasks/`；可复用逻辑放 `src/composables/`，不复制到多个页面。
- 共享交互组件必须暴露 `data-slot`（根部件用组件名，内部部件用 `<组件>-<部件>`）；有内部状态的用 `data-state` 表达有限枚举，变体用 `data-variant`、尺寸用 `data-size`。E2E 与组件测试优先用 `data-slot` 定位，不用 class；已有 `data-testid` 保留。
- 有键盘、焦点或 `data-state` 的共享组件，必须在 `docs/components/` 有行为说明并在行为变化时同批更新；组件测试要钉住焦点/键盘契约，不能只测渲染。
- 表单控件必须有程序化关联的可访问名称：优先显式 `for`/`id`（动态 id 用 `useId()` 生成）；整块可点击的控件可以用包裹式 `label`；`display: none` 的原生控件（如 `input[type="file"]`）用 `aria-label` 兜底。
- 复杂交互必须考虑键盘、焦点、屏幕阅读器和 reduced motion；共享组件不得直接发起 HTTP 请求。

### 6.3 状态与持久化

- Pinia Store 使用 Setup Store。
- 持久化键必须带版本号，并写明在 [架构说明](./architecture.md#5-状态与数据所有权)。
- 读取持久化数据必须通过 Schema 校验，失败要安全回退。
- 读多写少的数据（列表、目录、字典）可用 `src/utils/localCache.ts`：键必须包含全部筛选维度、只缓存成功非空结果、读取用 `peekValidated` 校验结构、列表内容不变时用 `sameItems` 保留引用；**用户拥有的状态不得进 TTL 缓存**。
- 阻塞式操作（退出登录、改密、支付等）用 `useLoadingStore().run()`，不要各自维护遮罩布尔值；并发/嵌套操作靠任务栈管理，不允许在页面里直接操作 DOM 遮罩。
- 会话失效的就地续接由 `useLoginDialogStore()` 承载：需要续接的页面在捕获 401 时 `open({ reason: 'expired', onSuccess })`；HTTP 拦截器只负责派发事件与清 token，不做重试。
- 远端 Store 参考 [health.ts](../src/stores/health.ts)：请求单飞、只暴露 `errorCode`、派生值走 `computed`；列表另加请求竞态与缓存优先，详见 [架构说明](./architecture.md#63-远端-store错误码单飞与缓存)。
- 主题和语言是基础设施状态，分别由 `useTheme`、i18n 模块管理。
- 当前账号是服务端会话状态，由 [Auth Store](../src/stores/auth.ts) 唯一持有；不写入本地 profile 存储。
- 旧 `orbit.profile.v1` 不再读取；不要为兼容旧示例资料新增迁移层。

### 6.4 API 与数据边界

- 错误统一为 `ApiError`，使用 `code` 做 i18n 展示；视图用 `useApiError()` 翻译，不手拼 `apiError.<code>`。
- 组件不得感知 Axios 的 error/config/response 结构。
- 后端使用 `{ code, data, message }` / `{ error, msg, data }` 信封时，用 `src/api/envelope.ts` 的 `envelopeRequest()` 解包并校验；不要在页面里判断业务码。
- 会话失效只由 `src/api/http.ts` 的 `shouldClearSession()` 判定；不要新增第二处 token 清理或 401 判断。
- 新增环境变量必须同时更新：
  - `env.d.ts`
  - `src/config/env.ts`
  - `.env.example`
  - [README](../README.md#环境变量)
  - [工程说明](./engineering.md)（如有新约束）
- 仓库不提交 `.env`；默认值在 `src/config/env.ts`，本地覆盖使用 `.env.local`。

### 6.5 i18n

- 日期、时间、货币和相对时间必须使用当前 locale。
- 新增语言必须更新 `SUPPORTED_LOCALES`、语言包和文档。

### 6.6 样式与设计系统

- 优先使用 Tailwind 工具类和 `main.css` 中的 Design Token。
- 共享组件不要硬编码一次性品牌色；优先语义色（`primary`、`muted`、`border` 等）。
- 新增全局 CSS 只用于 Token、基础层、可复用的组件类，不放页面专属样式。
- 必须保留深色模式与 `prefers-reduced-motion` 行为。

### 6.7 安全

通用边界（`VITE_` 前缀、`v-html`、日志脱敏、token 取舍）见 [AGENTS.md §6](../AGENTS.md#6-安全边界)；本节只记项目特有约定。

- 本地鉴权适配层使用 scrypt 哈希和随机 token，但仍是开发工具，不得作为生产服务部署。
- 登录失败返回通用凭据错误，不暴露邮箱是否存在；注册重复邮箱例外（409）。
- Service Worker 只预缓存构建产物，不缓存 API 响应、token 或用户数据；`/api/` 已在 `navigateFallbackDenylist` 中排除。

## 7. 依赖策略

- 新增依赖前先确认现有库能否解决；明确用途并写入框架变更记录。同类基础库不重复引入（[AGENTS.md 红线 7](../AGENTS.md#4-架构红线)）。
- 依赖只用 pnpm：安装/移除走 `pnpm add` / `pnpm remove` 并提交 `pnpm-lock.yaml`；不手工编辑锁文件，不提交 npm/yarn 锁文件；保持 `pnpm-workspace.yaml` 的 `nodeLinker: hoisted`（Windows 兼容），改回 isolated 前要在 Windows 与 CI 复验。
- 当前唯一的构建期框架依赖是 `vite-plugin-pwa`（manifest + Workbox 预缓存）。不要再用第二个 PWA/SW 插件；需要自定义 SW 逻辑时改它的 `workbox` 配置，而不是另建 `public/sw.js`。
- 大版本升级：读 breaking changes → 更新锁文件 → 跑完整门禁与 E2E → 更新 README、工程说明与变更记录。
- Dependabot 更新视为代码变更，同样需要 Review 与验证。

## 8. 测试约束

- 新增纯函数、Schema、Store、API 拦截器行为：必须有单元测试。
- 修改共享组件事件契约：必须有组件测试。
- 修改用户路径、路由、持久化、主题或语言：必须有 E2E。
- Bugfix 优先补回归测试。
- 测试必须可重复：不依赖真实外部网络、系统时间或本地机器路径；`localStorage` 必须清理，时间用 fake timers。
- E2E 使用本地鉴权适配层；`demo@orbit.app` 只读使用，注册/改密场景使用唯一邮箱，避免污染演示账号。
- `.data/auth-users.json` 不进入版本库；测试不得依赖其中已有的非演示账号。
- E2E 按域拆分（`auth`/`tasks`/`settings`/`responsive`），公共步骤放 `e2e/helpers.ts`，不要复制登录流程。
- 需要模拟失败、超时或业务错误码时，用 `e2e/fixtures.ts` 的 `api.fail()` / `api.mock()` 在网络层拦截；**不要为了测试修改应用代码**，也不要依赖 mock 服务端新增“仅测试”接口。
- 布局改动必须跑 `responsive.spec.ts`（390/768/1440 无横向溢出）；新增页面时把该页纳入溢出断言。

## 9. CI 与部署

CI 在 `.github/workflows/ci.yml` 中按顺序执行：

1. 安装依赖（frozen lockfile）
2. 验证 TS7 / TS6 版本
3. 文档链接检查
4. 格式检查
5. Lint
6. 类型检查
7. 单元测试
8. 构建
9. Playwright E2E
10. 失败时上传 Playwright 报告

CI 额外执行 `bash -n deploy/build.sh` / `bash -n deploy/publish.sh` 语法检查，避免发布脚本在真正发布时才发现错误。

发布流程：

```bash
bash deploy/build.sh --with-tests   # 校验 Node/pnpm、冻结锁文件安装、清理 dist、构建、断言产物
bash deploy/build.sh --build-only   # 跳过 pnpm build 里的类型检查（CI 已单独跑过 type-check）
bash deploy/publish.sh              # 上传 S3（需要 S3_BUCKET）
```

- `deploy/build.sh` 不读 stdin，`STRICT_ENV=1` 时遇到 `.env.local` 直接失败，避免本地调试配置进入生产产物。
- `deploy/build.sh` 会解析 `VITE_API_BASE_URL`：未设置、相对路径或指向 loopback 时给出警告，`STRICT_ENV=1` 时直接失败——产物能在生产打开、但所有请求打错地址，是这类模板最贵的配置事故。
- `deploy/publish.sh` 分离缓存策略：`assets/*` 为 `immutable`（1 年），`index.html` / `sw.js` / `registerSW.js` / `workbox-*.js` / `manifest.webmanifest` 为 `no-cache`，其余 1 小时。
- 不使用 S3 时，把 `dist/` 交给任意静态托管，SPA fallback 参考 [deploy/nginx.conf](../deploy/nginx.conf)；history 路由必须回退到 `index.html`。
- 账号模块要求生产环境提供真实 `/api/auth/*` 与 `/api/health`；本地 Vite 插件不会进入静态产物。
- 部署行为变化必须更新 README 和本文。

## 10. Pull Request 要求

模板见 [`.github/pull_request_template.md`](../.github/pull_request_template.md)：变更摘要、业务/框架分类、文档更新勾选、执行的验证命令、验收证据与未执行检查、风险与回滚。非平凡任务附 [任务契约](../AGENTS.md#71-非平凡任务契约)。Reviewer 发现框架变更缺文档时直接要求补充，不合并后补。

## 11. 常见问题

### TS7 与 vue-tsc 版本不一致

这是有意的并存方案，不是配置错误。检查：

```bash
pnpm exec tsc --version    # 7.x
pnpm exec tsc6 --version   # 6.0.x
```

### `pnpm install` 在 Windows 失败

确认 `pnpm-workspace.yaml` 仍是 `nodeLinker: hoisted`，并使用支持的 Node 版本。

### E2E 打开的是另一个应用

`playwright.config.ts` 在非 CI 模式下 `reuseExistingServer: true`，并且固定使用 5173。若同机还有别的 Vite 项目占用该端口，用例会连到那个应用并在登录页超时（典型现象：出现不属于本模板的弹窗或文案）。

处理：确认 `lsof -nP -iTCP:5173 -sTCP:LISTEN` 指向本仓库；或直接用 CI 模式跑生产预览（4173，不复用已有服务）：

```bash
CI=true pnpm test:e2e
```

### 首屏一直停在骨架上

骨架来自 `index.html` 的内联标记，Vue 挂载后被替换。若一直不消失：

1. 打开控制台确认 `/src/main.ts`（开发）或入口 chunk（生产）已加载且无语法错误。
2. `await router.isReady()` 会等待首次导航，首次导航包含 `auth.bootstrap()`；后端不可达时请求会一直挂起到超时。检查 `VITE_API_BASE_URL` 与网络面板。
3. 不要通过删除骨架来“修复”白屏：先定位入口或首次导航的失败。

### `pnpm dev:proxy` 请求 404 或连到错误后端

`dev:proxy` 会关闭本地鉴权适配层，把所有 `/api` 转发到 `.env.proxy`（或 `.env.proxy.local`）中的 `API_PROXY_TARGET`。确认目标服务监听在该地址，且路径前缀与 `VITE_API_BASE_URL` 一致。

### 发布后仍看到旧页面 / 静态资源 404

1. 确认入口文件是 `no-cache`：`index.html`、`sw.js`、`registerSW.js`、`workbox-*.js`、`manifest.webmanifest`。
2. 确认 `assets/*` 是 `immutable`，且部署时没有把新 `index.html` 与旧 `assets/` 混在一起。
3. 本地复现用 `pnpm build && pnpm preview`，`pnpm dev` 不注册 Service Worker，无法复现此类问题。
4. 浏览器已安装的旧 SW 需要一次刷新完成 `autoUpdate`；必要时在 DevTools → Application → Service Workers 中注销后重试。
