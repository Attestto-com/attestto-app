import { describe, it, expect } from 'vitest'
import { isVcContentValid } from '@/composables/useVcIssuer'
import type { VerifiableCredential } from '@attestto/module-sdk'

function makeVc(contentVersion: string): VerifiableCredential {
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'DrivingCompetencyCR'],
    id: 'urn:uuid:test-001',
    issuer: { id: 'did:web:test.attestto.id', name: 'Test' },
    issuanceDate: '2026-04-11T00:00:00Z',
    credentialSubject: {
      id: 'did:web:test.attestto.id',
      licenseType: 'B1',
      model: 'perpetual-competency',
      contentVersion,
      categories: { 'A': { percent: 92 } },
    },
    jurisdiction: 'CR',
    revocationStatus: 'valid',
  }
}

describe('useVcIssuer', () => {
  describe('isVcContentValid', () => {
    it('returns true when content version matches', () => {
      const vc = makeVc('2026-04-10')
      expect(isVcContentValid(vc, '2026-04-10')).toBe(true)
    })

    it('returns false when content version is outdated', () => {
      const vc = makeVc('2026-04-10')
      expect(isVcContentValid(vc, '2026-05-01')).toBe(false)
    })

    it('returns false when VC has no contentVersion', () => {
      const vc = makeVc('2026-04-10')
      delete (vc.credentialSubject as Record<string, unknown>).contentVersion
      expect(isVcContentValid(vc, '2026-04-10')).toBe(false)
    })
  })

  describe('issueMasteryCredential structure', () => {
    it('DrivingCompetencyCR VC has no expirationDate', () => {
      const vc = makeVc('2026-04-10')
      expect(vc.expirationDate).toBeUndefined()
    })

    it('DrivingCompetencyCR VC includes contentVersion in subject', () => {
      const vc = makeVc('2026-04-10')
      expect(vc.credentialSubject.contentVersion).toBe('2026-04-10')
    })

    it('DrivingCompetencyCR VC type is correct', () => {
      const vc = makeVc('2026-04-10')
      expect(vc.type).toContain('DrivingCompetencyCR')
      expect(vc.type).toContain('VerifiableCredential')
    })

    it('VC includes perpetual-competency model marker', () => {
      const vc = makeVc('2026-04-10')
      expect(vc.credentialSubject.model).toBe('perpetual-competency')
    })
  })
})
