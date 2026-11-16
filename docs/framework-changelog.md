# 框架变更记录

本文件只记录**非业务层的框架功能变更**。示例任务页面、任务文案等纯业务调整不在此记录；混合变更按框架变更处理。

## 记录规则

1. 追加，不重写历史。
2. 每条记录必须包含：日期、变更摘要、受影响文档、验证方式。
3. 文档更新与代码变更必须在同一次变更中完成。
4. 若变更推翻旧决策，新增记录并写明替代关系，不删除旧记录。
5. 日期使用 `YYYY-MM-DD`。

新增记录模板：

```md
### [Framework] 变更标题

- 日期：YYYY-MM-DD
- 变更：一句话说明行为/约束变化
- 影响：受影响的模块、命令或兼容性
- 替代：被本条取代的旧记录标题（没有则省略；旧记录不删除）
- 文档：更新了哪些文档
- 验证：执行的命令与结果
```

---

## 2026-11-16

### [Framework] 合并 Dependabot 依赖与 CI actions 升级

- 日期：2026-11-16
- 变更：
  - 合并 Dependabot 的 9 个升级 PR（#18、#17、#15、#14、#7、#1–#4），关闭 #10（`@types/node` 26 major 与 Node 22/24 运行时基线不符）。主要版本：Vue 3.5.45、Vue Router 5.5.1、Vite 8.3.8、Vitest 5.1.0、vue-tsc 3.3.14、ESLint 10.14.0、eslint-plugin-vue 10.12.1、oxlint 1.93.0、Prettier 3.10.1、axios 1.21.1、`@lucide/vue` 1.73.0、jsdom 31.0.1。
  - jsdom 31 在 hoisted `node_modules` 下同时解析出 parse5 8.0.1 与 8.1.x，Vitest forks worker 启动即失败（`this.parser.tokenizer.flushCharacters is not a function`，10 个测试文件全部无法加载）。`pnpm dedupe` 收敛为单一 parse5 8.1.1 后恢复。
  - jsdom 31 的 engines 要求 Node `^22.22.2 || ^24.15.0 || >=26.0.0`，据此同步收紧 `package.json` engines、`.nvmrc`（24.12.0 → 24.15.0）与 `deploy/build.sh` 的 `check_node`；Node 22.18–22.22.1、24.12–24.14 与 25 进入不受支持区间。
  - CI 的 `actions/checkout`、`actions/setup-node`、`actions/upload-artifact` 升到 v7，`pnpm/action-setup` 升到 v6，消除 Node 20 弃用告警。
  - README 版本表中 TypeScript 6 兼容层的 6.0.3 修正为实际锁定的 6.0.2，其余版本号与 `pnpm list` 对齐。
- 影响：所有命令与目录结构不变；`pnpm install` 会在 Node 版本越界时给出 engines 提示，`deploy/build.sh` 直接退出。`@types/node` 继续停在 24.x，待运行时基线升级后再跟进 major。
- 文档：README（环境要求、技术栈版本表）、docs/engineering.md（§1 环境要求）、本条记录。
- 验证：`pnpm install --frozen-lockfile`、`pnpm docs:check`（25 文件）、`pnpm format:check`、`pnpm lint`、`pnpm type-check`、`pnpm test:unit:run`（77 passed）、`pnpm build`、`pnpm test:e2e`（18 passed）、`bash deploy/build.sh --skip-install` 均通过。

### [Framework] 项目标识重命名为 vue-webapp-starter

- 日期：2026-11-16
- 变更：
  - 项目目录 `webapp-vue-template` → `vue-webapp-starter`；`package.json` 的 `name` 由 `orbit-vue-starter` → `vue-webapp-starter`。
  - GitHub 仓库 `QuincyX/webapp-vue-template` → `QuincyX/vue-webapp-starter`，本地 `origin` 同步更新；GitHub 会为旧地址保留重定向，但旧名称已被释放。
  - 应用内产品名 `Orbit`、`orbit.*` 存储键、i18n 文案与演示账号均保持不变，本次只改项目标识。
- 影响：本地已存在的克隆需要执行 `git remote set-url origin git@github.com:QuincyX/vue-webapp-starter.git`（旧地址由 GitHub 重定向兜底）；若有人重新占用旧仓库名，重定向失效。安装、构建、测试命令与目录结构不变。
- 文档：本条记录；`README.md` 标题使用产品名 Orbit，无需改动。
- 验证：`pnpm docs:check`、`pnpm format:check`、`pnpm lint`、`pnpm type-check`、`pnpm test:unit:run`、`pnpm build`；`gh repo view` 确认新仓库名，`git remote -v` 确认 origin 指向新地址。

### [Framework] 规则与规范文档去重审计

- 日期：2026-11-16
- 变更：按 [AGENTS.md §3.2](../AGENTS.md#32-全局规则准入) 的准入标准对全局规则做一次审计，只保留项目事实、风险边界与有证据的失败项。
  - [AGENTS.md](../AGENTS.md) **240 → 136 行**：删除 §1.1「始终遵守」（泛化行为要求）、§7.2「执行流程」六步（仪式化流程，读写顺序与现状检查由 DSH 覆盖）、§9「命令来源」（纯指针，已并入 §8 结尾）；§4 红线合并同义项（原 7 并入 2，`v-html` 从 §6 升为红线 10），条款由 10 条散列压到 9 条实质约束 + 1 条 lint 强制；§5/§6 只留项目事实（TS7 版本与不可删文件、pnpm 锁文件、`VITE_` 前缀、token 取舍、日志脱敏），其余指向 engineering；§3.2 准入与 §3.3 生命周期由 36 行压到 13 行；矩阵补「共享交互组件」一行。
  - [docs/engineering.md](./engineering.md) **422 → 339 行**：删除 §12「完成定义」（与 AGENTS §8 重复）、§11 四条 FAQ（E2E 找浏览器、未翻译 key、`docs:check` 失败、纯转发组件，均与 §4 或红线重复）；§5 业务/框架变更两段改为指针（分类与矩阵归 AGENTS §3）；§6.1–§6.7 删掉与红线逐条重复的条目，只保留操作方法；§7 接收 AGENTS 原有的 pnpm/锁文件/`nodeLinker` 规则；§8 与 §10 合并同类项。
  - [docs/README.md](./README.md)：事实归属新增「不可协商的架构红线 → AGENTS §4」，并新增规则 8「同一规则只写一处」。
  - [README.md](../README.md)：§变更与文档约束 从复述分类与矩阵改为一句结论 + 链接。
- 影响：
  - 规则条款减少约 40%，红线、DoD、门禁命令、真实故障处理一条未丢；安全与数据边界不降级。
  - 归属收敛：红线与准入口径在 AGENTS，操作方法在 engineering，行为契约在 components，用户说明在 README。
  - 章节号调整：AGENTS §3.3→§3.2、§3.4→§3.3、§7.3→§7.2，engineering 中的锚点已同步；`#31-强制文档更新矩阵`、`#71-非平凡任务契约`、`#8-完成定义definition-of-done` 保持不变。
- 文档：AGENTS.md、docs/engineering.md、docs/README.md、README.md、本条记录
- 验证：`pnpm docs:check`（25 文件、205 相对链接）、`pnpm format:check`、`pnpm lint`、`pnpm type-check`、`pnpm test:unit:run`、`pnpm build`、`pnpm test:e2e`（18 passed）；全仓库检索确认无指向已删章节的锚点。

### [Framework] 共享组件与 Vue 官方规范对齐

- 日期：2026-11-16
- 变更：
  - [docs/components/README.md](./components/README.md) 新增"与 Vue 官方规范的关系"：逐条对应官方的 a11y 指南、Style Guide 属性顺序、Testing 指南与 VTU 选择器建议；明确官方没有的部分（dialog 行为契约、部件命名、状态属性）由本目录定义；给出官方 agent 入口 `llms.txt` / `llms-full.txt`，并注明 skills 注册站标为 "Official" 的 vue skill 实际来自 `vercel-labs/json-render`，不是 Vue 官方规范。
  - [eslint.config.ts](../eslint.config.ts) 把 `vue/attributes-order` 从 `flat/recommended` 的 `warn` 提升为 `error`：属性顺序从"建议"变成 CI 门禁，`data-slot`/`data-state` 的放置位置由此强制。提升前用 `--rule` 全量试跑，当前代码零违规。
  - [BaseModal.vue](../src/components/ui/BaseModal.vue) 的键盘监听从遮罩容器移到 `modal-panel`（`role="dialog"`）：监听属于对话框自身，遮罩容器只负责布局；Escape 与 Tab 循环行为不变。
  - [settings/index.vue](../src/views/settings/index.vue) 隐藏的 `input[type="file"]` 补 `:aria-label="t('settings.data.import')"`，让这个由按钮触发的原生控件也有可访问名称（不新增 i18n 键）。
  - 文档补规则与取舍：[engineering.md](./engineering.md) §6.2 增加"表单控件必须有程序化关联的可访问名称"；[base-modal.md](./components/base-modal.md) 记录键盘监听位置；[locale-switcher.md](./components/locale-switcher.md) 记录包裹式 `label` 的取舍。
- 影响：
  - 无用户可见行为与文案变化；所有 `getByLabel` 依赖的可访问名称逐字不变。
  - 新增一条硬约束：Vue 官方属性顺序违规会让 `pnpm lint` 失败。
  - 若后续引入 `eslint-plugin-vuejs-accessibility`，必须覆盖 `label-has-for` 的默认 `{ every: ['nesting', 'id'] }`（旧 jsx-a11y 语义），否则显式 `for`/`id` 的正确写法会被误报——本仓库试跑 25 处告警中 22 处是该误报。
- 文档：
  - [docs/components/README.md](./components/README.md)、[base-modal.md](./components/base-modal.md)、[locale-switcher.md](./components/locale-switcher.md)
  - [docs/engineering.md](./engineering.md)（§6.2）
  - 本条变更记录
- 验证：`pnpm docs:check`、`pnpm format:check`、`pnpm lint`（`vue/attributes-order` 已为 error）、`pnpm type-check`、`pnpm test:unit:run`、`pnpm build`、`pnpm test:e2e`（18 passed）。a11y 试跑复检剩 2 处，均为插件不把 `role="dialog"` 视为 interactive role 的 `no-static-element-interactions` 误报（`BaseModal`、`AppSidebar`）。

### [Framework] 共享组件 `data-slot`/`data-state` 契约与行为文档

- 日期：2026-11-16
- 变更：
  - 共享交互组件统一暴露 `data-slot`：[BaseModal.vue](../src/components/ui/BaseModal.vue)（`modal`、`modal-panel`、`modal-title`、`modal-description`、`modal-close`、`modal-body`、`modal-footer`、`modal-backdrop`、`modal-header`）、[AppSidebar.vue](../src/components/layout/AppSidebar.vue)（`sidebar-desktop`、`drawer`、`drawer-panel`、`drawer-close`、`drawer-backdrop`）、[ToastContainer.vue](../src/components/ui/ToastContainer.vue)（`toast-region`、`toast`、`toast-close`）、[TaskCheckbox.vue](../src/components/tasks/TaskCheckbox.vue)、[ThemeToggle.vue](../src/components/ui/ThemeToggle.vue)、[LocaleSwitcher.vue](../src/components/ui/LocaleSwitcher.vue)（`locale-switcher`、`locale-select`）。
  - 有状态的部件增加 `data-state`（`open`/`closed`/`checked`/`unchecked`/`light`/`dark`），变体与尺寸用 `data-variant`/`data-size`；既有 `data-testid`（`toast`、`locale-switcher`）保留原名，避免改既有 E2E。
  - 新增 [docs/components/](./components/README.md)：约定与索引 + 6 份组件行为契约（modal/抽屉/toast/checkbox/主题/语言），把键盘、焦点、ARIA、状态属性、已知限制从 AGENTS.md 的长规则里分离出来。
  - 新增 [base-modal.spec.ts](../src/__tests__/base-modal.spec.ts)（7 例：`data-slot`/`data-state`/`data-size` 契约、滚动锁、`data-autofocus` 优先级、Escape 与焦点归还、Tab 双向循环、footer 条件渲染）与 [ui-contract.spec.ts](../src/__tests__/ui-contract.spec.ts)（4 例：`data-slot`/`data-state` 契约）。
  - [tsconfig.vitest.json](../tsconfig.vitest.json) 的 `lib` 由 `[]` 改为 `["ES2022", "DOM", "DOM.Iterable"]`：`lib: []` 会退到更旧的默认 lib，让**首个 import SFC 的组件测试**在 `.at()` 等 API 上报 TS2550；这是本次新增组件测试才暴露的存量配置缺口。
- 影响：
  - 组件 DOM 只新增属性，视觉、事件契约、`role` 与可访问名称均未变化；旧选择器（class、`role`、`data-testid`）继续有效。
  - `BaseModal` 的既有行为被写进文档并固定：不处理嵌套弹窗；缺少 `data-autofocus` 时焦点落在标题栏关闭按钮。
  - 新增强制范围：带键盘/焦点/`data-state` 行为的共享组件必须带 `data-slot`，并在 `docs/components/` 有说明；测试用 `data-slot` 定位，不用 class。
- 文档：
  - [docs/architecture.md](./architecture.md)（§3 目录职责、§7 新增共享 UI、§8 测试架构）
  - [docs/engineering.md](./engineering.md)（§6.2 Vue 与组件）
  - [docs/README.md](./README.md)（文档索引与事实归属）
  - [README.md](../README.md)（文档表与工程结构）
  - [AGENTS.md](../AGENTS.md)（§1.2 组件任务的读取路由）
  - [docs/components/](./components/README.md)（新增 7 份）
- 验证：`pnpm docs:check`（25 文件、202 相对链接通过）、`pnpm format:check`、`pnpm lint`（含 `check:components`）、`pnpm type-check`、`pnpm test:unit:run`（14 文件 77 用例通过）、`pnpm build`（PWA 预缓存 46 项）、`pnpm test:e2e`（18 passed）。

## 2026-11-15

### [Framework] 首屏静态骨架与 Service Worker 延后注册

- 日期：2026-11-15
- 变更：
  - [index.html](../index.html) 在 `#app` 内内联静态骨架（顶栏 + 卡片占位，只含布局与色块、不含需要 i18n 的文案），颜色与设计 Token 一致并跟随 `.dark`；入口 bundle 解析前即可绘制首屏。
  - [vite.config.ts](../vite.config.ts) 设置 `VitePWA.injectRegister: null`，不再注入注册脚本；[src/main.ts](../src/main.ts) 改为 `window load` + `requestIdleCallback`（3 秒封顶，退回 1.5 秒定时器）动态 `import('virtual:pwa-register')` 注册。
  - 同一处增加 vue-i18n 编译期开关（关闭全局安装、legacy API 与生产 devtools）；本模板只用 `useI18n()`，`$t` 等全局能力不参与构建。
  - [src/App.vue](../src/App.vue) 的登录弹窗改为 `defineAsyncComponent`，首屏不加载该 chunk；`GlobalLoading` 与 Toast 保持常驻。
- 影响：
  - 首屏不再等待入口 bundle 才开始绘制；首次访问可能来不及完成预缓存，第二次访问才具备完整离线能力。
  - 挂载仍然在 `router.isReady()` 之后：布局依赖 `route.meta.layout`，提前挂载会先渲染错误布局；骨架承担首帧可见职责。
  - 依赖全局 `$t`/`$d` 的写法将不可用（当前代码不存在这种用法）。
- 文档：
  - [docs/architecture.md](./architecture.md)（§3、§4、§5、§6.8）
  - [docs/engineering.md](./engineering.md)（§2.2、§11）
  - [README.md](../README.md)（功能、工程结构、关键设计 §9/§10）
- 验证：`pnpm type-check`、`pnpm lint`、`pnpm test:unit:run`、`pnpm build` 通过；`dist/index.html` 含骨架且不再注入 `registerSW`；`pnpm test:e2e` 18 passed。

### [Framework] 全局阻塞 loading 与就地登录（会话过期续接）

- 日期：2026-11-15
- 变更：
  - 新增 [src/stores/loading.ts](../src/stores/loading.ts)：任务栈式全局 loading（`begin`/`end`/`run`/`reset`），并发与嵌套各自持有 id；新增 [GlobalLoading.vue](../src/components/ui/GlobalLoading.vue)，`role=status`、`aria-busy`、`prefers-reduced-motion`。
  - 新增 [src/stores/login-dialog.ts](../src/stores/login-dialog.ts) 与 [LoginDialog.vue](../src/components/auth/LoginDialog.vue)：`reason: 'expired' | 'required'`、`onSuccess` 续接动作、后到的 `open()` 覆盖上下文。
  - [src/main.ts](../src/main.ts) 的 401 处理分流：已登录用户清理会话并打开弹窗（页面不卸载），游客仍由路由守卫整页跳转；同时重置 loading 任务栈。
  - [src/views/settings/index.vue](../src/views/settings/index.vue) 保存资料捕获 401 时登记 `onSuccess` 重试本次保存；改密与退出登录改用 `loading.run()`。
  - 中英文语言包新增 `globalLoading.*` 与 `auth.dialog.*`。
- 影响：
  - 已登录用户会话过期后不再整页跳 `/login`，表单内容与当前路由保留；登录成功后自动续接被中断的操作。
  - 游客路径不变（`/login?redirect=`）。
  - 登录弹窗在下一次打开时从上一次的上下文开始（关闭即清空）。
- 文档：
  - [docs/architecture.md](./architecture.md)（§3、§5、§6.4、§7、§8）
  - [docs/engineering.md](./engineering.md)（§6.3、§11）
  - [README.md](../README.md)（功能、工程结构、关键设计 §11、测试策略）
- 验证：`pnpm type-check`、`pnpm lint`、`pnpm test:unit:run`（66 项，含 loading 4 项、login-dialog 4 项）、`pnpm build`、`pnpm test:e2e`（18 passed，含 `e2e/session-expiry.spec.ts` 2 项）。

### [Framework] 缓存配方：结构校验与引用稳定

- 日期：2026-11-15
- 变更：
  - [src/utils/localCache.ts](../src/utils/localCache.ts) 新增 `peekValidated(key, isT)`：过期条目也不再直接返回，结构不匹配视为未命中，避免缓存结构升级后渲染缺字段数据。
  - 同文件导出 `sameItems(current, next)`：内容一致时调用方保留原数组引用，减少列表重绘。
  - [docs/architecture.md](./architecture.md) §6.3 将缓存规则收敛为 6 条：全维度键 + 版本前缀、按 ID 再索引、只缓存成功非空、读取校验结构、SWR、引用稳定。
- 影响：`localCache` 的既有 API 与存储键不变；新增两个纯函数，无迁移成本。
- 文档：[docs/architecture.md](./architecture.md)（§6.3）、[docs/engineering.md](./engineering.md)（§6.3）、[README.md](../README.md)。
- 验证：`pnpm test:unit:run`（localCache 10 项，含旧结构拒绝与 `sameItems` 引用判断）、`pnpm type-check`、`pnpm lint`。

### [Framework] dev:proxy 同源代理与发布构建的 API 地址校验

- 日期：2026-11-15
- 变更：
  - 新增 `.env.proxy` 与 `pnpm dev:proxy`（`vite --mode proxy`）：`/api` 代理到 `API_PROXY_TARGET`（默认 `http://127.0.0.1:3000`），该变量无 `VITE_` 前缀、不进入客户端包；该模式不挂载本地鉴权适配层。
  - [deploy/build.sh](../deploy/build.sh) 新增 `--build-only` / `SKIP_TYPE_CHECK=1`（跳过 `pnpm build` 内置类型检查，供 CI 已单独执行 type-check 的流水线使用），并解析 `VITE_API_BASE_URL`：缺失、相对路径或 loopback 时警告，`STRICT_ENV=1` 时失败。
  - [docs/architecture.md](./architecture.md) 新增硬规则：离开 SPA 的第三方跳转地址必须由 API 返回后再跳转，不能前端拼 URL（跳转带不上鉴权与客户端标识头）。
- 影响：多一种 Vite mode；默认 `pnpm dev`/`preview`/E2E 行为不变。发布流水线可用 `--build-only` 避免重复类型检查，同时由 `STRICT_ENV=1` 拦住误配置。
- 文档：[docs/engineering.md](./engineering.md)（§2、§3、§9、§11）、[README.md](../README.md)（快速开始、脚本、环境变量、部署）、[docs/architecture.md](./architecture.md)（§6.2）。
- 验证：`bash -n`、`--help`；`bash deploy/build.sh --skip-install` 通过（Git Bash、Node 24 / pnpm 11）；`STRICT_ENV=1 bash deploy/build.sh --skip-install` 以明确原因退出 1。

### [Docs] 后端待办登记与变更记录的替代字段

- 日期：2026-11-15
- 变更：
  - 新增 [docs/todo/backend.md](./todo/backend.md)：稳定编号（`B1`…）、状态、当前前端行为、期望后端行为、关闭结论；关闭条目保留编号，不复用。
  - [docs/README.md](./README.md) 增加文档索引、事实归属与治理规则各一行。
  - 本文件的记录模板新增 `替代：<旧条目标题>` 字段；推翻旧决策时写替代关系，旧记录不删除。
- 影响：跨团队待办有了单一来源，避免同一个接口问题在 PR、聊天和规格里反复出现。
- 文档：本文、[docs/README.md](./README.md)。
- 验证：`pnpm docs:check` 通过（18 个文档、144 个相对链接）。

---

## 2026-10-30

### [Framework] 组件结构门禁：禁止纯转发组件

- 日期：2026-10-30
- 变更：
  - 新增 `scripts/check-components.mjs`：识别「只 import 同目录组件 + 原样渲染」的空壳 `.vue`。
  - `package.json` 增加 `check:components`，并作为 `pnpm lint` 的第一道检查。
  - AGENTS 架构红线新增第 10 条，写明触发条件、修复动作与验证命令。
- 影响：
  - 页面入口必须是实现本身，不能是 `./components/Page.vue` 的包装。
  - `pnpm lint` 失败原因可能来自结构检查，而不是 Oxlint/ESLint。
- 文档：
  - [AGENTS.md](../AGENTS.md)
  - [docs/architecture.md](./architecture.md#7-扩展位置)
  - [docs/engineering.md](./engineering.md#62-vue-与组件)
  - [README.md](../README.md)
- 验证：`pnpm check:components`（无违规）、`pnpm lint` 通过。

### [Framework] 远端数据层：远端 Store 范式、信封适配器、会话失效单一判定、TTL 缓存

- 日期：2026-10-30
- 变更：
  - 新增 `src/stores/health.ts` 作为远端 Store 参照：请求单飞、只暴露 `errorCode`/`requestId`、派生值用 `computed`、不持久化无意义状态。
  - 设置页「后端连接」改为消费该 Store，删除页面内重复的加载/错误状态管理。
  - 新增 `src/api/envelope.ts`：`{ code, data, message }` / `{ error, msg, data }` 信封解包 + 业务码判定 + Zod 校验，失败归一化为 `ApiError('business')`。
  - `ApiErrorCode` 增加 `business`，中英文语言包新增 `apiError.business`。
  - `src/api/http.ts` 抽出 `shouldClearSession()` 作为唯一的会话失效判定，并导出 `UNAUTHORIZED_EVENT` 供 `main.ts` 使用。
  - 新增 `src/utils/localCache.ts`：内存 + `localStorage` 的 TTL 缓存，提供 `get`/`peek`/`entries`/`setMany`/`clear`。
- 影响：
  - 视图不再拼 `apiError.<code>`，统一走错误码；后端换会话方案时只改 `http.ts` 与 `token.ts`。
  - 用户拥有的状态不得进入 TTL 缓存，避免过期即丢数据。
- 文档：
  - [docs/architecture.md](./architecture.md#5-状态与数据所有权)
  - [docs/architecture.md](./architecture.md#62-远程请求)
  - [docs/architecture.md](./architecture.md#63-远端-store错误码单飞与缓存)
  - [docs/engineering.md](./engineering.md#63-状态与持久化)
  - [docs/engineering.md](./engineering.md#64-api-与数据边界)
  - [README.md](../README.md)
- 验证：`pnpm test:unit:run`（新增 localCache 8 项、envelope 8 项、health 4 项）、`pnpm type-check`、`pnpm lint`、`pnpm build`。

### [Framework] 表单与错误文案复用：useLoginForm / useRegisterForm / useApiError

- 日期：2026-10-30
- 变更：
  - 登录页与注册页的校验、错误归一化、密码可见性状态下沉到 `src/composables/useLoginForm.ts`、`useRegisterForm.ts`。
  - 新增 `src/composables/useApiError.ts`：唯一的 `ApiErrorCode → i18n 文案` 映射入口。
  - 两个页面只保留「成功后 toast + 安全回跳」。
- 影响：
  - 新增就地登录（弹窗、抽屉、会话过期提示）时复用同一套校验，不再复制表单逻辑。
  - 修改错误文案只需改语言包，不再逐页替换。
- 文档：
  - [docs/architecture.md](./architecture.md#64-认证与会话)
  - [docs/engineering.md](./engineering.md#62-vue-与组件)
  - [README.md](../README.md)
- 验证：`pnpm test:unit:run`（新增 useLoginForm 6 项）、`pnpm type-check`、`pnpm lint`、`pnpm test:e2e`（登录/注册/校验路径）。

### [Framework] E2E 重构：按域拆分、网络层假接口、响应式溢出断言

- 日期：2026-10-30
- 变更：
  - `e2e/app.spec.ts` 拆分为 `auth`、`tasks`、`settings`、`responsive` 四个按域用例文件。
  - 新增 `e2e/helpers.ts`（登录、清理会话、横向溢出断言）与 `e2e/fixtures.ts`（`page.route` 假接口，自动处理 CORS/OPTIONS 与清理）。
  - `settings.spec.ts` 使用假接口覆盖后端 5xx 与请求 ID 展示，这是本地 mock 无法表达的路径。
  - `responsive.spec.ts` 在 390/768/1440 断言无横向溢出。
  - `playwright.config.ts` 设置 `serviceWorkers: 'block'`，避免 PWA Service Worker 干扰用例。
- 影响：
  - 新增用例放在对应用例文件；模拟失败用 `api.fail()`，不要改应用代码或 mock 服务端。
  - 布局改动必须通过 `responsive.spec.ts`。
- 文档：
  - [docs/architecture.md](./architecture.md#8-测试架构)
  - [docs/engineering.md](./engineering.md#8-测试约束)
  - [README.md](../README.md)
- 验证：`pnpm test:e2e`（四个用例文件全部通过）。

### [Framework] 发布流水线：deploy/build.sh 与 deploy/publish.sh

- 日期：2026-10-30
- 变更：
  - 新增 `deploy/build.sh`：Node/pnpm 版本闸门、冻结锁文件安装、`STRICT_ENV` 拦截本地 env、清理 `dist/`、执行 `pnpm build`、断言 `dist/index.html` 与 `dist/assets`。
  - 新增 `deploy/publish.sh`：S3 发布并分离缓存策略（`assets/*` immutable，入口/SW/manifest no-cache），支持 `--build`/`--dry-run`/`--delete`。
  - 新增 `deploy/deploy.env.example`；凭据只来自环境变量或已被忽略的 `deploy/deploy.env.local`。
  - CI 增加 `bash -n` 语法检查。
- 影响：
  - 发布不再手敲构建命令；本地 env 覆盖不会静默进入生产产物。
  - 使用其它静态托管时只取 `dist/`，但必须保持同样的缓存分组。
- 文档：
  - [docs/engineering.md](./engineering.md#2-安装与启动)
  - [docs/engineering.md](./engineering.md#3-命令)
  - [docs/engineering.md](./engineering.md#9-ci-与部署)
  - [README.md](../README.md)
- 验证：`bash deploy/build.sh --skip-install` 通过并生成 `dist/`。

### [Framework] PWA：manifest、Service Worker 与安装引导

- 日期：2026-10-30
- 变更：
  - 引入 `vite-plugin-pwa`，生成 manifest、Workbox 预缓存与 `registerSW.js`（`autoUpdate`，开发服务器不注册）。
  - manifest 名称来自 `VITE_APP_TITLE`，`start_url=/?source=pwa`，portrait、standalone，`navigateFallbackDenylist` 排除 `/api/`。
  - 新增 `public/icons/`（192/512 any 与 maskable）与 `public/apple-touch-icon.png`；`index.html` 增加 apple 主屏元信息与 `viewport-fit=cover`。
  - 新增 `src/composables/useInstallPrompt.ts`（Chromium 安装事件、iOS 手动引导、standalone 检测），在 `main.ts` 挂载前初始化。
  - 新增 `src/components/ui/InstallApp.vue`，在设置页按可用性渲染安装入口。
  - `vite.config.ts` 改为函数式配置以读取构建期标题；`vitest.config.ts` 相应解析一次配置再 `mergeConfig`。
  - CI 增加 PWA 产物断言（`manifest.webmanifest`、`sw.js`、图标）。
- 影响：
  - `pnpm build` 产物包含 SW；`pnpm dev` 不注册，不能用于复现 SW 问题。
  - 新增 `vite-plugin-pwa` 依赖；禁止再引入第二个 PWA/SW 插件。
- 文档：
  - [AGENTS.md](../AGENTS.md)
  - [docs/architecture.md](./architecture.md#68-pwaservice-worker-与安装)
  - [docs/engineering.md](./engineering.md#22-pwa-与-service-worker)
  - [docs/engineering.md](./engineering.md#7-依赖策略)
  - [docs/engineering.md](./engineering.md#9-ci-与部署)
  - [README.md](../README.md)
- 验证：`pnpm build`（生成 manifest/sw/图标）、`pnpm test:unit:run`（新增 install prompt 1 项）、`pnpm type-check`、`pnpm lint`、`pnpm test:e2e`。

> 2026-10-30 全部变更的合并验证：`pnpm docs:check`（17 files / 125 links）、`pnpm format:check`、`pnpm lint`（0 warnings / 0 errors，含 `check:components`）、`pnpm type-check`（TS7 + vue-tsc）、`pnpm test:unit:run`（10 files / 56 passed）、`pnpm build`、`bash deploy/build.sh --skip-install`、`CI=true pnpm test:e2e`（16 passed，preview 产物 + 系统 Edge，`PLAYWRIGHT_CHANNEL=msedge`；当前网络无法下载 Playwright 自带 Chromium）。

## 2026-10-27

### [Framework] 页面目录边界：一页一目录，入口固定 index.vue

- 日期：2026-10-27
- 变更：
  - 新增页面目录规范：`/foo` → `src/views/foo/index.vue`；根路径使用 `src/views/home/index.vue`，404 使用 `src/views/not-found/index.vue`。
  - 页面私有的子组件、composables、数据、类型和资源放在该页面目录内，只能被当前页面引用。
  - 禁止页面目录之间互相导入；跨页面复用必须提升到 `src/components/`、`src/composables/`、`src/stores/`、`src/types/`、`src/utils/` 或 `src/api/`。
  - 现有 `DashboardView`、`TasksView`、`SettingsView`、`NotFoundView`、`LoginView`、`RegisterView` 迁移为对应页面目录的 `index.vue`；路由只引用 `index.vue`。
  - 同步更新 AGENTS、架构说明、工程说明、README 结构树和账号模块规格中的路径。
- 影响：
  - 新建页面不得再使用 `src/views/FooView.vue` 平铺文件。
  - 页面目录成为明确边界，跨页面复用需要先上移到共享层。
  - 现有 URL、路由名称、页面行为和测试保持不变。
- 文档：
  - [AGENTS.md](../AGENTS.md)
  - [docs/architecture.md](./architecture.md#7-扩展位置)
  - [docs/engineering.md](./engineering.md#62-vue-与组件)
  - [README.md](../README.md)
  - [.github/pull_request_template.md](../.github/pull_request_template.md)
  - [specs/001-account-auth/plan.md](../specs/001-account-auth/plan.md)
- 验证：`pnpm docs:check`（17 files / 119 links）、`pnpm format:check`、`pnpm lint`（0/0）、`pnpm type-check`、`pnpm test:unit:run`（29 passed）、`pnpm build`、`pnpm test:e2e`（8 passed，CI preview 模式）。

### [Framework] Starter cleanup：移除本地环境文件与废弃文案

- 日期：2026-10-27
- 变更：
  - 删除冗余的本地 `.env`；默认值集中在 `src/config/env.ts`，需要覆盖时使用 `.env.local`。
  - `.env` 加入 Git 忽略，保留 `.env.example`。
  - `index.html` 使用静态 `Orbit` 作为首屏标题，避免无 `.env` 时留下 `%VITE_APP_TITLE%`；运行时标题仍由布局和 `VITE_APP_TITLE` 维护。
  - 删除已废弃的 `validation.name*`、`validation.email*`、`validation.role*` 和 `settings.api.failureDescription` 文案键。
  - 清理 `dist`、`test-results`、`playwright-report`、`.data` 等生成物，保留源码、测试、文档和演示截图。
- 影响：无运行时行为变化；本地覆盖配置改为只使用 `.env.local`。
- 文档：
  - [README.md](../README.md)
  - [docs/engineering.md](./engineering.md)
  - [.gitignore](../.gitignore)
  - [index.html](../index.html)
- 验证：`pnpm docs:check`（17 files / 119 links）、`pnpm format:check`、`pnpm lint`（0/0）、`pnpm type-check`、`pnpm test:unit:run`（29 passed）、`pnpm build`、`pnpm test:e2e`（8 passed）。

### [Framework] Spec Kit Lite：轻量规格驱动流程

- 日期：2026-10-27
- 变更：
  - 新增 `specs/` 目录、流程宪法、spec/plan/tasks/verification 模板与功能索引。
  - 非平凡业务功能采用“规格 → 计划 → 任务 → 验证 → 冻结”的轻量流程，不安装 Spec Kit CLI。
  - `tasks.md` 作为跨会话任务源；已完成 feature 目录冻结，新需求新建编号。
  - `docs:check` 覆盖 `specs/**/*.md`；PR 模板增加规格目录和 `Verified` 状态。
- 影响：Agent 上下文路由增加功能规格；非平凡功能需人工评审 spec/plan；已有 AGENTS/docs 仍是上位约束。
- 文档：
  - [AGENTS.md](../AGENTS.md)
  - [specs/README.md](../specs/README.md)
  - [specs/constitution.md](../specs/constitution.md)
  - [docs/README.md](./README.md)
  - [docs/engineering.md](./engineering.md)
  - [scripts/check-docs.mjs](../scripts/check-docs.mjs)
  - [.github/pull_request_template.md](../.github/pull_request_template.md)
- 验证：`pnpm docs:check`、`pnpm format:check`、`pnpm lint`、`pnpm type-check`

### [Framework] 基础账号鉴权、受保护路由与账号设置

- 日期：2026-10-27
- 变更：
  - 新增邮箱密码注册、登录、会话恢复、退出、显示名称修改和密码修改；不接入第三方登录。
  - 新增 `AuthLayout`、登录/注册页、Auth Store、Axios 鉴权 API、Zod 边界、路由守卫与 401 统一处理。
  - 业务页统一 `requiresAuth`；登录后回到 `redirect`，开放重定向被拒绝。
  - 删除本地 `preferences` Store 与 `orbit.profile.v1` 读取，身份统一由 Auth Store 提供。
  - 新增仅开发/预览/E2E 使用的本地 `/api/auth/*` 适配层；生产必须替换真实后端。
  - 修复健康检查：本地适配层提供 `/api/health`。
- 影响：
  - 应用首次访问需要登录；本地演示账号为 `demo@orbit.app` / `OrbitDemo123!`。
  - 账号数据写入 `.data/auth-users.json`，已 Git 忽略；服务重启后用户保留、会话失效。
  - 生产 token 仍建议改为 HttpOnly Cookie + CSRF；当前 localStorage 仅示例。
- 文档：
  - [README.md](../README.md)
  - [docs/architecture.md](./architecture.md)
  - [docs/engineering.md](./engineering.md)
  - [specs/001-account-auth/spec.md](../specs/001-account-auth/spec.md)
  - [specs/001-account-auth/plan.md](../specs/001-account-auth/plan.md)
  - [specs/001-account-auth/verification.md](../specs/001-account-auth/verification.md)
  - [server/auth-mock.ts](../server/auth-mock.ts)
  - [src/stores/auth.ts](../src/stores/auth.ts)
  - [src/api/auth.ts](../src/api/auth.ts)
  - [.gitignore](../.gitignore)
- 验证：`pnpm docs:check`（17 files / 119 links）、`pnpm format:check`、`pnpm lint`（0/0）、`pnpm type-check`、`pnpm test:unit:run`（29 passed）、`pnpm build`、`pnpm test:e2e`（8 passed，开发与 CI preview 模式）

### [Framework] Agent 规则治理：上下文路由、准入、审计与任务契约

- 日期：2026-10-27
- 变更：
  - 将“每个任务阅读全部工程文档”改为按任务类型的上下文路由。
  - 新增全局规则准入标准，明确禁止模型行为泛化规则、仪式化流程和 DSH 已覆盖的工具规范。
  - 新增规则生命周期与审计机制，规则变更需有证据并记录。
  - 增加文档事实归属表，明确命令、架构、Agent 规则、用户说明和变更历史的唯一来源。
  - 增加非平凡任务契约，要求写清目标、约束、自主范围、验收证据和停止条件。
  - PR 模板增加目标、验收证据、未执行检查和任务契约确认。
- 影响：
  - `AGENTS.md` 不再要求全量阅读文档，不再重复维护完整命令说明。
  - Agent 规则新增、删除或合并必须经过准入与审计。
  - PR 需要提供可复现的验收证据，未执行检查必须说明。
- 文档：
  - [AGENTS.md](../AGENTS.md)
  - [docs/README.md](./README.md)
  - [docs/engineering.md](./engineering.md)
  - [docs/framework-changelog.md](./framework-changelog.md)
  - [README.md](../README.md)
  - [.github/pull_request_template.md](../.github/pull_request_template.md)
- 验证：`pnpm docs:check`、`pnpm format:check`、`pnpm lint`、`pnpm type-check`、`pnpm test:unit:run`、`pnpm build`

## 2026-10-26

### [Framework] 文档治理与 Agent 契约

- 日期：2026-10-26
- 变更：新增 Agent 协作契约、架构说明、工程约束、文档索引、PR 模板和文档链接检查；明确“非业务层框架变更必须同步更新文档”的硬性规则。
- 影响：
  - 后续框架变更必须更新本文件与对应说明文档
  - 新增 `pnpm docs:check`，CI 增加文档链接检查
  - 新增统一的完成定义和质量门禁说明
- 文档：
  - [AGENTS.md](../AGENTS.md)
  - [docs/README.md](./README.md)
  - [docs/architecture.md](./architecture.md)
  - [docs/engineering.md](./engineering.md)
  - [docs/framework-changelog.md](./framework-changelog.md)
  - [README.md](../README.md)
  - [.github/pull_request_template.md](../.github/pull_request_template.md)
- 验证：`pnpm docs:check`、`pnpm format:check`、`pnpm lint`

### [Framework] TypeScript 7 与 TS 6 Compiler API 并存

- 日期：2026-10-26
- 变更：实际应用编译器升级到 TypeScript 7.0.2，通过官方别名方案保留 TS 6.0.x Compiler API，供 `vue-tsc` 与 `typescript-eslint` 使用。
- 影响：
  - `pnpm exec tsc --version` 为 `7.0.2`
  - `pnpm exec tsc6 --version` 为 `6.0.3`
  - `pnpm type-check` 拆分为 TS7 应用/配置检查与 vue-tsc SFC 检查
  - `.vue` 模板检查暂时仍走 TS 6 API
- 文档：
  - [docs/architecture.md](./architecture.md)
  - [docs/engineering.md](./engineering.md)
  - [README.md](../README.md#typescript-7-的官方并存方案)
- 验证：`pnpm type-check`、`pnpm build`、`pnpm test:e2e`

### [Framework] Axios 请求层与拦截器

- 日期：2026-10-26
- 变更：新增 Axios 实例、认证头、`X-Request-Id`、`Accept-Language`、超时、401 处理、`ApiError` 错误归一化、Zod 响应校验示例与 `/health` 设置页入口。
- 影响：
  - 所有后端请求必须经 `src/api/`
  - 视图不得直接使用 Axios 或解析 Axios 错误
  - 新增 `VITE_API_BASE_URL` 与 `VITE_API_TIMEOUT`
- 文档：
  - [docs/architecture.md](./architecture.md)
  - [docs/engineering.md](./engineering.md)
  - [README.md](../README.md#axios-请求层)
  - [.env.example](../.env.example)
- 验证：`pnpm type-check`、`pnpm test:unit:run`、`pnpm build`

### [Framework] 中英文 i18n

- 日期：2026-10-26
- 变更：接入 vue-i18n，新增中英文语言包、语言切换、locale 持久化、`html lang`、文档标题、日期/相对日期/复数格式化，以及请求 `Accept-Language` 同步。
- 影响：
  - 所有用户可见文案必须走 i18n
  - 修改文案必须同时更新 `zh-CN` 与 `en-US`
  - 路由 meta 从 `title` 改为 `titleKey`
- 文档：
  - [docs/architecture.md](./architecture.md)
  - [docs/engineering.md](./engineering.md)
  - [README.md](../README.md#国际化i18n)
- 验证：`pnpm type-check`、`pnpm test:unit:run`、`pnpm build`、`pnpm test:e2e`

### [Baseline] 通用 Vue 工程基线

- 日期：2026-10-26
- 变更：建立 Vue 3 + Vite + Pinia + Vue Router + Tailwind CSS + TypeScript 的工程底座，包含 Zod 边界、Vitest、Playwright、ESLint/Oxlint/Prettier、GitHub Actions、Dependabot、Nginx 部署配置和响应式可访问性示例。
- 影响：作为后续框架变更的初始基线。
- 文档：[README.md](../README.md)
- 验证：`pnpm format:check`、`pnpm lint`、`pnpm type-check`、`pnpm test:unit:run`、`pnpm build`、`pnpm test:e2e`
