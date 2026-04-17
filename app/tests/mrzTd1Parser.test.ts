import { describe, it, expect } from 'vitest'
import {
  parseMRZ,
  findMRZLines,
  cleanMRZLine,
  findCedulaNumber,
  findNameFields,
} from 'app-module-cr-identity/src/composables/useMrzOcr'

describe('TD1 MRZ Parser', () => {
  describe('cleanMRZLine', () => {
    it('converts pipes to chevrons', () => {
      expect(cleanMRZLine('IDCRI|123')).toContain('<')
    })

    it('removes spaces', () => {
      const result = cleanMRZLine('ID CRI 123')
      expect(result).not.toContain(' ')
    })

    it('fixes O/0 confusion before digits', () => {
      expect(cleanMRZLine('O123')).toBe('0123')
    })

    it('fixes O/0 confusion after digits', () => {
      expect(cleanMRZLine('123O')).toBe('1230')
    })

    it('fixes I/1 confusion before digits', () => {
      expect(cleanMRZLine('I23')).toBe('123')
    })

    it('fixes I/1 confusion after digits', () => {
      expect(cleanMRZLine('23I')).toBe('231')
    })

    it('converts parentheses and braces to chevrons', () => {
      const result = cleanMRZLine('(ABC){DEF}')
      expect(result).not.toContain('(')
      expect(result).not.toContain(')')
      expect(result).not.toContain('{')
      expect(result).not.toContain('}')
      expect(result).toContain('<')
    })

    it('converts underscores and hyphens to chevrons', () => {
      expect(cleanMRZLine('ABC_DEF-GHI')).toBe('ABC<DEF<GHI')
    })

    it('uppercases', () => {
      expect(cleanMRZLine('abcdef')).toBe('ABCDEF')
    })
  })

  describe('findMRZLines', () => {
    it('finds valid TD1 MRZ lines', () => {
      const lines = [
        'IDCRI123456789<<<<<<<<<<<<<<<',
        '8506159M2610156CRI<<<<<<<<<<<',
        'PEREZ<LOPEZ<<MARIA<ISABEL<<<<',
      ]
      const result = findMRZLines(lines)
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it('filters out short lines', () => {
      const lines = ['short', 'IDCRI123456789<<<<<<<<<<<<<<<']
      const result = findMRZLines(lines)
      expect(result).toHaveLength(1)
    })

    it('returns max 3 lines', () => {
      const lines = Array(5).fill('IDCRI123456789<<<<<<<<<<<<<<<')
      const result = findMRZLines(lines)
      expect(result).toHaveLength(3)
    })

    it('returns empty for no MRZ content', () => {
      const lines = ['Hello world', 'Nothing here']
      expect(findMRZLines(lines)).toHaveLength(0)
    })
  })

  describe('parseMRZ', () => {
    const validLines = [
      'IDCRI1234567890<<<<<<<<<<<<<<<',
      '8506159M2610156CRI<<<<<<<<<<<0',
      'PEREZ<LOPEZ<<MARIA<ISABEL<<<<<',
    ]

    it('extracts cedula number from line 1', () => {
      const result = parseMRZ(validLines, 90)
      expect(result.cedula).toBe('123456789')
    })

    it('extracts date of birth from line 2', () => {
      const result = parseMRZ(validLines, 90)
      expect(result.fechaNacimiento).toBe('15/06/1985')
    })

    it('extracts sex from line 2', () => {
      const result = parseMRZ(validLines, 90)
      expect(result.sexo).toBe('M')
    })

    it('extracts expiry date from line 2', () => {
      const result = parseMRZ(validLines, 90)
      expect(result.fechaVencimiento).toBe('15/10/2026')
    })

    it('extracts nationality', () => {
      const result = parseMRZ(validLines, 90)
      expect(result.nacionalidad).toBe('CRI')
    })

    it('extracts apellido1 from line 3', () => {
      const result = parseMRZ(validLines, 90)
      expect(result.apellido1).toBe('PEREZ')
    })

    it('extracts apellido2 from line 3', () => {
      const result = parseMRZ(validLines, 90)
      expect(result.apellido2).toBe('LOPEZ')
    })

    it('extracts nombre from line 3', () => {
      const result = parseMRZ(validLines, 90)
      expect(result.nombre).toContain('MARIA')
      expect(result.nombre).toContain('ISABEL')
    })

    it('returns success=true for valid MRZ', () => {
      const result = parseMRZ(validLines, 90)
      expect(result.success).toBe(true)
    })

    it('returns success=false for missing cedula', () => {
      const result = parseMRZ(['IDCRI<<<<<<<<<<<<<<<<<<<<<<<<'], 50)
      expect(result.success).toBe(false)
    })

    it('handles IDCR1 (I→1 OCR error)', () => {
      const lines = [
        'IDCR11234567890<<<<<<<<<<<<<<<',
        '8506159M2610156CRI<<<<<<<<<<<0',
        'PEREZ<LOPEZ<<MARIA<<<<<<<<<<<',
      ]
      const result = parseMRZ(lines, 80)
      expect(result.cedula).toBe('123456789')
    })

    it('preserves confidence', () => {
      const result = parseMRZ(validLines, 75)
      expect(result.confidence).toBe(75)
    })

    it('handles empty lines gracefully', () => {
      const result = parseMRZ([], 0)
      expect(result.success).toBe(false)
      expect(result.cedula).toBe('')
    })

    it('handles partial MRZ (only 2 lines)', () => {
      const result = parseMRZ(validLines.slice(0, 2), 80)
      expect(result.cedula).toBe('123456789')
      expect(result.nombre).toBe('')
    })

    it('handles DOB century: >50 → 1900s', () => {
      const lines = [
        'IDCRI1234567890<<<<<<<<<<<<<<<',
        '5512159M2610156CRI<<<<<<<<<<<0',
        'TEST<<PERSON<<<<<<<<<<<<<<<<<',
      ]
      const result = parseMRZ(lines, 80)
      expect(result.fechaNacimiento).toBe('15/12/1955')
    })

    it('handles DOB century: <=50 → 2000s', () => {
      const lines = [
        'IDCRI1234567890<<<<<<<<<<<<<<<',
        '0103059M2610156CRI<<<<<<<<<<<0',
        'TEST<<PERSON<<<<<<<<<<<<<<<<<',
      ]
      const result = parseMRZ(lines, 80)
      expect(result.fechaNacimiento).toBe('05/03/2001')
    })
  })

  describe('findCedulaNumber', () => {
    it('finds labeled cedula number', () => {
      expect(findCedulaNumber(['CEDULA: 112340877'])).toBe('112340877')
    })

    it('finds 9-digit pattern with spaces', () => {
      expect(findCedulaNumber(['1 1234 0877'])).toBe('112340877')
    })

    it('finds bare 9-digit sequence', () => {
      expect(findCedulaNumber(['text 112340877 more'])).toBe('112340877')
    })

    it('returns empty for no match', () => {
      expect(findCedulaNumber(['no numbers here'])).toBe('')
    })
  })

  describe('findNameFields', () => {
    it('extracts nombre from labeled line', () => {
      const result = findNameFields(['Nombre: MARIA ISABEL'])
      expect(result.nombre).toBe('MARIA ISABEL')
    })

    it('extracts primer apellido', () => {
      const result = findNameFields(['1° Apellido: PEREZ'])
      expect(result.apellido1).toBe('PEREZ')
    })

    it('extracts segundo apellido', () => {
      const result = findNameFields(['2° Apellido: LOPEZ'])
      expect(result.apellido2).toBe('LOPEZ')
    })

    it('handles all three fields', () => {
      const lines = [
        'Nombre: MARIA',
        'Primer Apellido: PEREZ',
        'Segundo Apellido: LOPEZ',
      ]
      const result = findNameFields(lines)
      expect(result.nombre).toBe('MARIA')
      expect(result.apellido1).toBe('PEREZ')
      expect(result.apellido2).toBe('LOPEZ')
    })

    it('returns empty for no labels', () => {
      const result = findNameFields(['random text', 'more text'])
      expect(result.nombre).toBe('')
      expect(result.apellido1).toBe('')
    })
  })
})
