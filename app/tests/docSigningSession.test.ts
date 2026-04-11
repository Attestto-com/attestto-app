import { describe, it, expect, beforeEach } from 'vitest'
import type {
  SigningSession,
  DocumentAnalysis,
  DocumentCategory,
  UserAnswer,
} from 'app-module-doc-signing/src/types'

/**
 * Tests for signing session logic — phase transitions, recommendation engine,
 * question tracking, and session state management.
 */

// ── Inline pure logic from useSigningSession ────────────────────

function createSession(name: string): SigningSession {
  return {
    id: 'test-' + Math.random().toString(36).slice(2, 8),
    fileName: name,
    extractedText: '',
    analysis: null,
    phase: 'upload',
    chatMessages: [],
    userAnswers: [],
    recommendation: null,
    signedAt: null,
    pdfHash: null,
    signature: null,
    verificationMethod: null,
    anchorTx: null,
    vcId: null,
    createdAt: Date.now(),
    error: null,
  }
}

function getNextQuestion(
  session: SigningSession,
): { id: string; text: string } | null {
  if (!session.analysis) return null
  const answeredIds = new Set(session.userAnswers.map((a) => a.questionId))
  return session.analysis.questions.find((q) => !answeredIds.has(q.id)) ?? null
}

function computeRecommendation(session: SigningSession): 'sign' | 'review' | 'legal-advice' {
  if (!session.analysis) return 'sign'

  const { riskLevel } = session.analysis

  if (riskLevel === 'critical') return 'legal-advice'
  if (riskLevel === 'high') return 'review'

  const negativePatterns = /\bno\b|no se|no estoy seguro|no entiendo|no sabia/i
  const hasConcern = session.userAnswers.some((a) => negativePatterns.test(a.answer))

  if (hasConcern && riskLevel === 'medium') return 'review'

  return 'sign'
}

function makeAnalysis(overrides: Partial<DocumentAnalysis> = {}): DocumentAnalysis {
  return {
    documentType: 'service_agreement_short',
    riskLevel: 'medium',
    parties: [],
    obligations: [],
    penalties: [],
    flaggedClauses: [],
    plainLanguageSummary: 'Test document',
    questions: [
      { id: 'q1', text: 'Question 1?' },
      { id: 'q2', text: 'Question 2?' },
    ],
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('Signing Session', () => {

  describe('createSession', () => {
    it('creates a session with correct defaults', () => {
      const s = createSession('contract.pdf')
      expect(s.fileName).toBe('contract.pdf')
      expect(s.phase).toBe('upload')
      expect(s.analysis).toBeNull()
      expect(s.chatMessages).toHaveLength(0)
      expect(s.userAnswers).toHaveLength(0)
      expect(s.recommendation).toBeNull()
      expect(s.signedAt).toBeNull()
      expect(s.error).toBeNull()
    })

    it('generates unique IDs', () => {
      const s1 = createSession('a.pdf')
      const s2 = createSession('b.pdf')
      expect(s1.id).not.toBe(s2.id)
    })
  })

  describe('getNextQuestion', () => {
    it('returns null when no analysis', () => {
      const s = createSession('test.pdf')
      expect(getNextQuestion(s)).toBeNull()
    })

    it('returns first question when none answered', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis()
      const next = getNextQuestion(s)
      expect(next).not.toBeNull()
      expect(next!.id).toBe('q1')
    })

    it('returns second question after first answered', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis()
      s.userAnswers = [{ questionId: 'q1', answer: 'Si', timestamp: Date.now() }]
      const next = getNextQuestion(s)
      expect(next!.id).toBe('q2')
    })

    it('returns null when all questions answered', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis()
      s.userAnswers = [
        { questionId: 'q1', answer: 'Si', timestamp: Date.now() },
        { questionId: 'q2', answer: 'Si', timestamp: Date.now() },
      ]
      expect(getNextQuestion(s)).toBeNull()
    })

    it('returns null when analysis has no questions', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ questions: [] })
      expect(getNextQuestion(s)).toBeNull()
    })
  })

  describe('computeRecommendation', () => {
    it('returns "sign" when no analysis', () => {
      const s = createSession('test.pdf')
      expect(computeRecommendation(s)).toBe('sign')
    })

    it('returns "legal-advice" for critical risk', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'critical' })
      expect(computeRecommendation(s)).toBe('legal-advice')
    })

    it('returns "review" for high risk', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'high' })
      expect(computeRecommendation(s)).toBe('review')
    })

    it('returns "sign" for low risk with positive answers', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'low' })
      s.userAnswers = [{ questionId: 'q1', answer: 'Si, correcto', timestamp: Date.now() }]
      expect(computeRecommendation(s)).toBe('sign')
    })

    it('returns "sign" for medium risk with positive answers', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'medium' })
      s.userAnswers = [{ questionId: 'q1', answer: 'Si, todo bien', timestamp: Date.now() }]
      expect(computeRecommendation(s)).toBe('sign')
    })

    it('returns "review" for medium risk with negative answer "no"', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'medium' })
      s.userAnswers = [{ questionId: 'q1', answer: 'No, eso no es lo que acorde', timestamp: Date.now() }]
      expect(computeRecommendation(s)).toBe('review')
    })

    it('returns "review" for medium risk with "no estoy seguro"', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'medium' })
      s.userAnswers = [{ questionId: 'q1', answer: 'No estoy seguro de eso', timestamp: Date.now() }]
      expect(computeRecommendation(s)).toBe('review')
    })

    it('returns "review" for medium risk with "no entiendo"', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'medium' })
      s.userAnswers = [{ questionId: 'q1', answer: 'No entiendo esta clausula', timestamp: Date.now() }]
      expect(computeRecommendation(s)).toBe('review')
    })

    it('returns "review" for medium risk with "no sabia"', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'medium' })
      s.userAnswers = [{ questionId: 'q1', answer: 'No sabia eso', timestamp: Date.now() }]
      expect(computeRecommendation(s)).toBe('review')
    })

    it('returns "sign" for low risk even with negative answers', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'low' })
      s.userAnswers = [{ questionId: 'q1', answer: 'No estoy seguro', timestamp: Date.now() }]
      expect(computeRecommendation(s)).toBe('sign')
    })

    it('returns "legal-advice" for critical risk regardless of answers', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'critical' })
      s.userAnswers = [{ questionId: 'q1', answer: 'Si, todo perfecto', timestamp: Date.now() }]
      expect(computeRecommendation(s)).toBe('legal-advice')
    })

    it('handles multiple answers — one negative triggers review', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'medium' })
      s.userAnswers = [
        { questionId: 'q1', answer: 'Si, correcto', timestamp: Date.now() },
        { questionId: 'q2', answer: 'No se, no entiendo', timestamp: Date.now() },
      ]
      expect(computeRecommendation(s)).toBe('review')
    })

    it('handles empty answers array', () => {
      const s = createSession('test.pdf')
      s.analysis = makeAnalysis({ riskLevel: 'medium' })
      s.userAnswers = []
      expect(computeRecommendation(s)).toBe('sign')
    })
  })
})
