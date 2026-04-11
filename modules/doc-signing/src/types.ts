// ── Document Classification ──────────────────────────────────────

export type DocumentCategory =
  | 'govt_form_standard'
  | 'govt_form_sensitive'
  | 'nda'
  | 'service_agreement_short'
  | 'employment_contract'
  | 'lease_short'
  | 'lease_long'
  | 'commercial_contract'
  | 'real_estate_deed'
  | 'corporate_document'
  | 'loan_agreement'
  | 'unknown'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  govt_form_standard: 'Formulario gubernamental estandar',
  govt_form_sensitive: 'Formulario gubernamental sensible',
  nda: 'Acuerdo de confidencialidad',
  service_agreement_short: 'Contrato de servicios (corto)',
  employment_contract: 'Contrato de trabajo',
  lease_short: 'Arrendamiento (< 2 años)',
  lease_long: 'Arrendamiento (≥ 2 años)',
  commercial_contract: 'Contrato comercial',
  real_estate_deed: 'Escritura de propiedad',
  corporate_document: 'Documento corporativo',
  loan_agreement: 'Prestamo / pagare',
  unknown: 'Tipo desconocido',
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Critico',
}

export const CATEGORY_DEFAULT_RISK: Record<DocumentCategory, RiskLevel> = {
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

// ── Document Analysis (LLM output) ──────────────────────────────

export interface FlaggedClause {
  clause: string
  concern: string
  severity: 'info' | 'warning' | 'critical'
  legalRef?: string
}

export interface DocumentParty {
  role: string
  name: string
  cedula?: string
  did?: string
}

export interface DocumentAnalysis {
  documentType: DocumentCategory
  riskLevel: RiskLevel
  parties: DocumentParty[]
  obligations: string[]
  penalties: string[]
  flaggedClauses: FlaggedClause[]
  plainLanguageSummary: string
  questions: AnalysisQuestion[]
}

export interface AnalysisQuestion {
  id: string
  text: string
}

// ── Signing Session ─────────────────────────────────────────────

export type SessionPhase =
  | 'upload'
  | 'extracting'
  | 'analyzing'
  | 'summary'
  | 'chat'
  | 'signing'
  | 'anchoring'
  | 'complete'
  | 'error'

export interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
  timestamp: number
  questionId?: string
}

export interface UserAnswer {
  questionId: string
  answer: string
  timestamp: number
}

export interface SigningSession {
  id: string
  fileName: string
  extractedText: string
  analysis: DocumentAnalysis | null
  phase: SessionPhase
  chatMessages: ChatMessage[]
  userAnswers: UserAnswer[]
  recommendation: 'sign' | 'review' | 'legal-advice' | null
  signedAt: string | null
  pdfHash: string | null
  signature: string | null
  verificationMethod: string | null
  anchorTx: string | null
  vcId: string | null
  createdAt: number
  error: string | null
}

// ── Signed Document Record (persisted) ──────────────────────────

export interface SignedDocumentRecord {
  sessionId: string
  fileName: string
  documentType: DocumentCategory
  riskLevel: RiskLevel
  pdfHash: string
  signature: string
  verificationMethod: string
  signedAt: string
  anchorTx: string | null
  vcId: string
}
