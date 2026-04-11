import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Mock idb-keyval ──────────────────────────────────
const mockStore = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    mockStore.set(key, value)
    return Promise.resolve()
  }),
  del: vi.fn((key: string) => {
    mockStore.delete(key)
    return Promise.resolve()
  }),
}))

// ── Mock useCrypto ───────────────────────────────────
const fakeSeed = new Uint8Array(32)
fakeSeed.fill(42)

let registered = false
let authenticated = false

vi.mock('@/composables/useCrypto', () => ({
  isRegistered: () => registered,
  isAuthenticated: () => authenticated,
  register: vi.fn(async () => {
    registered = true
    authenticated = true
  }),
  authenticate: vi.fn(async () => {
    authenticated = true
  }),
  getDID: () => 'did:web:test.attestto.id',
  getDisplayName: () => 'Test User',
  getPublicKeyBase64url: () => 'dGVzdC1wdWJrZXk',
  getKeySeed: () => fakeSeed,
  getVerificationMethod: () => 'did:web:test.attestto.id#key-1',
  sign: vi.fn(() => new Uint8Array([1, 2, 3])),
  toBase64url: (bytes: Uint8Array) => {
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  },
  clearSession: vi.fn(() => {
    authenticated = false
  }),
}))

// ── Polyfill localStorage for jsdom ──────────────────
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.clear) {
  const store: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { for (const k of Object.keys(store)) delete store[k] },
    },
    writable: true,
  })
}

import { useVaultStore } from '@/stores/vault'

describe('vault store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStore.clear()
    localStorage.clear()
    registered = false
    authenticated = false
  })

  describe('unlock', () => {
    it('registers new user when no prior credential', async () => {
      const vault = useVaultStore()
      expect(vault.unlocked).toBe(false)

      await vault.unlock()

      expect(vault.unlocked).toBe(true)
      expect(vault.did).toBe('did:web:test.attestto.id')
      expect(vault.displayName).toBe('Test User')
      expect(vault.publicKey).toBe('dGVzdC1wdWJrZXk')
    })

    it('authenticates existing user when registered', async () => {
      registered = true
      const vault = useVaultStore()

      await vault.unlock()

      expect(vault.unlocked).toBe(true)
    })

    it('seeds demo credentials on first unlock', async () => {
      const vault = useVaultStore()
      await vault.unlock()

      expect(vault.credentials.length).toBe(3)
      expect(vault.credentials[0].type).toContain('CedulaIdentidadCR')
      expect(vault.credentials[1].type).toContain('DictamenMedicoCR')
      expect(vault.credentials[2].type).toContain('PassportUS')
    })

    it('persists demo credentials to encrypted vault', async () => {
      const vault = useVaultStore()
      await vault.unlock()

      // Encrypted data was written to idb-keyval
      expect(mockStore.has('attestto:vault:encrypted')).toBe(true)
      const stored = mockStore.get('attestto:vault:encrypted') as {
        version: number
        ciphertext: string
        iv: string
      }
      expect(stored.version).toBe(1)
      expect(stored.ciphertext).toBeTruthy()
      expect(stored.iv).toBeTruthy()
    })
  })

  describe('lock', () => {
    it('clears unlocked state', async () => {
      const vault = useVaultStore()
      await vault.unlock()
      expect(vault.unlocked).toBe(true)

      vault.lock()
      expect(vault.unlocked).toBe(false)
    })
  })

  describe('encryption round-trip', () => {
    it('credentials survive lock → unlock cycle', async () => {
      const vault = useVaultStore()

      // First unlock: seeds demo credentials + persists encrypted
      await vault.unlock()
      expect(vault.credentials.length).toBe(3)
      const firstIds = vault.credentials.map((vc) => vc.id)

      // Lock clears session
      vault.lock()
      expect(vault.unlocked).toBe(false)

      // Re-create store to simulate fresh app state
      setActivePinia(createPinia())
      registered = true
      const vault2 = useVaultStore()

      // Second unlock: loads from encrypted vault (not demo seed)
      await vault2.unlock()
      expect(vault2.credentials.length).toBe(3)
      expect(vault2.credentials.map((vc) => vc.id)).toEqual(firstIds)
    })
  })

  describe('addCredential', () => {
    it('adds and persists a new credential', async () => {
      const vault = useVaultStore()
      await vault.unlock()
      const initialCount = vault.credentials.length

      await vault.addCredential({
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'TestCredential'],
        id: 'urn:uuid:test-add-001',
        issuer: { id: 'did:web:test.issuer', name: 'Test Issuer' },
        issuanceDate: '2026-01-01T00:00:00Z',
        credentialSubject: { id: 'did:web:demo.attestto.id' },
      })

      expect(vault.credentials.length).toBe(initialCount + 1)
      expect(vault.credentials.find((vc) => vc.id === 'urn:uuid:test-add-001')).toBeTruthy()
    })
  })

  describe('removeCredential', () => {
    it('removes and persists without the credential', async () => {
      const vault = useVaultStore()
      await vault.unlock()
      const initialCount = vault.credentials.length

      await vault.removeCredential('urn:uuid:cedula-demo-001')

      expect(vault.credentials.length).toBe(initialCount - 1)
      expect(vault.credentials.find((vc) => vc.id === 'urn:uuid:cedula-demo-001')).toBeUndefined()
    })
  })

  describe('sign', () => {
    it('returns signature and verification method when unlocked', async () => {
      const vault = useVaultStore()
      await vault.unlock()

      const result = await vault.sign('test-payload')
      expect(result.signature).toBeTruthy()
      expect(result.verificationMethod).toBe('did:web:test.attestto.id#key-1')
    })

    it('throws when vault is locked', async () => {
      const vault = useVaultStore()
      await expect(vault.sign('test')).rejects.toThrow('Vault locked')
    })
  })

  describe('computed properties', () => {
    it('credentialTypes flattens all VC types', async () => {
      const vault = useVaultStore()
      await vault.unlock()

      expect(vault.credentialTypes).toContain('VerifiableCredential')
      expect(vault.credentialTypes).toContain('CedulaIdentidadCR')
      expect(vault.credentialTypes).toContain('DictamenMedicoCR')
      expect(vault.credentialTypes).toContain('PassportUS')
    })

    it('credentialsByCountry groups correctly', async () => {
      const vault = useVaultStore()
      await vault.unlock()

      expect(vault.credentialsByCountry.get('CR')?.length).toBe(2)
      expect(vault.credentialsByCountry.get('US')?.length).toBe(1)
    })
  })

  describe('migration', () => {
    it('migrates localStorage credentials to encrypted vault on first unlock', async () => {
      const creds = [{ id: 'urn:uuid:legacy', type: ['VerifiableCredential'], '@context': [] }]
      localStorage.setItem('attestto:vault:credentials', JSON.stringify(creds))

      const vault = useVaultStore()
      await vault.unlock()

      // Migration should have removed localStorage key
      expect(localStorage.getItem('attestto:vault:credentials')).toBeNull()
    })
  })
})
