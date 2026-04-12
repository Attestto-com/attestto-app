/**
 * Types for the IdentityVC notarial issuance module.
 * Mirrors cr-vc-schemas/schemas/notarial/IdentityVC.schema.json
 */

// ── National ID ─────────────────────────────────────────────────

export type NationalIdType = 'cedula' | 'dimex' | 'pasaporte'

export interface NationalId {
  type: NationalIdType
  number: string
  country: string
}

export const NATIONAL_ID_LABELS: Record<NationalIdType, string> = {
  cedula: 'Cedula de Identidad',
  dimex: 'DIMEX (Residencia)',
  pasaporte: 'Pasaporte',
}

// ── Marital Status ──────────────────────────────────────────────

export type MaritalStatus =
  | 'soltero'
  | 'casado'
  | 'divorciado'
  | 'viudo'
  | 'union_libre'
  | 'separado'

export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  soltero: 'Soltero/a',
  casado: 'Casado/a',
  divorciado: 'Divorciado/a',
  viudo: 'Viudo/a',
  union_libre: 'Union libre',
  separado: 'Separado/a',
}

// ── Evidence ────────────────────────────────────────────────────

export type VerificationMethod = 'in-person' | 'remote-biometric' | 'firma-digital' | 'nfc-passport'

export type DocumentChecked =
  | 'cedula-fisica'
  | 'padron-electoral'
  | 'dimex-fisica'
  | 'pasaporte'
  | 'firma-digital-cert'
  | 'nfc-chip'

export const VERIFICATION_METHOD_LABELS: Record<VerificationMethod, string> = {
  'in-person': 'Presencial',
  'remote-biometric': 'Remoto con biometria',
  'firma-digital': 'Firma Digital',
  'nfc-passport': 'NFC de pasaporte',
}

export const DOCUMENT_CHECKED_LABELS: Record<DocumentChecked, string> = {
  'cedula-fisica': 'Cedula fisica',
  'padron-electoral': 'Padron electoral (TSE)',
  'dimex-fisica': 'DIMEX fisica',
  'pasaporte': 'Pasaporte',
  'firma-digital-cert': 'Certificado Firma Digital',
  'nfc-chip': 'Chip NFC',
}

export interface EvidenceEntry {
  type: 'NotarialVerification'
  method: VerificationMethod
  documentsChecked: DocumentChecked[]
  biometricMatch: boolean
  verifiedAt: string
}

// ── Organization Roles ──────────────────────────────────────────

export type OrgRoleType = 'ubo' | 'legal_representative' | 'director' | 'shareholder' | 'apoderado'
export type PoderType = 'generalisimo' | 'general' | 'especial'

export const ORG_ROLE_LABELS: Record<OrgRoleType, string> = {
  ubo: 'Beneficiario final (UBO)',
  legal_representative: 'Representante legal',
  director: 'Director/a',
  shareholder: 'Accionista',
  apoderado: 'Apoderado/a',
}

export const PODER_TYPE_LABELS: Record<PoderType, string> = {
  generalisimo: 'Generalisimo',
  general: 'General',
  especial: 'Especial',
}

export interface OrganizationInfo {
  legalName: string
  taxId: string
  lei?: string
  jurisdiction: string
  entityDid?: string
}

export interface OrganizationRole {
  organization: OrganizationInfo
  role: OrgRoleType
  ownershipPercentage?: number
  hasVotingControl?: boolean
  hasAppointmentRights?: boolean
  hasVetoRights?: boolean
  poderType?: PoderType
  position?: string
}

// ── Citizen & Notary Data ───────────────────────────────────────

export interface CitizenData {
  did: string
  nationalId: NationalId
  fullName: string
  dateOfBirth: string
  nationality: string
  maritalStatus?: MaritalStatus
  photoHash: string
}

export interface NotaryData {
  did: string
  name: string
  carneNumber: string
  colegioId: string
  protocolNumber: string
  jurisdiction: string
}

// ── Draft ───────────────────────────────────────────────────────

export type DraftStatus = 'draft' | 'review' | 'signed' | 'anchored'

export interface IdentityDraft {
  draftId: string
  status: DraftStatus
  createdAt: string
  updatedAt: string
  citizen: CitizenData
  notary: NotaryData
  evidence: EvidenceEntry[]
  organizationRoles: OrganizationRole[]
}

// ── Issued Record ───────────────────────────────────────────────

export interface IssuedIdentityRecord {
  draftId: string
  vcId: string
  citizenName: string
  citizenDid: string
  nationalIdNumber: string
  issuedAt: string
  anchorTx: string | null
}
