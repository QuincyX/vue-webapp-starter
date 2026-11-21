/**
 * Design Token 守卫。
 *
 * 对应规则：AGENTS.md 红线 6（共享 UI 用 Design Token 与既有组件模式，不硬编码品牌色）。
 *
 * 为什么是文本扫描而不是 ESLint：色值一半出现在模板静态属性（`class="bg-[#fff]"`），
 * 一半在内联 style 与脚本字符串。模板 AST 的 `VLiteral` 在 vue-eslint-parser 上不可靠匹配
 * （实测 v10 下 selector 不命中），因此这里对 `.vue` 源码做文本扫描，两条路径一起覆盖。
 *
 * 为什么用 `import.meta.glob` 而不是 `node:fs`：`tsconfig.typecheck.json` 覆盖 `src/**` 且不引入
 * Node 类型，用 fs 会让 `pnpm type-check` 报 TS2591。
 *
 * 允许的写法：`src/assets/main.css` 的语义 Token（`bg-background`、`text-primary`、`border-border`）、
 * Tailwind 透明度修饰（`bg-primary/10`）、`data-state` 驱动的变体类。
 *
 * 行内豁免：确实需要用字面色值的行，在该行（或上一行）写 `design-token: allow` 并说明理由。
 */
import { describe, expect, it } from 'vitest'

const VUE_FILES = import.meta.glob<string>('/src/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** 十六进制色值：3/4/6/8 位，前面不能是 `url(` 这类 SVG 引用。 */
const HEX_COLOR_PATTERN = /(?<!url\()#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g

/** 函数式色值。`var(--x)` 是 Token，不在此列。 */
const FUNCTIONAL_COLOR_PATTERN = /\b(?:rgba?|oklch|oklab|hsla?)\(/g

const ALLOW_DIRECTIVE = 'design-token: allow'

interface Violation {
  file: string
  line: number
  text: string
}

function scanFile(path: string, source: string): Violation[] {
  const violations: Violation[] = []
  const lines = source.split(/\r?\n/)
  const file = path.replace(/^\//, '')

  lines.forEach((line, index) => {
    const previous = index > 0 ? (lines[index - 1] ?? '') : ''
    if (line.includes(ALLOW_DIRECTIVE) || previous.includes(ALLOW_DIRECTIVE)) return

    const hits = [...line.matchAll(HEX_COLOR_PATTERN), ...line.matchAll(FUNCTIONAL_COLOR_PATTERN)]

    if (hits.length > 0) {
      violations.push({ file, line: index + 1, text: line.trim().slice(0, 120) })
    }
  })

  return violations
}

const scannedFiles = Object.entries(VUE_FILES)
const violations = scannedFiles.flatMap(([path, source]) => scanFile(path, source))

describe('design tokens', () => {
  it('`.vue` 中没有硬编码色值（用 main.css 的语义 Token）', () => {
    const report = violations.map(({ file, line, text }) => `${file}:${line}  ${text}`).sort()

    expect(report).toEqual([])
  })

  it('扫描本身有产出（目录或正则失效时不能空转通过）', () => {
    expect(scannedFiles.length).toBeGreaterThan(20)
  })
})
