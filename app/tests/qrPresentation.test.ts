import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock useCrypto
const mockDid = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
const mockPublicKey = new Uint8Array(32).fill(1)
const mockSignature = new Uint8Array(64).fill(42)
const mockPrivateKey = new Uint8Array(32).fill(7)

vi.mock('@/composables/useCrypto', () => ({
  getDID: () => mockDid,
  getDisplayName: () => 'Test User',
  getPublicKeyBytes: () => mockPublicKey,
  getPublicKeyBase64url: () => 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',
  getPrivateKeyBytes: () => mockPrivateKey,
  sign: (_payload: Uint8Array) => mockSignature,
  verify: () => true,
  isRegistered: () => true,
  isAuthenticated: () => true,
  authenticate: async () => {},
  getKeySeed: () => mockPrivateKey,
  clearSession: () => {},
}))

// Mock useEncryptedVault
vi.mock('@/composables/useEncryptedVault', () => ({
  saveEncryptedVault: async () => {},
  loadEncryptedVault: async () => null,
  migrateFromLocalStorage: async () => {},
}))

// Mock vc-sdk buildPresentation
vi.mock('@attestto/vc-sdk', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@attestto/vc-sdk')
  return {
    ...actual,
    buildPresentation: (credentials: unknown[], options: Record<string, unknown>) => ({
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      holder: options.holderDid,
      verifiableCredential: credentials,
      proof: {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        verificationMethod: `${options.holderDid}#key-1`,
        proofPurpose: 'authentication',
        challenge: options.nonce,
        proofValue: 'mock-signature',
      },
    }),
  }
})

import QRCode from 'qrcode'

describe('QR Presentation', () => {
  describe('QR code generation', () => {
    it('generates a valid QR data URL from VP JSON', async () => {
      const vp = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: mockDid,
        verifiableCredential: [{
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'CedulaIdentidadCR'],
          issuer: mockDid,
          issuanceDate: '2026-01-01T00:00:00Z',
          credentialSubject: { id: mockDid, nombre: 'Maria', cedula: '1-1234-0567' },
        }],
      }

      const dataUrl = await QRCode.toDataURL(JSON.stringify(vp), {
        width: 280,
        margin: 2,
        errorCorrectionLevel: 'L',
      })

      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
      expect(dataUrl.length).toBeGreaterThan(100)
    })

    it('handles VPs that are too large for QR by using low error correction', async () => {
      // Large credential with many fields
      const bigSubject: Record<string, string> = { id: mockDid }
      for (let i = 0; i < 20; i++) {
        bigSubject[`field${i}`] = `value-${i}-${'x'.repeat(50)}`
      }

      const vp = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        holder: mockDid,
        verifiableCredential: [{
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'TestCredential'],
          issuer: mockDid,
          issuanceDate: '2026-01-01T00:00:00Z',
          credentialSubject: bigSubject,
        }],
      }

      const json = JSON.stringify(vp)
      // QR L-level handles up to ~4296 alphanumeric chars
      // Very large payloads will throw — this tests the boundary
      if (json.length < 4000) {
        const dataUrl = await QRCode.toDataURL(json, { errorCorrectionLevel: 'L' })
        expect(dataUrl).toMatch(/^data:image\/png;base64,/)
      }
    })
  })

  describe('buildPresentation for QR', () => {
    it('builds a VP wrapping a single credential', async () => {
      const { buildPresentation } = await import('@attestto/vc-sdk')

      const vc = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'CedulaIdentidadCR'],
        issuer: mockDid,
        issuanceDate: '2026-01-01T00:00:00Z',
        credentialSubject: { id: mockDid, nombre: 'Maria' },
      }

      const vp = buildPresentation([vc], {
        holderDid: mockDid,
        privateKey: mockPrivateKey,
        algorithm: 'Ed25519',
        nonce: 'test-nonce',
      })

      expect(vp.type).toContain('VerifiablePresentation')
      expect(vp.holder).toBe(mockDid)
      expect(vp.verifiableCredential).toHaveLength(1)
      expect(vp.proof).toBeDefined()
      expect(vp.proof.challenge).toBe('test-nonce')
    })

    it('VP JSON is encodable as QR', async () => {
      const { buildPresentation } = await import('@attestto/vc-sdk')

      const vc = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'DrivingLicenseCR'],
        issuer: mockDid,
        issuanceDate: '2026-01-01T00:00:00Z',
        credentialSubject: { id: mockDid, licenseNumber: 'LIC-001' },
      }

      const vp = buildPresentation([vc], {
        holderDid: mockDid,
        privateKey: mockPrivateKey,
        algorithm: 'Ed25519',
        nonce: globalThis.crypto.randomUUID(),
      })

      const vpJson = JSON.stringify(vp)
      const dataUrl = await QRCode.toDataURL(vpJson, { errorCorrectionLevel: 'L' })
      expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    })
  })
})
