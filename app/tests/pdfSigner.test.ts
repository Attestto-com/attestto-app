import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PDFDocument } from 'pdf-lib'

// Mock useCrypto before importing signer
const mockDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
const mockDisplayName = 'Maria Ejemplo'
const mockPublicKey = new Uint8Array(32).fill(1)
const mockSignature = new Uint8Array(64).fill(42)

vi.mock('@/composables/useCrypto', () => ({
  getDID: () => mockDid,
  getDisplayName: () => mockDisplayName,
  getPublicKeyBytes: () => mockPublicKey,
  sign: (_payload: Uint8Array) => mockSignature,
  verify: (payload: Uint8Array, sig: Uint8Array, pubkey: Uint8Array) => {
    // Verify that signature and pubkey match our mocks
    return sig.every((b, i) => b === mockSignature[i]) && pubkey.every((b, i) => b === mockPublicKey[i])
  },
}))

import {
  signPdf,
  extractSignature,
  verifySignature,
  hasExistingSignature,
} from '../src/composables/usePdfSigner'

async function createTestPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  page.drawText('Test document for signing', { x: 50, y: 700, size: 14 })
  return doc.save()
}

describe('PDF Signer', () => {
  let testPdf: Uint8Array

  beforeEach(async () => {
    testPdf = await createTestPdf()
  })

  describe('signPdf', () => {
    it('signs a PDF and returns signed bytes + signature', async () => {
      const result = await signPdf({
        pdfBytes: testPdf,
        fileName: 'test.pdf',
      })

      expect(result.pdfBytes).toBeInstanceOf(Uint8Array)
      expect(result.pdfBytes.length).toBeGreaterThan(testPdf.length)
      expect(result.originalHash).toMatch(/^[a-f0-9]{64}$/)
      expect(result.signature.v).toBe(1)
      expect(result.signature.issuer).toBe(mockDid)
      expect(result.signature.issuerName).toBe(mockDisplayName)
      expect(result.signature.level).toBe('self-attested')
      expect(result.signature.mock).toBe(false)
      expect(result.signature.mode).toBe('final')
      expect(result.signature.proof.type).toBe('Ed25519Signature2020')
      expect(result.stampSuppressed).toBe(false)
    })

    it('uses open mode when specified', async () => {
      const result = await signPdf({
        pdfBytes: testPdf,
        fileName: 'test.pdf',
        mode: 'open',
      })

      expect(result.signature.mode).toBe('open')
    })

    it('includes reason when provided', async () => {
      const result = await signPdf({
        pdfBytes: testPdf,
        fileName: 'test.pdf',
        reason: 'Aprobacion de contrato',
      })

      expect(result.signature.reason).toBe('Aprobacion de contrato')
    })

    it('embeds signature in PDF Keywords field', async () => {
      const result = await signPdf({ pdfBytes: testPdf, fileName: 'test.pdf' })

      const doc = await PDFDocument.load(result.pdfBytes)
      const keywords = doc.getKeywords() ?? ''
      expect(keywords).toContain('attestto-sig-v1:')
    })

    it('sets Producer to Attestto App', async () => {
      const result = await signPdf({ pdfBytes: testPdf, fileName: 'test.pdf' })

      const doc = await PDFDocument.load(result.pdfBytes, { updateMetadata: false })
      expect(doc.getProducer()).toBe('Attestto App')
    })
  })

  describe('extractSignature', () => {
    it('extracts signature from signed PDF', async () => {
      const signed = await signPdf({ pdfBytes: testPdf, fileName: 'test.pdf' })
      const sig = await extractSignature(signed.pdfBytes)

      expect(sig).not.toBeNull()
      expect(sig!.v).toBe(1)
      expect(sig!.issuer).toBe(mockDid)
      expect(sig!.documentHash).toBe(signed.originalHash)
      expect(sig!.proof.proofPurpose).toBe('assertionMethod')
    })

    it('returns null for unsigned PDF', async () => {
      const sig = await extractSignature(testPdf)
      expect(sig).toBeNull()
    })

    it('returns null for malformed input', async () => {
      const sig = await extractSignature(new Uint8Array([1, 2, 3]))
      expect(sig).toBeNull()
    })
  })

  describe('verifySignature', () => {
    it('verifies a valid signed PDF', async () => {
      const signed = await signPdf({ pdfBytes: testPdf, fileName: 'test.pdf' })
      const result = await verifySignature(signed.pdfBytes)

      expect(result).not.toBeNull()
      expect(result!.signatureValid).toBe(true)
      expect(result!.signature.issuer).toBe(mockDid)
    })

    it('returns null for unsigned PDF', async () => {
      const result = await verifySignature(testPdf)
      expect(result).toBeNull()
    })
  })

  describe('hasExistingSignature', () => {
    it('returns false for a plain PDF', () => {
      expect(hasExistingSignature(testPdf)).toBe(false)
    })

    it('detects /Type /Sig pattern', () => {
      const withSig = new TextEncoder().encode('%PDF-1.4\n/Type /Sig /ByteRange [0 1 2 3]')
      expect(hasExistingSignature(withSig)).toBe(true)
    })

    it('detects /SigFlags pattern', () => {
      const withFlags = new TextEncoder().encode('%PDF-1.4\n/SigFlags 3')
      expect(hasExistingSignature(withFlags)).toBe(true)
    })
  })

  describe('round-trip: sign → extract → verify', () => {
    it('completes full signing and verification cycle', async () => {
      // Sign
      const signed = await signPdf({
        pdfBytes: testPdf,
        fileName: 'contrato.pdf',
        reason: 'Firma de contrato',
      })

      // Extract
      const sig = await extractSignature(signed.pdfBytes)
      expect(sig).not.toBeNull()
      expect(sig!.fileName).toBe('contrato.pdf')
      expect(sig!.reason).toBe('Firma de contrato')

      // Verify
      const result = await verifySignature(signed.pdfBytes)
      expect(result).not.toBeNull()
      expect(result!.valid).toBe(true)
      expect(result!.signatureValid).toBe(true)
    })

    it('preserves original document hash across sign/verify', async () => {
      const signed = await signPdf({ pdfBytes: testPdf, fileName: 'test.pdf' })
      const sig = await extractSignature(signed.pdfBytes)

      // The documented hash should be a SHA-256 hex of the ORIGINAL PDF
      expect(sig!.documentHash).toMatch(/^[a-f0-9]{64}$/)
      expect(sig!.documentHash).toBe(signed.originalHash)
    })
  })
})
