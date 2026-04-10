import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock idb-keyval before importing useCrypto
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

// Polyfill localStorage for jsdom if missing .clear
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

import {
  isRegistered,
  isAuthenticated,
  sign,
  verify,
  clearSession,
  toBase64url,
  fromBase64url,
} from '@/composables/useCrypto'

describe('useCrypto', () => {
  beforeEach(() => {
    localStorage.clear()
    mockStore.clear()
    clearSession()
  })

  describe('base64url encoding', () => {
    it('round-trips bytes correctly', () => {
      const original = new Uint8Array([0, 1, 2, 255, 128, 64])
      const encoded = toBase64url(original)
      const decoded = fromBase64url(encoded)
      expect(decoded).toEqual(original)
    })

    it('produces URL-safe characters', () => {
      const bytes = new Uint8Array(256)
      for (let i = 0; i < 256; i++) bytes[i] = i
      const encoded = toBase64url(bytes)
      expect(encoded).not.toMatch(/[+/=]/)
    })

    it('handles empty array', () => {
      const encoded = toBase64url(new Uint8Array(0))
      const decoded = fromBase64url(encoded)
      expect(decoded).toEqual(new Uint8Array(0))
    })
  })

  describe('registration state', () => {
    it('returns false when no credential stored', () => {
      expect(isRegistered()).toBe(false)
    })

    it('returns true when credential ID exists in localStorage', () => {
      localStorage.setItem('attestto:webauthn:credentialId', 'test-id')
      expect(isRegistered()).toBe(true)
    })
  })

  describe('authentication state', () => {
    it('starts unauthenticated', () => {
      expect(isAuthenticated()).toBe(false)
    })

    it('sign throws when not authenticated', () => {
      expect(() => sign(new Uint8Array([1, 2, 3]))).toThrow('Vault locked')
    })
  })

  describe('clearSession', () => {
    it('clears authentication state', () => {
      clearSession()
      expect(isAuthenticated()).toBe(false)
    })
  })
})
