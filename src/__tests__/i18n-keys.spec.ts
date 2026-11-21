/**
 * i18n key 守卫。
 *
 * 分工说明（避免和已有保护重复）：
 * 1. 两个语言包的 key 一致性**已经由编译器保证**——`zh-CN.ts` 导出 `MessageSchema = typeof zhCN`，
 *    `en-US.ts` 声明 `const enUS: MessageSchema`，任一侧缺 key 都会让 `pnpm type-check` 失败。
 *    下面保留一条运行时断言，只用于拦截 `as MessageSchema` 之类的断言绕过，不是主力判断。
 * 2. 真正没有守卫的是 `t('...')` 的字面量 key：`useI18n()` 的 `t` 签名是 `(key: string) => string`，
 *    拼错 key、或删掉 key 后忘记清理引用，都不会产生 TypeScript 错误，只会在运行时把 key 名
 *    直接渲染到界面上。本文件扫描 `src/` 下的字面量 key 并与 zh-CN 比对。
 *
 * 覆盖边界：动态 key（如 `t(statusI18nKeys.todo)`、`` t(`tasks.${name}`) ``）不在覆盖范围内，
 * 这类调用依赖 `src/constants/` 里的显式映射与 Review 保证。
 *
 * 对应规则：AGENTS.md 红线 4（界面文案一律走 i18n，改文案必须同时改两个语言包）。
 */
import { describe, expect, it } from 'vitest'

import { enUS } from '@/i18n/messages/en-US'
import { zhCN } from '@/i18n/messages/zh-CN'

/**
 * 用 Vite 的 `import.meta.glob` 读源码，而不是 `node:fs`：
 * `tsconfig.typecheck.json` 覆盖 `src/**` 且不引入 Node 类型，用 fs 会让 `pnpm type-check` 报 TS2591。
 */
const SOURCE_FILES = import.meta.glob<string>(['/src/**/*.{vue,ts}', '!/src/**/__tests__/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** `t('a.b')` / `$t("a.b")`；`\b` 确保不误匹配 `format(` 这类以 `t(` 结尾的调用。 */
const LITERAL_KEY_PATTERN = /\bt\(\s*['"]([\w.-]+)['"]/g

type TreeNode = Record<string, unknown>

function flattenKeys(node: TreeNode, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key

    return typeof value === 'object' && value !== null
      ? flattenKeys(value as TreeNode, path)
      : [path]
  })
}

/** 收集源码里所有 `t()` 的字面量 key，附带首次出现的位置，便于定位。 */
function collectLiteralKeys(): Map<string, string> {
  const used = new Map<string, string>()

  for (const [path, source] of Object.entries(SOURCE_FILES)) {
    for (const match of source.matchAll(LITERAL_KEY_PATTERN)) {
      const key = match[1]
      if (!key) continue

      if (!used.has(key)) used.set(key, path.replace(/^\//, ''))
    }
  }

  return used
}

const zhKeys = flattenKeys(zhCN)
const enKeys = flattenKeys(enUS)
const zhKeySet = new Set(zhKeys)
const literalKeys = collectLiteralKeys()
const scannedFileCount = Object.keys(SOURCE_FILES).length

describe('i18n messages', () => {
  it('两个语言包的 key 集合一致（运行时兜底，编译期已由 MessageSchema 保证）', () => {
    const missingInEn = zhKeys.filter((key) => !enKeys.includes(key)).sort()
    const missingInZh = enKeys.filter((key) => !zhKeySet.has(key)).sort()

    expect({ missingInEn, missingInZh }).toEqual({ missingInEn: [], missingInZh: [] })
  })

  it('源码里 t() 的字面量 key 都能在 zh-CN 中解析', () => {
    const unresolved = [...literalKeys.entries()]
      .filter(([key]) => !zhKeySet.has(key))
      .map(([key, file]) => `${key}  (首次出现于 ${file})`)
      .sort()

    expect(unresolved).toEqual([])
  })

  it('扫描本身有产出（目录或正则失效时不能空转通过）', () => {
    // 扫描到 0 个文件或 0 个 key 时上面两条断言都会"通过"，等于守卫失效。用下限把它钉住。
    expect(scannedFileCount).toBeGreaterThan(20)
    expect(literalKeys.size).toBeGreaterThan(50)
  })
})
