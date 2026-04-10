import { describe, it, expect } from 'vitest'
import { getExplorerUrl } from '@/composables/useAnchor'

describe('useAnchor', () => {
  describe('getExplorerUrl', () => {
    it('generates devnet URL', () => {
      const url = getExplorerUrl('abc123', 'devnet')
      expect(url).toBe('https://explorer.solana.com/tx/abc123?cluster=devnet')
    })

    it('generates mainnet URL without cluster param', () => {
      const url = getExplorerUrl('abc123', 'mainnet-beta')
      expect(url).toBe('https://explorer.solana.com/tx/abc123')
    })

    it('defaults to devnet', () => {
      const url = getExplorerUrl('xyz789')
      expect(url).toContain('cluster=devnet')
    })
  })
})
