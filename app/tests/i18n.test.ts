import { describe, it, expect } from 'vitest'
import es from '@/i18n/es'
import en from '@/i18n/en'

describe('i18n locale files', () => {
  it('es and en have the same top-level keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  })

  it('every nested key in es exists in en', () => {
    function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
      const keys: string[] = []
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k
        if (typeof v === 'object' && v !== null) {
          keys.push(...getKeys(v as Record<string, unknown>, fullKey))
        } else {
          keys.push(fullKey)
        }
      }
      return keys
    }

    const esKeys = getKeys(es).sort()
    const enKeys = getKeys(en).sort()
    expect(esKeys).toEqual(enKeys)
  })

  it('no empty string values in es', () => {
    function checkValues(obj: Record<string, unknown>, path = '') {
      for (const [k, v] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${k}` : k
        if (typeof v === 'string') {
          expect(v, `es.${fullPath} is empty`).not.toBe('')
        } else if (typeof v === 'object' && v !== null) {
          checkValues(v as Record<string, unknown>, fullPath)
        }
      }
    }
    checkValues(es)
  })

  it('no empty string values in en', () => {
    function checkValues(obj: Record<string, unknown>, path = '') {
      for (const [k, v] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${k}` : k
        if (typeof v === 'string') {
          expect(v, `en.${fullPath} is empty`).not.toBe('')
        } else if (typeof v === 'object' && v !== null) {
          checkValues(v as Record<string, unknown>, fullPath)
        }
      }
    }
    checkValues(en)
  })
})
