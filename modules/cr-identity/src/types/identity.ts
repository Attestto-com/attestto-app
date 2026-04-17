/**
 * Types for the Identity module.
 * Covers citizen self-attestation (cedula, license, passport) and notarial issuance.
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

// ══════════════════════════════════════════════════════════════════
// Citizen Self-Attestation Types
// ══════════════════════════════════════════════════════════════════

// ── Document Scanning ───────────────────────────────────────────

export type DocumentType = 'cedula' | 'licencia' | 'pasaporte'

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  cedula: 'Cedula de Identidad',
  licencia: 'Licencia de Conducir',
  pasaporte: 'Pasaporte',
}

export const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  cedula: 'badge',
  licencia: 'directions_car',
  pasaporte: 'flight',
}

export type ScanSource = 'mrz-td1' | 'mrz-td3' | 'front-ocr'

export interface ScanResult {
  success: boolean
  documentType: DocumentType
  extractedFields: Record<string, string>
  rawMRZ: string[]
  confidence: number
  source: ScanSource
  frontImage?: string
  backImage?: string
}

// ── Self-Attested Evidence ──────────────────────────────────────

export interface SelfAttestedEvidence {
  type: 'SelfAttestation'
  method: 'document-scan'
  ocrConfidence: number
  scannedAt: string
}

// ── Cedula Credential Subject ───────────────────────────────────

export interface CedulaSubject {
  cedula: string
  fullName: string
  apellido1: string
  apellido2: string
  nombre: string
  dateOfBirth: string
  dateOfExpiry: string
  nationality: string
  sex: string
  photoHash?: string
}

// ── Driving License Credential Subject ──────────────────────────

export type LicenseStatus = 'active' | 'suspended' | 'revoked' | 'expired'

export interface LicenseCategory {
  code: string
  from: string
  to: string
}

export const LICENSE_CATEGORY_CODES = [
  'A1', 'A2', 'A3',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3',
  'D1', 'D2', 'D3',
  'E1', 'E2', 'E3',
] as const

export interface DrivingLicenseSubject {
  cedula: string
  fullName: string
  dateOfBirth: string
  dateOfExpiry: string
  categories: LicenseCategory[]
  points: number
  status: LicenseStatus
  restrictions: string[]
  bloodType?: string
  photoHash?: string
}

// ── Passport Credential Subject ─────────────────────────────────

export interface PassportSubject {
  documentNumber: string
  surname: string
  givenNames: string
  nationality: string
  dateOfBirth: string
  sex: string
  dateOfExpiry: string
  issuingCountry: string
  photoHash?: string
}

// ── MRZ Parser Types ────────────────────────────────────────────

export interface MRZResult {
  success: boolean
  cedula: string
  nombre: string
  apellido1: string
  apellido2: string
  fechaNacimiento: string
  fechaVencimiento: string
  nacionalidad: string
  sexo: string
  rawMRZ: string[]
  confidence: number
  source?: ScanSource
}

export interface PassportMRZResult {
  success: boolean
  documentNumber: string
  surname: string
  givenNames: string
  nationality: string
  dateOfBirth: string
  sex: string
  dateOfExpiry: string
  issuingCountry: string
  rawMRZ: string[]
  confidence: number
}
