import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

/**
 * Feature Contract Tests
 *
 * These tests assert that documented/offered features are REAL, not stubbed.
 * Every button, route, and feature the user can see must have a real implementation.
 *
 * If a feature isn't ready, it must be HIDDEN (not rendered) — never shown as
 * a placeholder, alert(), or "coming soon" message.
 *
 * Run: pnpm test -- featureContract
 */

const APP_SRC = resolve(__dirname, '../src')
const MODULES_DIR = resolve(__dirname, '../../modules')

const SOURCE_EXT = /\.(ts|tsx|vue|js|mjs|svelte)$/
const SKIP = /node_modules|\/dist\/|\.test\.|\.spec\.|\/tests\//

// Collect all source files (not tests)
function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry)
      if (SKIP.test(full)) continue
      const st = statSync(full)
      if (st.isDirectory()) walk(full)
      else if (SOURCE_EXT.test(entry)) results.push(full)
    }
  }
  walk(dir)
  return results
}

function readAll(files: string[]): { file: string; content: string }[] {
  return files.map((f) => ({ file: f, content: readFileSync(f, 'utf8') }))
}

// Only scan ENABLED modules (check useModuleBootstrap.ts for which are active).
// cr-medical is gated — its stubs are known and tracked but don't block CI.
const allSources = readAll([
  ...sourceFiles(APP_SRC),
  ...sourceFiles(join(MODULES_DIR, 'cr-driving/src')),
  // cr-medical: GATED — excluded until VP bridge is built
  ...sourceFiles(join(MODULES_DIR, 'doc-signing/src')),
  ...sourceFiles(join(MODULES_DIR, 'cr-identity/src')),
  ...sourceFiles(join(MODULES_DIR, 'sdk/src')),
])

// ── No demo/fake DIDs in runtime code ────────────────────────────────────────

describe('No demo/fake DIDs in runtime code', () => {
  const DEMO_DID = /did:(web|example):(demo|medico|test)/
  // Allow in JSDoc comments (/** ... */) and type annotations
  const JSDOC = /\/\*\*[\s\S]*?\*\//g

  it('source files do not contain demo DIDs outside JSDoc', () => {
    const violations: string[] = []
    for (const { file, content } of allSources) {
      // Strip JSDoc blocks, then check
      const stripped = content.replace(JSDOC, '')
      if (DEMO_DID.test(stripped)) {
        const short = file.replace(/.*\/Attestto\//, '')
        violations.push(short)
      }
    }
    expect(violations, `Demo DIDs found in: ${violations.join(', ')}`).toHaveLength(0)
  })
})

// ── No alert() handlers ──────────────────────────────────────────────────────

describe('No alert() handlers in production code', () => {
  it('no file uses alert() as an event handler', () => {
    const violations: string[] = []
    for (const { file, content } of allSources) {
      // Match alert('...') or alert("...") but not in comments
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith('//') || line.startsWith('*')) continue
        if (/alert\s*\(/.test(line) && !line.includes('stub-guard-ignore')) {
          const short = file.replace(/.*\/Attestto\//, '')
          violations.push(`${short}:${i + 1}`)
        }
      }
    }
    expect(violations, `alert() found in: ${violations.join(', ')}`).toHaveLength(0)
  })
})

// ── No hardcoded fake credentials ────────────────────────────────────────────

describe('No hardcoded fake credentials', () => {
  const FAKE_COLEGIADO = /numeroColegiado.*['"]0{3,}['"]/
  const FAKE_NAME = /['"]Dra?\.\s+(Ana|Juan|Maria|Test)\s/

  it('no fake professional numbers', () => {
    const violations: string[] = []
    for (const { file, content } of allSources) {
      if (FAKE_COLEGIADO.test(content)) {
        violations.push(file.replace(/.*\/Attestto\//, ''))
      }
    }
    expect(violations, `Fake colegiado found: ${violations.join(', ')}`).toHaveLength(0)
  })

  it('no placeholder doctor/professional names', () => {
    const violations: string[] = []
    for (const { file, content } of allSources) {
      if (FAKE_NAME.test(content) && !file.includes('i18n')) {
        violations.push(file.replace(/.*\/Attestto\//, ''))
      }
    }
    expect(violations, `Fake names found: ${violations.join(', ')}`).toHaveLength(0)
  })
})

// ── No "coming soon" visible to users ────────────────────────────────────────

describe('No "coming soon" in component templates', () => {
  const COMING_SOON = /[Cc]oming.?[Ss]oon|[Pp]roximamente|[Pp]róximamente/

  it('no .vue template shows "coming soon" or "proximamente"', () => {
    const violations: string[] = []
    for (const { file, content } of allSources) {
      if (!file.endsWith('.vue')) continue
      // Only check the <template> section
      const templateMatch = content.match(/<template[\s>][\s\S]*?<\/template>/)
      if (templateMatch && COMING_SOON.test(templateMatch[0])) {
        violations.push(file.replace(/.*\/Attestto\//, ''))
      }
    }
    expect(violations, `"Coming soon" in templates: ${violations.join(', ')}`).toHaveLength(0)
  })
})

// ── No "not yet implemented" in user-facing code ─────────────────────────────

describe('No "not yet implemented" in user-facing code', () => {
  it('no component contains "not yet implemented" comments visible to users', () => {
    const violations: string[] = []
    for (const { file, content } of allSources) {
      if (!file.endsWith('.vue')) continue
      const templateMatch = content.match(/<template[\s>][\s\S]*?<\/template>/)
      if (templateMatch && /not yet implemented/i.test(templateMatch[0])) {
        violations.push(file.replace(/.*\/Attestto\//, ''))
      }
    }
    expect(violations, `"Not yet implemented" in templates: ${violations.join(', ')}`).toHaveLength(0)
  })
})

// ── No void no-op handlers ───────────────────────────────────────────────────

describe('No void no-op function bodies', () => {
  // Pattern: void someParam; return — indicates a function that accepts
  // input but does nothing with it
  const VOID_NOOP = /void \w+;\s*\n\s*return/

  it('no function accepts a parameter and does nothing', () => {
    const violations: string[] = []
    for (const { file, content } of allSources) {
      if (VOID_NOOP.test(content) && !content.includes('stub-guard-ignore')) {
        violations.push(file.replace(/.*\/Attestto\//, ''))
      }
    }
    expect(violations, `No-op handlers found: ${violations.join(', ')}`).toHaveLength(0)
  })
})

// ── Every enabled module in bootstrap must have real routes ───────────────────

describe('Module bootstrap contract', () => {
  it('useModuleBootstrap only enables modules with real views', () => {
    const bootstrapFile = resolve(APP_SRC, 'composables/useModuleBootstrap.ts')
    if (!existsSync(bootstrapFile)) return
    const content = readFileSync(bootstrapFile, 'utf8')

    // Find uncommented import lines for modules
    const enabledModules = content
      .split('\n')
      .filter((l) => /^\s*import\s/.test(l) && l.includes('modules/'))
      .map((l) => {
        const match = l.match(/modules\/([^/]+)/)
        return match?.[1]
      })
      .filter(Boolean) as string[]

    for (const mod of enabledModules) {
      const manifestPath = resolve(MODULES_DIR, mod, 'src/manifest.ts')
      expect(existsSync(manifestPath), `${mod} manifest missing`).toBe(true)

      const manifest = readFileSync(manifestPath, 'utf8')
      // Check that routes point to .vue files that exist
      const routeImports = manifest.match(/\(\)\s*=>\s*import\(['"](.+?)['"]\)/g) || []
      for (const imp of routeImports) {
        const pathMatch = imp.match(/import\(['"](.+?)['"]\)/)
        if (!pathMatch) continue
        const viewRelative = pathMatch[1]
        // Resolve relative to manifest directory
        const viewPath = resolve(MODULES_DIR, mod, 'src', viewRelative.replace(/^\.\//, '') + (viewRelative.endsWith('.vue') ? '' : '.vue'))
        const short = `modules/${mod}/${viewRelative}`
        expect(existsSync(viewPath), `${short} referenced in manifest but file missing`).toBe(true)
      }
    }
  })
})
