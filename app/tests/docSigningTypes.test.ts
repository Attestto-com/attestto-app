import { describe, it, expect } from 'vitest'
import {
  CATEGORY_LABELS,
  RISK_LABELS,
  CATEGORY_DEFAULT_RISK,
} from 'app-module-doc-signing/src/types'
import type { DocumentCategory, RiskLevel } from 'app-module-doc-signing/src/types'

/**
 * Tests for doc-signing type definitions, label maps, and risk mappings.
 */

describe('Doc-Signing Types', () => {

  describe('CATEGORY_LABELS', () => {
    it('has a label for every category', () => {
      const categories: DocumentCategory[] = [
        'govt_form_standard', 'govt_form_sensitive', 'nda',
        'service_agreement_short', 'employment_contract',
        'lease_short', 'lease_long', 'commercial_contract',
        'real_estate_deed', 'corporate_document', 'loan_agreement', 'unknown',
      ]
      for (const cat of categories) {
        expect(CATEGORY_LABELS[cat]).toBeTruthy()
        expect(typeof CATEGORY_LABELS[cat]).toBe('string')
      }
    })

    it('labels are in Spanish', () => {
      expect(CATEGORY_LABELS.employment_contract).toContain('trabajo')
      expect(CATEGORY_LABELS.real_estate_deed).toContain('propiedad')
      expect(CATEGORY_LABELS.loan_agreement).toContain('restamo')
    })

    it('has exactly 12 categories', () => {
      expect(Object.keys(CATEGORY_LABELS)).toHaveLength(12)
    })
  })

  describe('RISK_LABELS', () => {
    it('has a label for every risk level', () => {
      const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical']
      for (const level of levels) {
        expect(RISK_LABELS[level]).toBeTruthy()
      }
    })

    it('labels are in Spanish', () => {
      expect(RISK_LABELS.low).toBe('Bajo')
      expect(RISK_LABELS.medium).toBe('Medio')
      expect(RISK_LABELS.high).toBe('Alto')
      expect(RISK_LABELS.critical).toBe('Critico')
    })
  })

  describe('CATEGORY_DEFAULT_RISK', () => {
    it('every category maps to a valid risk level', () => {
      const validRisks: RiskLevel[] = ['low', 'medium', 'high', 'critical']
      for (const risk of Object.values(CATEGORY_DEFAULT_RISK)) {
        expect(validRisks).toContain(risk)
      }
    })

    it('govt_form_standard is the only low-risk category', () => {
      const lowRisk = Object.entries(CATEGORY_DEFAULT_RISK)
        .filter(([_, risk]) => risk === 'low')
        .map(([cat]) => cat)
      expect(lowRisk).toEqual(['govt_form_standard'])
    })

    it('critical categories are real_estate, corporate, and loan', () => {
      const critical = Object.entries(CATEGORY_DEFAULT_RISK)
        .filter(([_, risk]) => risk === 'critical')
        .map(([cat]) => cat)
        .sort()
      expect(critical).toEqual(['corporate_document', 'loan_agreement', 'real_estate_deed'])
    })

    it('unknown defaults to high (conservative)', () => {
      expect(CATEGORY_DEFAULT_RISK.unknown).toBe('high')
    })
  })
})
