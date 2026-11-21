# Agent 工程指南

本文件会被自动加载进每个任务的上下文，因此**只放路由、不可协商的红线和完成标准**。操作细节在 [docs/](./docs/README.md)，新增规则前先过 §3.2。

## 1. 指令优先级与上下文路由

1. 用户当前的明确指令。
2. 本文件。
3. 按任务读取 [docs/](./docs/README.md) 中的对应章节。
4. 其他文档与历史实现。

| 任务类型                         | 读取范围                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent 规则 / 文档治理            | 本文件 + [docs/README.md](./docs/README.md) + [docs/framework-changelog.md](./docs/framework-changelog.md)                                  |
| 功能 / 业务模块                  | [specs/README.md](./specs/README.md) + 目标 feature 的 `spec.md` / `plan.md` / `tasks.md` + 相关源码与测试                                  |
| 页面、组件、i18n 文案            | 相关 view/component + [共享组件行为](./docs/components/README.md) + 两个语言包；用户可见变化再看 README                                     |
| 状态、持久化、API                | [architecture.md §5](./docs/architecture.md#5-状态与数据所有权) + [engineering.md §6.3](./docs/engineering.md#63-状态与持久化) + 代码与测试 |
| 依赖、构建、TypeScript、CI、脚本 | [engineering.md](./docs/engineering.md) + `package.json` + 框架变更记录                                                                     |
| 部署、静态托管                   | [engineering.md §9](./docs/engineering.md#9-ci-与部署) + `deploy/` + README 部署段                                                          |
| 纯示例业务改动                   | 目标 view/component/store + 相关测试                                                                                                        |
| 不确定需要哪些上下文             | 先看 [docs/README.md](./docs/README.md) 的索引，再读目标章节                                                                                |

多领域任务取并集，不要退化为"全部读一遍"。文档与代码不一致时以代码为事实，并在本次变更中修正文档或登记为已知差异。

## 2. 项目定位

这是一个**通用 Vue 3 + Vite + TypeScript 工程模板**，不是某个具体产品的代码仓库。

- 任务工作台是用于展示工程能力的业务示例，不是产品需求的边界；不要把 starter 改造成重业务产品，除非用户明确要求。
- 业务范围以示例任务领域与已确认的 [001 账号模块](./specs/001-account-auth/spec.md) 为限；扩展业务范围需要用户明确要求。
- 新增能力优先沉淀为可复用的框架能力，而不是某个页面的临时补丁。
- PWA 安装与服务端离线外壳已是内置框架能力（[architecture.md §6.8](./docs/architecture.md#68-pwaservice-worker-与安装)），不要为单个示例再建第二套 manifest 或 Service Worker。

## 3. 最高优先级：框架变更必须更新文档

**任何非业务层的框架功能变更，都必须在同一次变更中更新文档。没有更新文档的框架变更是未完成变更。**

框架变更包括：依赖、Node/pnpm、TypeScript、Vite、构建、Lint、格式化、测试工具、路由/状态/API 架构、i18n、主题、全局样式、Design Token、共享布局与 UI 组件、环境变量、配置校验、部署、CI、开发脚本、公共类型与 Schema 约定、目录边界、Agent 规则与文档治理。业务变更仅限示例任务领域（任务字段、示例内容、任务页面交互），不强制写框架变更记录，但影响最终用户时要检查 README 是否仍准确。

编辑前先判断：这是业务还是框架变更（混合按框架处理）；哪些文档会因行为、命令、目录或约束变化失效；验证命令是否变化（变化必须同步 [engineering.md §3](./docs/engineering.md#3-命令) 与 README）。

### 3.1 强制文档更新矩阵

| 变更内容                                                   | 必须更新                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 分层、模块边界、数据流、路由/状态/API 架构                 | `docs/architecture.md` + `docs/framework-changelog.md`                               |
| 脚本、依赖、TypeScript、构建、测试、CI、环境变量、发布流程 | `docs/engineering.md` + `README.md`（涉及使用方式时）+ `docs/framework-changelog.md` |
| Agent 规则、完成定义、文档治理                             | `AGENTS.md` + `docs/engineering.md` + `docs/framework-changelog.md`                  |
| 全局用户可见的框架行为（主题、语言、导航等）               | `README.md` + 对应说明文档 + `docs/framework-changelog.md`                           |
| 共享交互组件的行为、键盘或 ARIA                            | `docs/components/` + 组件测试 + `docs/framework-changelog.md`                        |
| 仅示例任务业务内容                                         | README（仅当功能/截图失效时）                                                        |
| 文档链接/目录调整                                          | `docs/README.md` / `README.md` + `docs/framework-changelog.md`                       |
| 事实归属或去重调整                                         | `docs/README.md` + 受影响的来源文档 + `docs/framework-changelog.md`                  |

记录格式见 [docs/framework-changelog.md](./docs/framework-changelog.md)，只追加、不重写历史。

### 3.2 全局规则准入

`AGENTS.md` 是全局契约，不是操作手册。新增或保留一条规则，必须至少满足一项：

1. 模型无法凭空推断的**项目事实**（命令、目录、发布约定、版本约束）。
2. 必须确定执行的**风险边界**（安全、数据、权限、生产操作）。
3. 有**真实失败样本、回归记录或审计结论**作证据。

写法：触发条件 → 动作/边界 → 验证方式；范围具体；能被命令、测试或 Review 验证。**禁止写入**：泛化行为要求（"认真思考""不要犯错"）、仪式化流程（固定步骤、每步汇报）、DSH 已覆盖的工具能力（读写顺序、搜索、todo、审批、沙箱、后台任务、退出码、文件展示）、只为弥补旧模型缺陷却没有证据的防御规则。

### 3.3 规则生命周期

规则像依赖一样维护：模型 / DSH / TypeScript / Vite / 测试工具升级后、至少每季度、或出现规则冲突与上下文异常增长时审计；删除无证据、重复、过宽或已被工具覆盖的规则；结果写入[变更记录](./docs/framework-changelog.md)。方法见 [engineering.md](./docs/engineering.md#agent-规则生命周期与审计)。

## 4. 架构红线

以下 10 条不可协商，违反其中任何一条都视为未完成。实现约定见 [engineering.md §6](./docs/engineering.md#6-编码约束)。

其中 4 条已由自动门禁拦截，不依赖 Review：红线 1、3 在 `src/views/**`、`src/components/**`、`src/stores/**` 三个范围内由 `eslint.config.ts` 的 `no-restricted-imports` / `no-restricted-globals` / `no-restricted-properties` 拦截（禁 `axios`、`@/api/http`、`@/api/envelope` 与直接读写 storage）；红线 4 由 `src/__tests__/i18n-keys.spec.ts` 拦截（双语包 key 一致由 `MessageSchema` 在编译期保证，测试只管 `t()` 字面量 key 能否解析）；红线 6 由 `src/__tests__/design-tokens.spec.ts` 拦截。其余 5 条仍靠 Review。

1. **视图不直接请求后端**，HTTP 只经 `src/api/`。
2. **数据边界必须过 Zod**：外部响应与导入数据用 `src/types/` 的 Schema 校验，用 `z.infer` 推导公共类型，不复制同结构类型，不把 `unknown` 断言成业务类型。
3. **禁止组件、页面与 Store 直接读写 localStorage**，持久化归 `Repository` 适配器、`src/api/token.ts`、i18n 与主题模块。
4. **界面文案一律走 i18n**，改文案必须同时改 `zh-CN.ts` 与 `en-US.ts`。
5. **路由必须保留 `meta.titleKey`**，页面组件默认懒加载。
6. **共享 UI 用 Design Token 与既有组件模式**，不硬编码品牌色或一次性样式。
7. **不得引入第二套同类基础库**（第二个 HTTP 客户端、状态库、i18n 库等），除非有明确理由并写入变更记录。
8. **页面目录边界**：`/foo` → `src/views/foo/index.vue`（根 `/` 用 `home/`，404 用 `not-found/`）；页面私有的子组件、composables、数据、类型与资源只能被本页面引用；跨页面复用先提升到 `src/components|composables|stores|types|utils/`；路由只引用页面的 `index.vue`。
9. **禁止纯转发组件**：`.vue` 文件不能只是"导入同目录组件 + 原样渲染"。子组件必须由页面模板编排或承担独立职责；`pnpm check:components` 拦截（已并入 `pnpm lint`）。
10. **`v-html` 不得用于渲染不可信内容**（lint 已禁止）。

### 4.1 业务资源切片

新增一个业务资源（一个新的后台模块）时补齐七处，顺序即依赖方向，禁止反向 import：

| 步骤 | 位置                             | 职责                                                      |
| ---- | -------------------------------- | --------------------------------------------------------- |
| 1    | `src/types/<resource>.ts`        | Zod Schema + `z.infer` 类型（含 Draft / List 变体）       |
| 2    | `src/constants/<resource>.ts`    | 枚举、`*I18nKeys` 映射、排序权重                          |
| 3    | `src/data/<resource>.ts`         | 零配置演示数据（可选；仅当示例需要无后端启动）            |
| 4    | `src/api/<resource>.ts`          | Repository 绑定：适配器 + Schema + 存储键；换后端只改这里 |
| 5    | `src/stores/<resource>.ts`       | Setup Store：状态、派生、持久化、错误码                   |
| 6    | `src/components/<resource>/`     | 只被本资源引用的组件（表单、行、徽标）                    |
| 7    | `src/views/<resource>/index.vue` | 页面；路由只引用 `index.vue`                              |

配套两处：`src/router/index.ts` 一条带 `meta.titleKey` 的路由，以及两个语言包的同名段落。

第 4 步不是"写几个请求函数"，而是绑一个 `Repository` 适配器：本地演示用 `localRepository`、接真实后端用 `restRepository`、测试用 `memoryRepository`。Store 只依赖接口，所以换后端只改这一处初始化；契约与迁移步骤见 [数据适配器](./docs/data-adapters.md)。

漏掉 1–3 不会被 `type-check` 发现，只表现为"示例跑不起来"，因此这七处是 Review 与 `specs/NNN-*/plan.md` 的检查项——**不新增脚本**，参照实现是 `tasks` 切片。

### 4.2 列表与筛选状态

带筛选、排序或搜索的列表页，这些状态必须存 URL，用 [`useListQuery()`](./src/composables/useListQuery.ts) 读写，不得用 `ref`——`ref` 刷新即丢、不可分享，而 URL 已经是本项目的深链载体（`?edit=`、`?new=`）。

- 默认值不写进 URL：只有非默认值才出现，页面干净时 URL 没有 query。
- 写入用 `router.replace`，不污染返回栈；文本输入传 `debounceMs` 防抖。
- 只操作 `defaults` 里声明的键，深链参数（`?edit=`、`?new=`）原样保留。
- URL 中不在 `allowed` 白名单里的值回退默认，不信任外部输入。

验证：`e2e/tasks.spec.ts` 的「keeps list filters in the URL across reload」与「leaves query parameters it does not own untouched」。

## 5. 工具链

- 应用编译器固定 **TypeScript 7**（`pnpm exec tsc --version` 为 7.x）；`typescript` 别名（`@typescript/typescript6`）只服务 `vue-tsc` 与 `typescript-eslint` 的 Compiler API。不要删 `@typescript/native`、`typescript` 别名、`types/vue-shim.d.ts`、`tsconfig.typecheck.json`。
- 依赖只用 pnpm，变更走 `pnpm add`/`pnpm remove` 并提交 `pnpm-lock.yaml`；禁止提交 `package-lock.json` / `yarn.lock`。安装策略与升级流程见 [engineering.md §1](./docs/engineering.md#1-环境要求)、[§7](./docs/engineering.md#7-依赖策略)。

## 6. 安全边界

- 只有 `VITE_` 前缀变量可以进入客户端；密钥、支付密钥、私钥不得写入任何前端变量或日志。
- 当前演示把 access token 放在 `localStorage`，这是示例取舍；生产必须改为 HttpOnly Cookie 或等价方案，并在文档中说明。
- 日志、错误上报与 toast 不得输出 token、Cookie、完整请求体或个人信息。

## 7. 工作流程

### 7.1 非平凡任务契约

涉及多个文件、框架/基础设施、API/状态/持久化/权限/安全/性能变更、或预计超过一次验证循环时，先写清契约：

```text
目标：要解决的问题，不写操作步骤。
不可变约束：现有接口、数据、交互、兼容性与禁止改动的范围。
可自主执行：允许读取、编辑、运行本地检查、修复本次改动引入失败的范围。
验收证据：看到什么命令输出、测试结果或行为才算完成。
停止条件：哪些情况必须停下来询问（生产变更、破坏性数据操作、凭据、跨项目改动）。
```

小改动（拼写、链接、单个文案、单行修复）不需要契约。

### 7.2 功能规格（Spec Kit Lite）

非平凡业务功能按 [specs/constitution.md](./specs/constitution.md) 执行：先读 [specs/README.md](./specs/README.md) 判断是否值得写 spec；`spec.md` 只写 What/Why，技术方案进 `plan.md`；`tasks.md` 是跨会话任务源；已完成目录冻结，新需求新建编号并写 `Supersedes`。流程与门禁见 [engineering.md §5](./docs/engineering.md#5-变更分类与文档义务)。纯文案、样式、单组件、明确 bugfix 与工具链升级不创建 spec。

### 不要做

- 不要改与本项目无关的目录。
- 不要为通过检查而删测试、放宽规则或加无依据的忽略项。
- 不要在没有用户要求时启动长期开发服务器（浏览器验证用 `pnpm test:e2e` 自管的服务器）、执行 git commit/push 或改写历史。
- 不要把"文档稍后补"当作可接受的交付状态。

## 8. 完成定义（Definition of Done）

框架变更必须全部满足：

- [ ] 实现符合架构边界与工程约束
- [ ] 同一次变更更新了 `docs/framework-changelog.md` 和矩阵要求的文档
- [ ] `pnpm verify` 通过（= `docs:check` → `format:check` → `lint` → `type-check` → `test:unit:run` → `build`；展开说明见 [engineering.md §4](./docs/engineering.md#4-完整质量门禁)）
- [ ] 涉及 `vite.config.ts`、`deploy/` 或发布脚本时，`bash deploy/build.sh --skip-install` 通过
- [ ] 涉及交互/路由/主题/语言/持久化时，`pnpm test:e2e` 通过
- [ ] 非平凡业务功能有 spec/plan/tasks，`verification.md` 为 `Verified`
- [ ] 未执行的检查、剩余风险、兼容性与回滚影响已说明

业务变更至少通过格式、Lint、类型检查与对应单元/组件测试；影响用户操作时补 E2E。命令与故障处理见 [engineering.md §3](./docs/engineering.md#3-命令)、[§4](./docs/engineering.md#4-完整质量门禁)；事实归属见 [docs/README.md](./docs/README.md#事实归属)。
