import { describe, it, expect } from 'vitest'
import { buildEvidenceBundle } from '../../modules/cr-driving/src/composables/useEvidenceExport'
import type { ExamResult } from '../../modules/cr-driving/src/types'

describe('useEvidenceExport', () => {
  const mockResult: ExamResult = {
    passed: true,
    score: 85,
    correct: 34,
    wrong: 6,
    total: 40,
    durationSeconds: 1800,
    categoryBreakdown: [
      { category: 'Senales', correct: 10, total: 12, percent: 83 },
      { category: 'Seguridad', correct: 8, total: 10, percent: 80 },
    ],
    weakTopics: ['Prioridades'],
    chainHead: 'a'.repeat(64),
    incidents: [
      { type: 'face-absent', severity: 'warning', timestamp: Date.now(), count: 1 },
    ],
  }

  describe('buildEvidenceBundle', () => {
    it('creates a bundle with version 1', () => {
      const bundle = buildEvidenceBundle('session-123', mockResult)
      expect(bundle.version).toBe(1)
    })

    it('includes session ID', () => {
      const bundle = buildEvidenceBundle('session-123', mockResult)
      expect(bundle.sessionId).toBe('session-123')
    })

    it('includes exam result', () => {
      const bundle = buildEvidenceBundle('session-123', mockResult)
      expect(bundle.result.score).toBe(85)
      expect(bundle.result.passed).toBe(true)
    })

    it('includes incidents from result', () => {
      const bundle = buildEvidenceBundle('session-123', mockResult)
      expect(bundle.incidents).toHaveLength(1)
      expect(bundle.incidents[0].type).toBe('face-absent')
    })

    it('includes export timestamp', () => {
      const bundle = buildEvidenceBundle('session-123', mockResult)
      expect(bundle.exportedAt).toBeTruthy()
      expect(new Date(bundle.exportedAt).getTime()).toBeGreaterThan(0)
    })

    it('includes chain log when provided', () => {
      const bundle = buildEvidenceBundle('session-123', mockResult, ['event1', 'event2'])
      expect(bundle.chainLog).toEqual(['event1', 'event2'])
    })
  })
})
