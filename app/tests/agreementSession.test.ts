import { describe, it, expect } from 'vitest'
import type { AgreementSession, AgreementDraft, AgreementType } from 'app-module-agreement/src/types'
import { AGREEMENT_DEFAULT_RISK, AGREEMENT_TYPE_LABELS, RISK_LABELS, SOURCE_LABELS } from 'app-module-agreement/src/types'

/**
 * Tests for agreement session logic and type maps.
 */

// ── Inline helpers ──────────────────────────────────────────────

function makeSession(overrides: Partial<AgreementSession> = {}): AgreementSession {
  return {
    id: 'test-' + Math.random().toString(36).slice(2, 8),
    phase: 'input',
    conversationSource: 'whatsapp',
    conversationText: 'Alice: $5000 total? Bob: si',
    draft: null,
    editedDraft: null,
    signedAt: null,
    agreementHash: null,
    signature: null,
    vcId: null,
    anchorTx: null,
    createdAt: Date.now(),
    error: null,
    ...overrides,
  }
}

function makeDraft(overrides: Partial<AgreementDraft> = {}): AgreementDraft {
  return {
    type: 'freelance_contract',
    parties: [{ role: 'contratante', name: 'Alice' }, { role: 'proveedor', name: 'Bob' }],
    terms: [{ description: 'Entregable', value: 'Dashboard' }],
    obligations: ['Entregar modulo'],
    amounts: [{ description: 'Precio', amount: 5000, currency: 'USD' }],
    dates: [{ description: 'Entrega', date: '15 junio 2026' }],
    ambiguities: [],
    undiscussedTerms: [],
    summary: 'Freelance contract for $5000',
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('Agreement Session', () => {

  describe('session creation', () => {
    it('creates session with correct defaults', () => {
      const s = makeSession()
      expect(s.phase).toBe('input')
      expect(s.draft).toBeNull()
      expect(s.editedDraft).toBeNull()
      expect(s.signedAt).toBeNull()
    })

    it('generates unique IDs', () => {
      const s1 = makeSession()
      const s2 = makeSession()
      expect(s1.id).not.toBe(s2.id)
    })

    it('stores conversation text (persisted, unlike doc-signing)', () => {
      const s = makeSession({ conversationText: 'Full conversation here' })
      expect(s.conversationText).toBe('Full conversation here')
    })
  })

  describe('draft vs editedDraft', () => {
    it('active draft is draft when no edits', () => {
      const s = makeSession({ draft: makeDraft() })
      const active = s.editedDraft ?? s.draft
      expect(active).not.toBeNull()
      expect(active!.type).toBe('freelance_contract')
    })

    it('active draft is editedDraft when edits exist', () => {
      const original = makeDraft({ summary: 'Original' })
      const edited = makeDraft({ summary: 'Edited version' })
      const s = makeSession({ draft: original, editedDraft: edited })
      const active = s.editedDraft ?? s.draft
      expect(active!.summary).toBe('Edited version')
    })

    it('preserves original draft for audit trail', () => {
      const original = makeDraft({ summary: 'Original' })
      const edited = makeDraft({ summary: 'Changed' })
      const s = makeSession({ draft: original, editedDraft: edited })
      expect(s.draft!.summary).toBe('Original')
      expect(s.editedDraft!.summary).toBe('Changed')
    })
  })
})

describe('Agreement Type Maps', () => {

  describe('AGREEMENT_TYPE_LABELS', () => {
    it('has a label for every type', () => {
      const types: AgreementType[] = [
        'service_agreement', 'freelance_contract', 'informal_lease', 'personal_loan',
        'sale_agreement', 'partnership_agreement', 'purchase_commitment', 'verbal_agreement', 'unknown',
      ]
      for (const t of types) {
        expect(AGREEMENT_TYPE_LABELS[t]).toBeTruthy()
      }
    })

    it('has exactly 9 types', () => {
      expect(Object.keys(AGREEMENT_TYPE_LABELS)).toHaveLength(9)
    })

    it('labels are in Spanish', () => {
      expect(AGREEMENT_TYPE_LABELS.freelance_contract).toContain('freelance')
      expect(AGREEMENT_TYPE_LABELS.personal_loan).toContain('restamo')
    })
  })

  describe('AGREEMENT_DEFAULT_RISK', () => {
    it('maps every type to a valid risk', () => {
      const validRisks = ['low', 'medium', 'high', 'critical']
      for (const risk of Object.values(AGREEMENT_DEFAULT_RISK)) {
        expect(validRisks).toContain(risk)
      }
    })

    it('freelance is low risk', () => {
      expect(AGREEMENT_DEFAULT_RISK.freelance_contract).toBe('low')
    })

    it('verbal agreement is low risk', () => {
      expect(AGREEMENT_DEFAULT_RISK.verbal_agreement).toBe('low')
    })

    it('personal loan is high risk', () => {
      expect(AGREEMENT_DEFAULT_RISK.personal_loan).toBe('high')
    })

    it('partnership is high risk', () => {
      expect(AGREEMENT_DEFAULT_RISK.partnership_agreement).toBe('high')
    })

    it('unknown defaults to medium (moderate)', () => {
      expect(AGREEMENT_DEFAULT_RISK.unknown).toBe('medium')
    })

    it('covers all 9 types', () => {
      expect(Object.keys(AGREEMENT_DEFAULT_RISK)).toHaveLength(9)
    })
  })

  describe('RISK_LABELS', () => {
    it('has Spanish labels for all 4 levels', () => {
      expect(RISK_LABELS.low).toBe('Bajo')
      expect(RISK_LABELS.medium).toBe('Medio')
      expect(RISK_LABELS.high).toBe('Alto')
      expect(RISK_LABELS.critical).toBe('Critico')
    })
  })

  describe('SOURCE_LABELS', () => {
    it('has labels for all 5 sources', () => {
      expect(Object.keys(SOURCE_LABELS)).toHaveLength(5)
      expect(SOURCE_LABELS.whatsapp).toBe('WhatsApp')
      expect(SOURCE_LABELS.email).toContain('electronico')
    })
  })
})
