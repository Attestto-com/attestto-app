import { describe, it, expect } from 'vitest'
import type { AgreementDraft, AgreementType } from 'app-module-agreement/src/types'

/**
 * Tests for conversation analyzer — response parsing, text truncation, manual fallback.
 */

// ── Inline pure functions from useConversationAnalyzer.ts ───────

const MAX_TEXT_LENGTH = 6000

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text
  const half = Math.floor(MAX_TEXT_LENGTH / 2)
  return text.slice(0, half) + '\n\n[...texto truncado...]\n\n' + text.slice(-half)
}

const VALID_TYPES: AgreementType[] = [
  'service_agreement', 'freelance_contract', 'informal_lease', 'personal_loan',
  'sale_agreement', 'partnership_agreement', 'purchase_commitment', 'verbal_agreement', 'unknown',
]

interface RawDraft {
  type?: string
  parties?: { role?: string; name?: string }[]
  terms?: { description?: string; value?: string }[]
  obligations?: string[]
  amounts?: { description?: string; amount?: number; currency?: string }[]
  dates?: { description?: string; date?: string }[]
  ambiguities?: string[]
  undiscussedTerms?: string[]
  summary?: string
}

function parseAnalysisResponse(text: string): AgreementDraft | null {
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

  let parsed: RawDraft
  try { parsed = JSON.parse(json) } catch { return null }
  if (!parsed || typeof parsed !== 'object') return null

  const type = VALID_TYPES.includes(parsed.type as AgreementType) ? (parsed.type as AgreementType) : 'unknown'
  const parties = Array.isArray(parsed.parties)
    ? parsed.parties.filter((p) => p && p.name).map((p) => ({ role: p.role ?? 'parte', name: p.name! }))
    : []
  const terms = Array.isArray(parsed.terms)
    ? parsed.terms.filter((t) => t && t.description && t.value).map((t) => ({ description: t.description!, value: t.value! }))
    : []
  const obligations = Array.isArray(parsed.obligations)
    ? parsed.obligations.filter((o): o is string => typeof o === 'string' && o.length > 0)
    : []
  const amounts = Array.isArray(parsed.amounts)
    ? parsed.amounts.filter((a) => a && a.description && typeof a.amount === 'number').map((a) => ({ description: a.description!, amount: a.amount!, currency: a.currency ?? 'USD' }))
    : []
  const dates = Array.isArray(parsed.dates)
    ? parsed.dates.filter((d) => d && d.description && d.date).map((d) => ({ description: d.description!, date: d.date! }))
    : []
  const ambiguities = Array.isArray(parsed.ambiguities)
    ? parsed.ambiguities.filter((a): a is string => typeof a === 'string' && a.length > 0)
    : []
  const undiscussedTerms = Array.isArray(parsed.undiscussedTerms)
    ? parsed.undiscussedTerms.filter((t): t is string => typeof t === 'string' && t.length > 0)
    : []
  const summary = typeof parsed.summary === 'string' && parsed.summary.length > 0
    ? parsed.summary
    : 'No se pudo generar un resumen automatico.'

  return { type, parties, terms, obligations, amounts, dates, ambiguities, undiscussedTerms, summary }
}

// ── Tests ────────────────────────────────────────────────────────

describe('Conversation Analyzer', () => {

  describe('truncateText', () => {
    it('returns short text unchanged', () => {
      expect(truncateText('hello')).toBe('hello')
    })

    it('returns text at limit unchanged', () => {
      const text = 'x'.repeat(MAX_TEXT_LENGTH)
      expect(truncateText(text)).toBe(text)
    })

    it('truncates long text with marker', () => {
      const text = 'START' + 'x'.repeat(8000) + 'END'
      const result = truncateText(text)
      expect(result).toContain('START')
      expect(result).toContain('END')
      expect(result).toContain('[...texto truncado...]')
    })

    it('uses 6000 char limit (larger than doc-signing)', () => {
      const text5500 = 'a'.repeat(5500)
      expect(truncateText(text5500)).toBe(text5500) // under limit
      const text7000 = 'b'.repeat(7000)
      expect(truncateText(text7000)).toContain('[...texto truncado...]') // over limit
    })
  })

  describe('parseAnalysisResponse', () => {
    const validResponse = JSON.stringify({
      type: 'freelance_contract',
      parties: [
        { role: 'contratante', name: 'Alice Rodriguez' },
        { role: 'proveedor', name: 'Bob Mendez' },
      ],
      terms: [
        { description: 'Entregable', value: 'Modulo de reporteria con dashboard' },
        { description: 'Revisiones', value: '2 rondas incluidas' },
      ],
      obligations: ['Entregar modulo funcional', 'Cubrir bugs en segunda revision'],
      amounts: [{ description: 'Precio total', amount: 5000, currency: 'USD' }],
      dates: [{ description: 'Entrega', date: '15 junio 2026' }],
      ambiguities: ['Los specs aun no estan definidos formalmente'],
      undiscussedTerms: ['Propiedad intelectual del codigo', 'Penalidad por retraso'],
      summary: 'Acuerdo de desarrollo de software por $5,000 con entrega el 15 de junio.',
    })

    it('parses valid JSON response', () => {
      const result = parseAnalysisResponse(validResponse)
      expect(result).not.toBeNull()
      expect(result!.type).toBe('freelance_contract')
      expect(result!.parties).toHaveLength(2)
      expect(result!.terms).toHaveLength(2)
      expect(result!.obligations).toHaveLength(2)
      expect(result!.amounts).toHaveLength(1)
      expect(result!.amounts[0].amount).toBe(5000)
      expect(result!.dates).toHaveLength(1)
      expect(result!.ambiguities).toHaveLength(1)
      expect(result!.undiscussedTerms).toHaveLength(2)
    })

    it('handles markdown fences', () => {
      const wrapped = '```json\n' + validResponse + '\n```'
      const result = parseAnalysisResponse(wrapped)
      expect(result).not.toBeNull()
      expect(result!.type).toBe('freelance_contract')
    })

    it('handles surrounding text', () => {
      const wrapped = 'Here is the analysis:\n' + validResponse + '\nDone!'
      const result = parseAnalysisResponse(wrapped)
      expect(result).not.toBeNull()
    })

    it('returns null for invalid JSON', () => {
      expect(parseAnalysisResponse('not json')).toBeNull()
    })

    it('returns null for no object brackets', () => {
      expect(parseAnalysisResponse('[1,2,3]')).toBeNull()
    })

    it('defaults unknown type to "unknown"', () => {
      const result = parseAnalysisResponse(JSON.stringify({ type: 'made_up', summary: 'Test' }))
      expect(result!.type).toBe('unknown')
    })

    it('validates all 9 agreement types', () => {
      for (const t of VALID_TYPES) {
        const result = parseAnalysisResponse(JSON.stringify({ type: t, summary: 'Test' }))
        expect(result!.type).toBe(t)
      }
    })

    it('filters parties without names', () => {
      const result = parseAnalysisResponse(JSON.stringify({
        type: 'service_agreement',
        parties: [{ role: 'a', name: 'Alice' }, { role: 'b', name: '' }, { role: 'c' }],
        summary: 'Test',
      }))
      expect(result!.parties).toHaveLength(1)
      expect(result!.parties[0].name).toBe('Alice')
    })

    it('defaults party role to "parte"', () => {
      const result = parseAnalysisResponse(JSON.stringify({
        type: 'service_agreement',
        parties: [{ name: 'Bob' }],
        summary: 'Test',
      }))
      expect(result!.parties[0].role).toBe('parte')
    })

    it('filters terms with missing fields', () => {
      const result = parseAnalysisResponse(JSON.stringify({
        type: 'service_agreement',
        terms: [
          { description: 'Good', value: 'Yes' },
          { description: '', value: 'Bad' },
          { description: 'No value' },
        ],
        summary: 'Test',
      }))
      expect(result!.terms).toHaveLength(1)
    })

    it('filters amounts without required fields', () => {
      const result = parseAnalysisResponse(JSON.stringify({
        type: 'service_agreement',
        amounts: [
          { description: 'Price', amount: 1000, currency: 'CRC' },
          { description: 'Bad', amount: 'not a number' },
          { amount: 500 },
        ],
        summary: 'Test',
      }))
      expect(result!.amounts).toHaveLength(1)
      expect(result!.amounts[0].currency).toBe('CRC')
    })

    it('defaults currency to USD when missing', () => {
      const result = parseAnalysisResponse(JSON.stringify({
        type: 'service_agreement',
        amounts: [{ description: 'Price', amount: 500 }],
        summary: 'Test',
      }))
      expect(result!.amounts[0].currency).toBe('USD')
    })

    it('filters dates with missing fields', () => {
      const result = parseAnalysisResponse(JSON.stringify({
        type: 'service_agreement',
        dates: [
          { description: 'Due', date: '15 jun' },
          { description: 'No date' },
          { date: 'No desc' },
        ],
        summary: 'Test',
      }))
      expect(result!.dates).toHaveLength(1)
    })

    it('filters empty strings from arrays', () => {
      const result = parseAnalysisResponse(JSON.stringify({
        type: 'service_agreement',
        obligations: ['Valid', ''],
        ambiguities: ['Valid', ''],
        undiscussedTerms: ['Valid', ''],
        summary: 'Test',
      }))
      expect(result!.obligations).toHaveLength(1)
      expect(result!.ambiguities).toHaveLength(1)
      expect(result!.undiscussedTerms).toHaveLength(1)
    })

    it('defaults summary when missing', () => {
      const result = parseAnalysisResponse(JSON.stringify({ type: 'service_agreement' }))
      expect(result!.summary).toBe('No se pudo generar un resumen automatico.')
    })

    it('defaults summary when empty string', () => {
      const result = parseAnalysisResponse(JSON.stringify({ type: 'service_agreement', summary: '' }))
      expect(result!.summary).toBe('No se pudo generar un resumen automatico.')
    })

    it('handles all-empty arrays gracefully', () => {
      const result = parseAnalysisResponse(JSON.stringify({
        type: 'verbal_agreement',
        parties: [],
        terms: [],
        obligations: [],
        amounts: [],
        dates: [],
        ambiguities: [],
        undiscussedTerms: [],
        summary: 'Simple verbal agreement',
      }))
      expect(result).not.toBeNull()
      expect(result!.parties).toHaveLength(0)
      expect(result!.terms).toHaveLength(0)
    })

    it('handles missing optional arrays', () => {
      const result = parseAnalysisResponse(JSON.stringify({
        type: 'verbal_agreement',
        summary: 'Minimal',
      }))
      expect(result!.parties).toHaveLength(0)
      expect(result!.amounts).toHaveLength(0)
      expect(result!.ambiguities).toHaveLength(0)
    })
  })
})
