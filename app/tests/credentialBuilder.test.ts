import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ModuleContext, VerifiableCredential } from '@attestto/module-sdk'
import {
  setBuilderContext,
  buildCedulaVC,
  buildDrivingLicenseVC,
  buildPassportVC,
  signAndStoreVC,
} from 'app-module-cr-identity/src/composables/useCredentialBuilder'
import type { CedulaSubject, DrivingLicenseSubject, PassportSubject, SelfAttestedEvidence } from 'app-module-cr-identity/src/types/identity'

const TEST_DID = 'did:web:test.attestto.id'
const TEST_PUBLIC_KEY = 'dGVzdC1wdWJsaWMta2V5'
const TEST_SIGNATURE = 'dGVzdC1zaWduYXR1cmU'
const TEST_VERIFICATION_METHOD = `${TEST_DID}#key-1`

function createMockContext(): ModuleContext {
  const stored: VerifiableCredential[] = []
  return {
    getCredentials: vi.fn(async () => stored),
    storeCredential: vi.fn(async (vc: VerifiableCredential) => { stored.push(vc) }),
    pushInboxItem: vi.fn(),
    requestBiometric: vi.fn(async () => true),
    navigate: vi.fn(),
    storage: {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
    llm: { status: () => 'idle', init: async () => {}, generate: async () => '', supported: false },
    getDID: () => TEST_DID,
    getPublicKey: () => TEST_PUBLIC_KEY,
    sign: vi.fn(async () => ({ signature: TEST_SIGNATURE, verificationMethod: TEST_VERIFICATION_METHOD })),
  }
}

const evidence: SelfAttestedEvidence = {
  type: 'SelfAttestation',
  method: 'document-scan',
  ocrConfidence: 85,
  scannedAt: '2026-04-17T12:00:00Z',
}

describe('Credential Builder', () => {
  let ctx: ModuleContext

  beforeEach(() => {
    ctx = createMockContext()
    setBuilderContext(ctx)
  })

  describe('buildCedulaVC', () => {
    const subject: CedulaSubject = {
      cedula: '112340877',
      fullName: 'MARIA PEREZ LOPEZ',
      apellido1: 'PEREZ',
      apellido2: 'LOPEZ',
      nombre: 'MARIA',
      dateOfBirth: '15/06/1985',
      dateOfExpiry: '15/06/2034',
      nationality: 'CRI',
      sex: 'F',
    }

    it('builds VC with correct type', () => {
      const vc = buildCedulaVC(subject, evidence)
      expect(vc.type).toContain('CedulaIdentidadCR')
      expect(vc.type).toContain('VerifiableCredential')
    })

    it('uses correct context', () => {
      const vc = buildCedulaVC(subject, evidence)
      expect(vc['@context']).toContain('https://schemas.attestto.org/cr/identity/v1')
    })

    it('sets issuer to citizen DID', () => {
      const vc = buildCedulaVC(subject, evidence)
      expect(vc.issuer).toBe(TEST_DID)
    })

    it('sets credentialSubject.id to citizen DID', () => {
      const vc = buildCedulaVC(subject, evidence)
      expect(vc.credentialSubject.id).toBe(TEST_DID)
    })

    it('includes cedula number in subject', () => {
      const vc = buildCedulaVC(subject, evidence)
      const nid = vc.credentialSubject.nationalId as { type: string; number: string }
      expect(nid.number).toBe('112340877')
      expect(nid.type).toBe('cedula')
    })

    it('includes name fields', () => {
      const vc = buildCedulaVC(subject, evidence)
      expect(vc.credentialSubject.fullName).toBe('MARIA PEREZ LOPEZ')
      expect(vc.credentialSubject.nombre).toBe('MARIA')
      expect(vc.credentialSubject.apellido1).toBe('PEREZ')
    })

    it('sets expiration to 10 years from now', () => {
      const vc = buildCedulaVC(subject, evidence)
      expect(vc.expirationDate).toBeTruthy()
      const expiry = new Date(vc.expirationDate!)
      const now = new Date()
      expect(expiry.getFullYear()).toBe(now.getFullYear() + 10)
    })

    it('generates unique VC IDs', () => {
      const vc1 = buildCedulaVC(subject, evidence)
      const vc2 = buildCedulaVC(subject, evidence)
      expect(vc1.id).not.toBe(vc2.id)
    })

    it('includes urn:uuid format ID', () => {
      const vc = buildCedulaVC(subject, evidence)
      expect(vc.id).toMatch(/^urn:uuid:/)
    })
  })

  describe('buildDrivingLicenseVC', () => {
    const subject: DrivingLicenseSubject = {
      cedula: '112340877',
      fullName: 'MARIA PEREZ LOPEZ',
      dateOfBirth: '15/06/1985',
      dateOfExpiry: '15/01/2030',
      categories: [{ code: 'B1', from: '2020-01-15', to: '2026-01-15' }],
      points: 0,
      status: 'active',
      restrictions: [],
    }

    it('builds VC with DrivingLicenseCR type', () => {
      const vc = buildDrivingLicenseVC(subject, evidence)
      expect(vc.type).toContain('DrivingLicenseCR')
    })

    it('uses driving context', () => {
      const vc = buildDrivingLicenseVC(subject, evidence)
      expect(vc['@context']).toContain('https://schemas.attestto.org/cr/driving/v1')
    })

    it('includes license data in subject', () => {
      const vc = buildDrivingLicenseVC(subject, evidence)
      const license = vc.credentialSubject.license as Record<string, unknown>
      expect(license.cedula).toBe('112340877')
      expect(license.status).toBe('active')
      expect((license.categories as unknown[]).length).toBe(1)
    })

    it('parses DD/MM/YYYY expiry date', () => {
      const vc = buildDrivingLicenseVC(subject, evidence)
      expect(vc.expirationDate).toBeTruthy()
      const expiry = new Date(vc.expirationDate!)
      expect(expiry.getFullYear()).toBe(2030)
    })
  })

  describe('buildPassportVC', () => {
    const subject: PassportSubject = {
      documentNumber: 'C12345678',
      surname: 'PEREZ LOPEZ',
      givenNames: 'MARIA ISABEL',
      nationality: 'CRI',
      dateOfBirth: '15/06/1985',
      sex: 'F',
      dateOfExpiry: '15/10/2030',
      issuingCountry: 'CRI',
    }

    it('builds VC with PassportCR type', () => {
      const vc = buildPassportVC(subject, evidence)
      expect(vc.type).toContain('PassportCR')
    })

    it('includes passport data in subject', () => {
      const vc = buildPassportVC(subject, evidence)
      expect(vc.credentialSubject.documentNumber).toBe('C12345678')
      expect(vc.credentialSubject.surname).toBe('PEREZ LOPEZ')
      expect(vc.credentialSubject.givenNames).toBe('MARIA ISABEL')
    })

    it('sets issuer to citizen DID', () => {
      const vc = buildPassportVC(subject, evidence)
      expect(vc.issuer).toBe(TEST_DID)
    })
  })

  describe('signAndStoreVC', () => {
    it('adds Ed25519 proof to VC', async () => {
      const vc = buildCedulaVC({
        cedula: '112340877', fullName: 'TEST', apellido1: 'A', apellido2: 'B',
        nombre: 'C', dateOfBirth: '01/01/2000', dateOfExpiry: '01/01/2030',
        nationality: 'CRI', sex: 'M',
      }, evidence)

      const signed = await signAndStoreVC(vc)
      const proof = signed.proof as Record<string, unknown>
      expect(proof.type).toBe('Ed25519Signature2020')
      expect(proof.verificationMethod).toBe(TEST_VERIFICATION_METHOD)
      expect(proof.proofPurpose).toBe('assertionMethod')
      expect(proof.proofValue).toBe(TEST_SIGNATURE)
      expect(proof.publicKey).toBe(TEST_PUBLIC_KEY)
    })

    it('calls ctx.sign() with canonical payload', async () => {
      const vc = buildCedulaVC({
        cedula: '112340877', fullName: 'TEST', apellido1: 'A', apellido2: 'B',
        nombre: 'C', dateOfBirth: '01/01/2000', dateOfExpiry: '01/01/2030',
        nationality: 'CRI', sex: 'M',
      }, evidence)

      await signAndStoreVC(vc)
      expect(ctx.sign).toHaveBeenCalledOnce()
      const payload = (ctx.sign as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const parsed = JSON.parse(payload)
      expect(parsed['@context']).toBeDefined()
      expect(parsed.type).toContain('CedulaIdentidadCR')
      expect(parsed.credentialSubject).toBeDefined()
    })

    it('stores VC in vault', async () => {
      const vc = buildCedulaVC({
        cedula: '112340877', fullName: 'TEST', apellido1: 'A', apellido2: 'B',
        nombre: 'C', dateOfBirth: '01/01/2000', dateOfExpiry: '01/01/2030',
        nationality: 'CRI', sex: 'M',
      }, evidence)

      await signAndStoreVC(vc)
      expect(ctx.storeCredential).toHaveBeenCalledOnce()
    })

    it('returns the signed VC', async () => {
      const vc = buildCedulaVC({
        cedula: '112340877', fullName: 'TEST', apellido1: 'A', apellido2: 'B',
        nombre: 'C', dateOfBirth: '01/01/2000', dateOfExpiry: '01/01/2030',
        nationality: 'CRI', sex: 'M',
      }, evidence)

      const signed = await signAndStoreVC(vc)
      expect(signed.proof).toBeDefined()
      expect(signed.id).toBe(vc.id)
    })

    it('throws when context not set', async () => {
      setBuilderContext(null as unknown as ModuleContext)
      const vc = { '@context': [], type: [], id: '', issuer: '', issuanceDate: '', credentialSubject: {} } as unknown as VerifiableCredential
      await expect(signAndStoreVC(vc)).rejects.toThrow('Identity module context not initialized')
    })
  })
})
