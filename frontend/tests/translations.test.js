import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { translations, errorMessages } from '../src/i18n/translations.js'

const en = translations.en
const ar = translations.ar

// The names inside {curly braces}, sorted, e.g. 'Hello {name}' -> ['name']
function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
}

// Every key written as t('some.key') in the source code (not keys built with ${...}).
function keysUsedInCode() {
  const srcDir = fileURLToPath(new URL('../src/', import.meta.url))
  const keys = new Set()
  for (const file of readdirSync(srcDir, { recursive: true })) {
    if (!/\.(js|jsx)$/.test(file) || file.includes('.test.')) continue
    const code = readFileSync(join(srcDir, file), 'utf8')
    for (const match of code.matchAll(/\bt\('([^']+)'/g)) {
      keys.add(match[1])
    }
  }
  return [...keys]
}

describe('translations', () => {
  it('the Arabic warm-up label uses a word whose marks do not cover the line below', () => {
    expect(ar['dashboard.warming']).toBe('قيد التسخين')
  })

  it('Arabic has every English key', () => {
    const missing = Object.keys(en).filter((key) => !(key in ar))
    expect(missing).toEqual([])
  })

  it('Arabic has no extra keys that English lacks', () => {
    const extra = Object.keys(ar).filter((key) => !(key in en))
    expect(extra).toEqual([])
  })

  it('no translation is empty', () => {
    const empty = [...Object.entries(en), ...Object.entries(ar)]
      .filter(([, text]) => typeof text !== 'string' || text.trim() === '')
      .map(([key]) => key)
    expect(empty).toEqual([])
  })

  it('both languages use the same {placeholders}', () => {
    const different = Object.keys(en).filter(
      (key) => key in ar && placeholders(en[key]).join() !== placeholders(ar[key]).join()
    )
    expect(different).toEqual([])
  })

  it('every t(...) key used in the code exists', () => {
    const missing = keysUsedInCode().filter((key) => !(key in en))
    expect(missing).toEqual([])
  })
})

describe('errorMessages', () => {
  it('has the fallback messages the app relies on', () => {
    expect(errorMessages.ar.UNKNOWN_ERROR).toBeTruthy()
    expect(errorMessages.ar.NETWORK_ERROR).toBeTruthy()
  })
})
