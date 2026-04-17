import { describe, it, expect } from 'vitest'
import {
  parsePassportMRZ,
  findPassportMRZLines,
} from 'app-module-cr-identity/src/composables/usePassportMrz'

describe('TD3 Passport MRZ Parser', () => {
  describe('findPassportMRZLines', () => {
    it('finds valid TD3 lines starting with P<', () => {
      const lines = [
        'P<CRIPEREZ<LOPEZ<<MARIA<ISABEL<<<<<<<<<<<<<<',
        '1234567890CRI8506159M2610156<<<<<<<<<<<<<<<40',
      ]
      const result = findPassportMRZLines(lines)
      expect(result).toHaveLength(2)
    })

    it('filters short lines', () => {
      const lines = [
        'too short',
        'P<CRIPEREZ<LOPEZ<<MARIA<ISABEL<<<<<<<<<<<<<<',
      ]
      const result = findPassportMRZLines(lines)
      expect(result).toHaveLength(1)
    })

    it('returns max 2 lines', () => {
      const lines = Array(5).fill('P<CRIPEREZ<LOPEZ<<MARIA<ISABEL<<<<<<<<<<<<<<')
      const result = findPassportMRZLines(lines)
      expect(result).toHaveLength(2)
    })

    it('returns empty for no MRZ content', () => {
      const lines = ['Hello world', 'Not a passport']
      expect(findPassportMRZLines(lines)).toHaveLength(0)
    })
  })

  describe('parsePassportMRZ', () => {
    const validLines = [
      'P<CRIPEREZ<LOPEZ<<MARIA<ISABEL<<<<<<<<<<<<<<',
      'C123456780CRI8506159M2610156<<<<<<<<<<<<<<<40',
    ]

    it('extracts issuing country', () => {
      const result = parsePassportMRZ(validLines)
      expect(result.issuingCountry).toBe('CRI')
    })

    it('extracts surname', () => {
      const result = parsePassportMRZ(validLines)
      expect(result.surname).toBe('PEREZ LOPEZ')
    })

    it('extracts given names', () => {
      const result = parsePassportMRZ(validLines)
      expect(result.givenNames).toBe('MARIA ISABEL')
    })

    it('extracts document number', () => {
      const result = parsePassportMRZ(validLines)
      expect(result.documentNumber).toBe('C12345678')
    })

    it('extracts nationality', () => {
      const result = parsePassportMRZ(validLines)
      expect(result.nationality).toBe('CRI')
    })

    it('extracts date of birth', () => {
      const result = parsePassportMRZ(validLines)
      expect(result.dateOfBirth).toBe('15/06/1985')
    })

    it('extracts sex', () => {
      const result = parsePassportMRZ(validLines)
      expect(result.sex).toBe('M')
    })

    it('extracts date of expiry', () => {
      const result = parsePassportMRZ(validLines)
      expect(result.dateOfExpiry).toBe('15/10/2026')
    })

    it('returns success=true for valid MRZ', () => {
      const result = parsePassportMRZ(validLines)
      expect(result.success).toBe(true)
    })

    it('returns success=false for empty lines', () => {
      const result = parsePassportMRZ([])
      expect(result.success).toBe(false)
    })

    it('returns success=false for only 1 line', () => {
      const result = parsePassportMRZ([validLines[0]])
      expect(result.success).toBe(false)
    })

    it('handles single surname (no < between parts)', () => {
      const lines = [
        'P<CRIGARCIA<<JUAN<<<<<<<<<<<<<<<<<<<<<<<<<<',
        'C123456780CRI9001011M3012319<<<<<<<<<<<<<<<40',
      ]
      const result = parsePassportMRZ(lines)
      expect(result.surname).toBe('GARCIA')
      expect(result.givenNames).toBe('JUAN')
    })

    it('handles multiple given names', () => {
      const lines = [
        'P<CRILOPEZ<<MARIA<JOSE<ELENA<<<<<<<<<<<<<<',
        'C123456780CRI8506159F2610156<<<<<<<<<<<<<<<40',
      ]
      const result = parsePassportMRZ(lines)
      expect(result.givenNames).toBe('MARIA JOSE ELENA')
    })

    it('handles compound surname with single chevron', () => {
      const lines = [
        'P<CRIDE<LA<CRUZ<<CARLOS<ANDRES<<<<<<<<<<<<<',
        'C123456780CRI8506159M2610156<<<<<<<<<<<<<<<40',
      ]
      const result = parsePassportMRZ(lines)
      expect(result.surname).toBe('DE LA CRUZ')
      expect(result.givenNames).toBe('CARLOS ANDRES')
    })

    it('handles female sex', () => {
      const lines = [
        'P<CRIPEREZ<<ANA<<<<<<<<<<<<<<<<<<<<<<<<<<<',
        'C123456780CRI8506159F2610156<<<<<<<<<<<<<<<40',
      ]
      const result = parsePassportMRZ(lines)
      expect(result.sex).toBe('F')
    })

    it('handles DOB century: >50 → 1900s', () => {
      const lines = [
        'P<CRIPEREZ<<JOSE<<<<<<<<<<<<<<<<<<<<<<<<<<',
        'C123456780CRI5512150M2610156<<<<<<<<<<<<<<<40',
      ]
      const result = parsePassportMRZ(lines)
      expect(result.dateOfBirth).toBe('15/12/1955')
    })

    it('handles DOB century: <=50 → 2000s', () => {
      const lines = [
        'P<CRIPEREZ<<JOSE<<<<<<<<<<<<<<<<<<<<<<<<<<',
        'C123456780CRI0103050M2610156<<<<<<<<<<<<<<<40',
      ]
      const result = parsePassportMRZ(lines)
      expect(result.dateOfBirth).toBe('05/03/2001')
    })

    it('handles non-CR nationality', () => {
      const lines = [
        'P<USASMITH<<JOHN<DAVID<<<<<<<<<<<<<<<<<<<',
        'C987654320USA8001011M3012319<<<<<<<<<<<<<<<40',
      ]
      const result = parsePassportMRZ(lines)
      expect(result.issuingCountry).toBe('USA')
      expect(result.nationality).toBe('USA')
    })

    it('pads short lines to 44 chars', () => {
      const lines = [
        'P<CRIPEREZ<<ANA',
        'C123456780CRI8506159F2610156',
      ]
      const result = parsePassportMRZ(lines)
      // Should still parse what it can
      expect(result.issuingCountry).toBe('CRI')
      expect(result.surname).toBe('PEREZ')
    })
  })
})
