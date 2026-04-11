// ── Agreement Classification ────────────────────────────────────

export type AgreementType =
  | 'service_agreement'
  | 'freelance_contract'
  | 'informal_lease'
  | 'personal_loan'
  | 'sale_agreement'
  | 'partnership_agreement'
  | 'purchase_commitment'
  | 'verbal_agreement'
  | 'unknown'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type ConversationSource = 'whatsapp' | 'email' | 'voice_transcript' | 'typed' | 'other'

export const AGREEMENT_TYPE_LABELS: Record<AgreementType, string> = {
  service_agreement: 'Acuerdo de servicios',
  freelance_contract: 'Contrato freelance',
  informal_lease: 'Arrendamiento informal',
  personal_loan: 'Prestamo personal',
  sale_agreement: 'Acuerdo de venta',
  partnership_agreement: 'Acuerdo de sociedad',
  purchase_commitment: 'Promesa de compra',
  verbal_agreement: 'Acuerdo verbal',
  unknown: 'Tipo no identificado',
}

export const SOURCE_LABELS: Record<ConversationSource, string> = {
  whatsapp: 'WhatsApp',
  email: 'Correo electronico',
  voice_transcript: 'Transcripcion de voz',
  typed: 'Escrito directamente',
  other: 'Otro',
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Critico',
}

export const AGREEMENT_DEFAULT_RISK: Record<AgreementType, RiskLevel> = {
  service_agreement: 'medium',
  freelance_contract: 'low',
  informal_lease: 'medium',
  personal_loan: 'high',
  sale_agreement: 'high',
  partnership_agreement: 'high',
  purchase_commitment: 'high',
  verbal_agreement: 'low',
  unknown: 'medium',
}

// ── Agreement Draft (LLM output) ────────────────────────────────

export interface AgreementParty {
  role: string
  name: string
  did?: string
}

export interface AgreementTerm {
  description: string
  value: string
}

export interface AgreementAmount {
  description: string
  amount: number
  currency: string
}

export interface AgreementDate {
  description: string
  date: string
}

export interface AgreementDraft {
  type: AgreementType
  parties: AgreementParty[]
  terms: AgreementTerm[]
  obligations: string[]
  amounts: AgreementAmount[]
  dates: AgreementDate[]
  ambiguities: string[]
  undiscussedTerms: string[]
  summary: string
}

// ── Agreement Session ───────────────────────────────────────────

export type AgreementPhase =
  | 'input'
  | 'analyzing'
  | 'draft'
  | 'editing'
  | 'signing'
  | 'complete'
  | 'error'

export interface AgreementSession {
  id: string
  phase: AgreementPhase
  conversationSource: ConversationSource
  conversationText: string
  draft: AgreementDraft | null
  editedDraft: AgreementDraft | null
  signedAt: string | null
  agreementHash: string | null
  signature: string | null
  vcId: string | null
  anchorTx: string | null
  createdAt: number
  error: string | null
}

// ── Signed Agreement Record ─────────────────────────────────────

export interface SignedAgreementRecord {
  sessionId: string
  agreementType: AgreementType
  agreementHash: string
  signature: string
  signedAt: string
  anchorTx: string | null
  vcId: string
  partySummary: string
}
