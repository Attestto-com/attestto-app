import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ModuleContext, VerifiableCredential } from '@attestto/module-sdk'
import type { SigningSession, DocumentAnalysis } from 'app-module-doc-signing/src/types'
import { setSignerContext, signDocument } from 'app-module-doc-signing/src/composables/useDocumentSigner'

// ── Mock ModuleContext ──────────────────────────────────────────

const TEST_DID = 'did:web:test.attestto.id'
const TEST_PUBLIC_KEY = 'dGVzdC1wdWJsaWMta2V5LWJhc2U2NHVybA'
const TEST_SIGNATURE = 'dGVzdC1zaWduYXR1cmUtYmFzZTY0dXJs'
const TEST_VERIFICATION_METHOD = `${TEST_DID}#key-1`

function createMockContext(): ModuleContext {
  const storedCredentials: VerifiableCredential[] = []

  return {
    getCredentials: vi.fn(async () => storedCredentials),
    storeCredential: vi.fn(async (vc: VerifiableCredential) => {
      storedCredentials.push(vc)
    }),
    pushInboxItem: vi.fn(),
    requestBiometric: vi.fn(async () => true),
    navigate: vi.fn(),
    storage: {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
    llm: {
      status: () => 'idle',
      init: async () => {},
      generate: async () => '',
      supported: false,
    },
    getDID: () => TEST_DID,
    getPublicKey: () => TEST_PUBLIC_KEY,
    sign: vi.fn(async () => ({
      signature: TEST_SIGNATURE,
      verificationMethod: TEST_VERIFICATION_METHOD,
    })),
  }
}

// ── Mock crypto.subtle for SHA-256 ──────────────────────────────

if (!globalThis.crypto?.subtle) {
  const { webcrypto } = await import('node:crypto')
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
  })
}

// ── Helpers ─────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<DocumentAnalysis> = {}): DocumentAnalysis {
  return {
    documentType: 'service_agreement_short',
    riskLevel: 'medium',
    parties: [{ role: 'vendor', name: 'Acme Corp' }],
    obligations: ['Deliver widgets'],
    penalties: ['Late fee: $100/day'],
    flaggedClauses: [
      { clause: 'Section 5', concern: 'Auto-renewal', severity: 'warning' },
    ],
    plainLanguageSummary: 'Simple service agreement.',
    questions: [
      { id: 'q1', text: 'Is the price correct?' },
    ],
    ...overrides,
  }
}

function makeSession(overrides: Partial<SigningSession> = {}): SigningSession {
  return {
    id: 'session-test-001',
    fileName: 'contract.pdf',
    extractedText: 'This is a test contract...',
    analysis: makeAnalysis(),
    phase: 'signing',
    chatMessages: [],
    userAnswers: [
      { questionId: 'q1', answer: 'Si, correcto', timestamp: Date.now() },
    ],
    recommendation: 'sign',
    signedAt: null,
    pdfHash: null,
    signature: null,
    verificationMethod: null,
    anchorTx: null,
    vcId: null,
    createdAt: Date.now(),
    error: null,
    ...overrides,
  }
}

const TEST_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]) // "%PDF-"

// ── Tests ───────────────────────────────────────────────────────

describe('Document Signer', () => {
  let ctx: ModuleContext

  beforeEach(() => {
    ctx = createMockContext()
    setSignerContext(ctx)
  })

  describe('signDocument', () => {
    it('produces a signed record with real Ed25519 proof', async () => {
      const session = makeSession()
      const record = await signDocument(session, TEST_PDF_BYTES)

      expect(record.sessionId).toBe('session-test-001')
      expect(record.fileName).toBe('contract.pdf')
      expect(record.pdfHash).toMatch(/^[0-9a-f]{64}$/) // SHA-256 hex
      expect(record.signature).toBe(TEST_SIGNATURE)
      expect(record.verificationMethod).toBe(TEST_VERIFICATION_METHOD)
      expect(record.signedAt).toBeTruthy()
      expect(record.vcId).toMatch(/^urn:uuid:/)
      expect(record.anchorTx).toBeNull()
    })

    it('calls ctx.sign() with canonical VC payload', async () => {
      const session = makeSession()
      await signDocument(session, TEST_PDF_BYTES)

      expect(ctx.sign).toHaveBeenCalledOnce()
      const payload = (ctx.sign as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const parsed = JSON.parse(payload)
      expect(parsed['@context']).toContain('https://www.w3.org/2018/credentials/v1')
      expect(parsed.type).toContain('DocumentSignatureVC')
      expect(parsed.issuer.id).toBe(TEST_DID)
      expect(parsed.credentialSubject.id).toBe(TEST_DID)
      expect(parsed.credentialSubject.pdfHash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('stores VC in vault via storeCredential', async () => {
      const session = makeSession()
      await signDocument(session, TEST_PDF_BYTES)

      expect(ctx.storeCredential).toHaveBeenCalledOnce()
      const vc = (ctx.storeCredential as ReturnType<typeof vi.fn>).mock.calls[0][0] as VerifiableCredential
      expect(vc.type).toContain('DocumentSignatureVC')
      expect(vc.proof).toBeDefined()
    })

    it('VC has proper Ed25519 proof structure', async () => {
      const session = makeSession()
      await signDocument(session, TEST_PDF_BYTES)

      const vc = (ctx.storeCredential as ReturnType<typeof vi.fn>).mock.calls[0][0] as VerifiableCredential
      const proof = vc.proof as Record<string, unknown>
      expect(proof.type).toBe('Ed25519Signature2020')
      expect(proof.verificationMethod).toBe(TEST_VERIFICATION_METHOD)
      expect(proof.proofPurpose).toBe('assertionMethod')
      expect(proof.proofValue).toBe(TEST_SIGNATURE)
      expect(proof.publicKey).toBe(TEST_PUBLIC_KEY)
      expect(proof.created).toBeTruthy()
    })

    it('VC issuer is the user DID, not "self"', async () => {
      const session = makeSession()
      await signDocument(session, TEST_PDF_BYTES)

      const vc = (ctx.storeCredential as ReturnType<typeof vi.fn>).mock.calls[0][0] as VerifiableCredential
      expect(vc.issuer).toEqual({ id: TEST_DID, name: 'Attestto' })
    })

    it('VC credentialSubject.id is the user DID', async () => {
      const session = makeSession()
      await signDocument(session, TEST_PDF_BYTES)

      const vc = (ctx.storeCredential as ReturnType<typeof vi.fn>).mock.calls[0][0] as VerifiableCredential
      expect(vc.credentialSubject.id).toBe(TEST_DID)
    })

    it('includes document metadata in credentialSubject', async () => {
      const session = makeSession()
      await signDocument(session, TEST_PDF_BYTES)

      const vc = (ctx.storeCredential as ReturnType<typeof vi.fn>).mock.calls[0][0] as VerifiableCredential
      expect(vc.credentialSubject.documentType).toBe('service_agreement_short')
      expect(vc.credentialSubject.riskLevel).toBe('medium')
      expect(vc.credentialSubject.fileName).toBe('contract.pdf')
      expect(vc.credentialSubject.questionsAnswered).toBe(1)
      expect(vc.credentialSubject.recommendation).toBe('sign')
      expect(vc.credentialSubject.flaggedClausesCount).toBe(1)
    })

    it('hashes same PDF bytes to same hash', async () => {
      const session1 = makeSession({ id: 'session-1' })
      const session2 = makeSession({ id: 'session-2' })
      const record1 = await signDocument(session1, TEST_PDF_BYTES)
      const record2 = await signDocument(session2, TEST_PDF_BYTES)
      expect(record1.pdfHash).toBe(record2.pdfHash)
    })

    it('hashes different PDF bytes to different hashes', async () => {
      const session1 = makeSession({ id: 'session-1' })
      const session2 = makeSession({ id: 'session-2' })
      const otherPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2e])
      const record1 = await signDocument(session1, TEST_PDF_BYTES)
      const record2 = await signDocument(session2, otherPdf)
      expect(record1.pdfHash).not.toBe(record2.pdfHash)
    })

    it('defaults to unknown/high when no analysis', async () => {
      const session = makeSession({ analysis: null })
      const record = await signDocument(session, TEST_PDF_BYTES)
      expect(record.documentType).toBe('unknown')
      expect(record.riskLevel).toBe('high')
    })

    it('throws when module context not set', async () => {
      setSignerContext(null as unknown as ModuleContext)
      const session = makeSession()
      await expect(signDocument(session, TEST_PDF_BYTES)).rejects.toThrow('Contexto de modulo no disponible')
    })
  })
})
