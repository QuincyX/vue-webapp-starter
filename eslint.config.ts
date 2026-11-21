import { globalIgnores } from 'eslint/config'
import pluginVitest from '@vitest/eslint-plugin'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from 'eslint-config-prettier/flat'
import pluginOxlint from 'eslint-plugin-oxlint'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVue from 'eslint-plugin-vue'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores([
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
  ]),

  ...pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,

  {
    name: 'app/vue-rules',
    files: ['src/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'error',
      // Vue 官方 Style Guide 的属性顺序（`data-*` 属 Other Attributes）；flat/recommended 只给 warn。
      'vue/attributes-order': 'error',
    },
  },

  // 边界守卫（一）：红线 1 —— 视图、组件与 Store 不得直接请求后端，HTTP 只经 `src/api/`。
  // 允许 import `@/api/<resource>`（业务函数）。禁 axios、http/envelope 底层设施，以及
  // 从 barrel `@/api` 取 `http`/`request`（否则 barrel 就是这条红线的绕过路径）。
  {
    name: 'app/boundaries-no-direct-http',
    files: ['src/views/**/*.{vue,ts}', 'src/components/**/*.{vue,ts}', 'src/stores/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message:
                '视图、组件与 Store 不得直接请求后端：HTTP 只经 src/api/（AGENTS.md 红线 1）。',
            },
            {
              name: '@/api',
              importNames: ['http', 'request'],
              message:
                '禁止从 barrel 导入 http / request（红线 1 的绕过路径）：用 src/api/<resource> 暴露的 Repository 或业务函数。',
            },
          ],
          patterns: [
            {
              group: ['@/api/http', '@/api/envelope'],
              message:
                '视图、组件与 Store 不得直接使用 http 实例或信封解包：在 src/api/ 暴露 Repository 或业务函数（AGENTS.md 红线 1）。',
            },
          ],
        },
      ],
    },
  },

  // 边界守卫（二）：红线 3 —— 禁止组件/页面直接读写 localStorage。
  // 持久化归 Store、`src/api/token.ts`、i18n 与主题模块；`no-restricted-globals` 管裸标识符，
  // `no-restricted-properties` 管 `window.localStorage` 这类属性访问（两条规则互不覆盖）。
  {
    name: 'app/boundaries-no-direct-storage',
    files: ['src/views/**/*.{vue,ts}', 'src/components/**/*.{vue,ts}', 'src/stores/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            '禁止直接读写 localStorage：持久化归 Repository 适配器 / src/api/token.ts / i18n / 主题模块（AGENTS.md 红线 3）。',
        },
        {
          name: 'sessionStorage',
          message:
            '禁止直接读写 sessionStorage：持久化归 Repository 适配器 / src/api/token.ts / i18n / 主题模块（AGENTS.md 红线 3）。',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'localStorage',
          message:
            '禁止直接读写 localStorage：持久化归 Repository 适配器 / src/api/token.ts / i18n / 主题模块（AGENTS.md 红线 3）。',
        },
        {
          object: 'window',
          property: 'sessionStorage',
          message:
            '禁止直接读写 sessionStorage：持久化归 Repository 适配器 / src/api/token.ts / i18n / 主题模块（AGENTS.md 红线 3）。',
        },
        {
          object: 'globalThis',
          property: 'localStorage',
          message:
            '禁止直接读写 localStorage：持久化归 Repository 适配器 / src/api/token.ts / i18n / 主题模块（AGENTS.md 红线 3）。',
        },
      ],
    },
  },

  // 红线 6（不硬编码颜色）不在这里拦：`VLiteral` 在 vue-eslint-parser 的模板 AST 上不可靠匹配，
  // 改用 `src/__tests__/design-tokens.spec.ts` 对 `.vue` 源码做文本扫描，覆盖静态 class 与内联 style。

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
)
