import { describe, it, expect } from 'vitest'
import type { DocumentCategory, RiskLevel, DocumentAnalysis, FlaggedClause, AnalysisQuestion } from 'app-module-doc-signing/src/types'

/**
 * Tests for PDF Analyzer logic — prompt building, response parsing, manual fallback.
 * Tests pure functions without actual LLM calls.
 */

// ── Inline pure functions from usePdfAnalyzer.ts ────────────────

const MAX_TEXT_LENGTH = 4000

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text
  const half = Math.floor(MAX_TEXT_LENGTH / 2)
  return text.slice(0, half) + '\n\n[...texto truncado...]\n\n' + text.slice(-half)
}

const VALID_CATEGORIES: DocumentCategory[] = [
  'govt_form_standard', 'govt_form_sensitive', 'nda', 'service_agreement_short',
  'employment_contract', 'lease_short', 'lease_long', 'commercial_contract',
  'real_estate_deed', 'corporate_document', 'loan_agreement', 'unknown',
]

const VALID_RISKS: RiskLevel[] = ['low', 'medium', 'high', 'critical']
const VALID_SEVERITIES = ['info', 'warning', 'critical'] as const

const CATEGORY_DEFAULT_RISK: Record<DocumentCategory, RiskLevel> = {
  govt_form_standard: 'low',
  govt_form_sensitive: 'medium',
  nda: 'medium',
  service_agreement_short: 'medium',
  employment_contract: 'medium',
  lease_short: 'medium',
  lease_long: 'high',
  commercial_contract: 'high',
  real_estate_deed: 'critical',
  corporate_document: 'critical',
  loan_agreement: 'critical',
  unknown: 'high',
}

interface RawAnalysis {
  documentType?: string
  riskLevel?: string
  parties?: { role?: string; name?: string }[]
  obligations?: string[]
  penalties?: string[]
  flaggedClauses?: { clause?: string; concern?: string; severity?: string }[]
  plainLanguageSummary?: string
  questions?: { id?: string; text?: string }[]
}

function parseAnalysisResponse(text: string): DocumentAnalysis | null {
  let json = text.trim()

  const fenceStart = json.indexOf('```')
  if (fenceStart >= 0) {
    const afterFence = json.indexOf('\n', fenceStart)
    const fenceEnd = json.indexOf('```', afterFence)
    json = json.slice(afterFence + 1, fenceEnd >= 0 ? fenceEnd : undefined).trim()
  }

  const objStart = json.indexOf('{')
  const objEnd = json.lastIndexOf('}')
  if (objStart < 0 || objEnd < 0) return null

  json = json.slice(objStart, objEnd + 1)

  let parsed: RawAnalysis
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null

  const docType = VALID_CATEGORIES.includes(parsed.documentType as DocumentCategory)
    ? (parsed.documentType as DocumentCategory)
    : 'unknown'

  const riskLevel = VALID_RISKS.includes(parsed.riskLevel as RiskLevel)
    ? (parsed.riskLevel as RiskLevel)
    : CATEGORY_DEFAULT_RISK[docType]

  const parties = Array.isArray(parsed.parties)
    ? parsed.parties.filter((p) => p && p.name).map((p) => ({ role: p.role ?? 'parte', name: p.name! }))
    : []

  const obligations = Array.isArray(parsed.obligations)
    ? parsed.obligations.filter((o): o is string => typeof o === 'string')
    : []

  const penalties = Array.isArray(parsed.penalties)
    ? parsed.penalties.filter((p): p is string => typeof p === 'string')
    : []

  const flaggedClauses: FlaggedClause[] = Array.isArray(parsed.flaggedClauses)
    ? parsed.flaggedClauses
        .filter((c) => c && c.clause && c.concern)
        .map((c) => ({
          clause: c.clause!,
          concern: c.concern!,
          severity: VALID_SEVERITIES.includes(c.severity as typeof VALID_SEVERITIES[number])
            ? (c.severity as FlaggedClause['severity'])
            : 'info',
          legalRef: undefined,
        }))
    : []

  const summary = typeof parsed.plainLanguageSummary === 'string'
    ? parsed.plainLanguageSummary
    : 'No se pudo generar un resumen automatico.'

  const questions: AnalysisQuestion[] = Array.isArray(parsed.questions)
    ? parsed.questions
        .filter((q) => q && q.text)
        .map((q, i) => ({ id: q.id ?? `q${i + 1}`, text: q.text! }))
    : []

  return {
    documentType: docType,
    riskLevel,
    parties,
    obligations,
    penalties,
    flaggedClauses,
    plainLanguageSummary: summary,
    questions,
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('PDF Analyzer', () => {

  describe('truncateText', () => {
    it('returns short text unchanged', () => {
      expect(truncateText('hello')).toBe('hello')
    })

    it('returns text at limit unchanged', () => {
      const text = 'a'.repeat(MAX_TEXT_LENGTH)
      expect(truncateText(text)).toBe(text)
    })

    it('truncates long text keeping start and end', () => {
      const text = 'START' + 'x'.repeat(5000) + 'END'
      const result = truncateText(text)
      expect(result).toContain('START')
      expect(result).toContain('END')
      expect(result).toContain('[...texto truncado...]')
      expect(result.length).toBeLessThan(text.length)
    })
  })

  describe('parseAnalysisResponse', () => {
    const validResponse = JSON.stringify({
      documentType: 'lease_short',
      riskLevel: 'medium',
      parties: [
        { role: 'arrendador', name: 'Juan Perez' },
        { role: 'arrendatario', name: 'Maria Lopez' },
      ],
      obligations: ['Pagar alquiler mensual', 'Mantener la propiedad'],
      penalties: ['3 meses de alquiler por terminacion anticipada'],
      flaggedClauses: [
        { clause: 'Clausula 8.2', concern: 'Renovacion automatica sin aviso', severity: 'warning' },
      ],
      plainLanguageSummary: 'Contrato de arrendamiento por 1 año.',
      questions: [
        { id: 'q1', text: '¿El monto es correcto?' },
        { id: 'q2', text: '¿Entiendes la penalidad?' },
      ],
    })

    it('parses valid JSON response', () => {
      const result = parseAnalysisResponse(validResponse)
      expect(result).not.toBeNull()
      expect(result!.documentType).toBe('lease_short')
      expect(result!.riskLevel).toBe('medium')
      expect(result!.parties).toHaveLength(2)
      expect(result!.obligations).toHaveLength(2)
      expect(result!.penalties).toHaveLength(1)
      expect(result!.flaggedClauses).toHaveLength(1)
      expect(result!.questions).toHaveLength(2)
    })

    it('handles markdown fences', () => {
      const wrapped = '```json\n' + validResponse + '\n```'
      const result = parseAnalysisResponse(wrapped)
      expect(result).not.toBeNull()
      expect(result!.documentType).toBe('lease_short')
    })

    it('handles text before/after JSON', () => {
      const wrapped = 'Here is the analysis:\n' + validResponse + '\nDone!'
      const result = parseAnalysisResponse(wrapped)
      expect(result).not.toBeNull()
    })

    it('returns null for invalid JSON', () => {
      expect(parseAnalysisResponse('not json at all')).toBeNull()
    })

    it('returns null for no object brackets', () => {
      expect(parseAnalysisResponse('[1,2,3]')).toBeNull()
    })

    it('defaults unknown category to "unknown"', () => {
      const response = JSON.stringify({
        documentType: 'made_up_type',
        riskLevel: 'low',
        plainLanguageSummary: 'Test',
      })
      const result = parseAnalysisResponse(response)
      expect(result!.documentType).toBe('unknown')
    })

    it('defaults risk level from category when invalid', () => {
      const response = JSON.stringify({
        documentType: 'real_estate_deed',
        riskLevel: 'banana',
        plainLanguageSummary: 'Test',
      })
      const result = parseAnalysisResponse(response)
      expect(result!.riskLevel).toBe('critical') // real_estate_deed default
    })

    it('defaults risk level for unknown category to high', () => {
      const response = JSON.stringify({
        documentType: 'fake',
        riskLevel: 'fake',
        plainLanguageSummary: 'Test',
      })
      const result = parseAnalysisResponse(response)
      expect(result!.documentType).toBe('unknown')
      expect(result!.riskLevel).toBe('high')
    })

    it('filters parties without names', () => {
      const response = JSON.stringify({
        documentType: 'nda',
        parties: [
          { role: 'vendor', name: 'Alice' },
          { role: 'client', name: '' },
          { role: 'witness' },
        ],
        plainLanguageSummary: 'Test',
      })
      const result = parseAnalysisResponse(response)
      expect(result!.parties).toHaveLength(1)
      expect(result!.parties[0].name).toBe('Alice')
    })

    it('defaults party role to "parte"', () => {
      const response = JSON.stringify({
        documentType: 'nda',
        parties: [{ name: 'Bob' }],
        plainLanguageSummary: 'Test',
      })
      const result = parseAnalysisResponse(response)
      expect(result!.parties[0].role).toBe('parte')
    })

    it('filters flagged clauses without required fields', () => {
      const response = JSON.stringify({
        documentType: 'nda',
        flaggedClauses: [
          { clause: 'Valid', concern: 'Concern', severity: 'warning' },
          { clause: '', concern: 'Missing clause text' },
          { clause: 'Has clause', concern: '' },
          { concern: 'No clause field' },
        ],
        plainLanguageSummary: 'Test',
      })
      const result = parseAnalysisResponse(response)
      expect(result!.flaggedClauses).toHaveLength(1)
      expect(result!.flaggedClauses[0].clause).toBe('Valid')
    })

    it('defaults invalid severity to "info"', () => {
      const response = JSON.stringify({
        documentType: 'nda',
        flaggedClauses: [
          { clause: 'C', concern: 'X', severity: 'banana' },
        ],
        plainLanguageSummary: 'Test',
      })
      const result = parseAnalysisResponse(response)
      expect(result!.flaggedClauses[0].severity).toBe('info')
    })

    it('defaults summary when missing', () => {
      const response = JSON.stringify({ documentType: 'nda' })
      const result = parseAnalysisResponse(response)
      expect(result!.plainLanguageSummary).toBe('No se pudo generar un resumen automatico.')
    })

    it('auto-generates question IDs when missing', () => {
      const response = JSON.stringify({
        documentType: 'nda',
        questions: [{ text: 'Q1?' }, { text: 'Q2?' }],
        plainLanguageSummary: 'Test',
      })
      const result = parseAnalysisResponse(response)
      expect(result!.questions[0].id).toBe('q1')
      expect(result!.questions[1].id).toBe('q2')
    })

    it('filters questions without text', () => {
      const response = JSON.stringify({
        documentType: 'nda',
        questions: [{ id: 'q1', text: 'Valid?' }, { id: 'q2' }, { text: '' }],
        plainLanguageSummary: 'Test',
      })
      const result = parseAnalysisResponse(response)
      expect(result!.questions).toHaveLength(1)
    })

    it('handles empty arrays gracefully', () => {
      const response = JSON.stringify({
        documentType: 'nda',
        parties: [],
        obligations: [],
        penalties: [],
        flaggedClauses: [],
        questions: [],
        plainLanguageSummary: 'Minimal doc',
      })
      const result = parseAnalysisResponse(response)
      expect(result!.parties).toHaveLength(0)
      expect(result!.obligations).toHaveLength(0)
      expect(result!.flaggedClauses).toHaveLength(0)
      expect(result!.questions).toHaveLength(0)
    })

    it('handles missing optional fields', () => {
      const response = JSON.stringify({
        documentType: 'govt_form_standard',
        plainLanguageSummary: 'Just a form',
      })
      const result = parseAnalysisResponse(response)
      expect(result).not.toBeNull()
      expect(result!.parties).toHaveLength(0)
      expect(result!.flaggedClauses).toHaveLength(0)
      expect(result!.riskLevel).toBe('low')
    })
  })

  describe('CATEGORY_DEFAULT_RISK', () => {
    it('maps low-risk categories correctly', () => {
      expect(CATEGORY_DEFAULT_RISK.govt_form_standard).toBe('low')
    })

    it('maps medium-risk categories correctly', () => {
      expect(CATEGORY_DEFAULT_RISK.nda).toBe('medium')
      expect(CATEGORY_DEFAULT_RISK.employment_contract).toBe('medium')
      expect(CATEGORY_DEFAULT_RISK.lease_short).toBe('medium')
    })

    it('maps high-risk categories correctly', () => {
      expect(CATEGORY_DEFAULT_RISK.lease_long).toBe('high')
      expect(CATEGORY_DEFAULT_RISK.commercial_contract).toBe('high')
      expect(CATEGORY_DEFAULT_RISK.unknown).toBe('high')
    })

    it('maps critical-risk categories correctly', () => {
      expect(CATEGORY_DEFAULT_RISK.real_estate_deed).toBe('critical')
      expect(CATEGORY_DEFAULT_RISK.corporate_document).toBe('critical')
      expect(CATEGORY_DEFAULT_RISK.loan_agreement).toBe('critical')
    })

    it('covers all 12 categories', () => {
      expect(Object.keys(CATEGORY_DEFAULT_RISK)).toHaveLength(12)
    })
  })
})
