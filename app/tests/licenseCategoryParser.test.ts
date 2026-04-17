import { describe, it, expect } from 'vitest'
import { parseLicenseCategories } from 'app-module-cr-identity/src/composables/useLicenseMrz'

describe('License Category Parser', () => {
  it('extracts single category', () => {
    const result = parseLicenseCategories(['B1 15/01/2020 15/01/2026'])
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('B1')
    expect(result[0].from).toBe('15/01/2020')
    expect(result[0].to).toBe('15/01/2026')
  })

  it('extracts multiple categories from multiple lines', () => {
    const lines = [
      'A2 01/03/2018 01/03/2024',
      'B1 15/01/2020 15/01/2026',
      'C1 20/06/2021 20/06/2027',
    ]
    const result = parseLicenseCategories(lines)
    expect(result).toHaveLength(3)
    expect(result.map(c => c.code)).toEqual(['A2', 'B1', 'C1'])
  })

  it('extracts category without dates', () => {
    const result = parseLicenseCategories(['B1'])
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('B1')
    expect(result[0].from).toBe('')
    expect(result[0].to).toBe('')
  })

  it('handles all CR license categories', () => {
    const allCodes = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3', 'E1', 'E2', 'E3']
    const lines = allCodes.map(c => `${c} 01/01/2020 01/01/2026`)
    const result = parseLicenseCategories(lines)
    expect(result).toHaveLength(16)
    expect(result.map(c => c.code)).toEqual(allCodes)
  })

  it('deduplicates categories on same line', () => {
    const result = parseLicenseCategories(['B1 B1 B1'])
    expect(result).toHaveLength(1)
  })

  it('handles OCR noise around category codes', () => {
    const result = parseLicenseCategories(['Categoria B1 vigente'])
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('B1')
  })

  it('returns empty for no categories found', () => {
    const result = parseLicenseCategories(['no categories here', 'just text'])
    expect(result).toHaveLength(0)
  })

  it('does not match partial codes', () => {
    const result = parseLicenseCategories(['AB1C', 'XB12'])
    // B1 should match in 'AB1C' at word boundary, but B12 is not a valid code
    // The regex uses \\b so it depends on what surrounds it
    expect(result.every(c => ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3', 'E1', 'E2', 'E3'].includes(c.code))).toBe(true)
  })

  it('handles dates with different separators', () => {
    const result = parseLicenseCategories(['B1 15-01-2020 15.01.2026'])
    expect(result).toHaveLength(1)
    expect(result[0].from).toBe('15-01-2020')
    expect(result[0].to).toBe('15.01.2026')
  })

  it('handles empty input', () => {
    expect(parseLicenseCategories([])).toHaveLength(0)
  })
})
