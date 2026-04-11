import { describe, it, expect } from 'vitest'

// Import from module source directly since it's in the monorepo
import {
  encodeWatermark,
  decodeWatermark,
  buildWatermarkPayload,
  stripWatermark,
} from '../../modules/cr-driving/src/composables/useWatermark'

describe('useWatermark', () => {
  describe('encodeWatermark / decodeWatermark', () => {
    it('round-trips ASCII text', () => {
      const original = 'hello123'
      const encoded = encodeWatermark(original)
      const decoded = decodeWatermark(encoded)
      expect(decoded).toBe(original)
    })

    it('round-trips payload with special chars', () => {
      const original = 'abc|def|42|1700000000'
      const encoded = encodeWatermark(original)
      const decoded = decodeWatermark(encoded)
      expect(decoded).toBe(original)
    })

    it('encoded text is invisible (zero-width chars only)', () => {
      const encoded = encodeWatermark('test')
      // Should only contain zero-width chars
      const visibleChars = encoded.replace(/[\u200B\u200C\u200D]/g, '')
      expect(visibleChars).toBe('')
    })

    it('encoded text has zero visual width', () => {
      const encoded = encodeWatermark('test')
      expect(encoded.length).toBeGreaterThan(0)
      // All chars should be zero-width
      for (const ch of encoded) {
        expect(['\u200B', '\u200C', '\u200D']).toContain(ch)
      }
    })
  })

  describe('buildWatermarkPayload', () => {
    it('contains session ID prefix', () => {
      const payload = buildWatermarkPayload('session-12345678', 'did:web:user.attestto.id', 5)
      expect(payload).toContain('session-')
    })

    it('contains question index', () => {
      const payload = buildWatermarkPayload('abc', 'did:web:user.attestto.id', 42)
      expect(payload).toContain('42')
    })

    it('contains DID suffix', () => {
      const payload = buildWatermarkPayload('abc', 'did:web:eduardo.attestto.id', 1)
      expect(payload).toContain('.attestto.id')
    })
  })

  describe('stripWatermark', () => {
    it('removes zero-width characters from text', () => {
      const text = 'Hello\u200B\u200Cworld\u200D'
      expect(stripWatermark(text)).toBe('Helloworld')
    })

    it('leaves normal text unchanged', () => {
      expect(stripWatermark('normal text')).toBe('normal text')
    })
  })
})
