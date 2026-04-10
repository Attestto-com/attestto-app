/**
 * app-module-cr-medical — Domain Types
 *
 * Dictamen Médico para Licencia de Conducir — Costa Rica
 * Based on COSEVI requirements and Colegio de Médicos regulations.
 */

// ---------------------------------------------------------------------------
// CR License Categories
// ---------------------------------------------------------------------------

export type CRLicenseCategory =
  | 'A1'   // Motocicleta hasta 125cc
  | 'A2'   // Motocicleta hasta 35kW
  | 'A'    // Motocicleta ilimitada
  | 'B1'   // Automóvil (licencia personal más común)
  | 'B2'   // Automóvil con remolque ligero
  | 'C'    // Camión >3,500kg
  | 'D'    // Autobús
  | 'D1'   // Minibús
  | 'E'    // Articulado / cabezal

// ---------------------------------------------------------------------------
// Exam Results
// ---------------------------------------------------------------------------

export type PassFail = 'pass' | 'fail' | 'conditional'

export interface VisionResult {
  /** Agudeza visual ojo derecho (fracción, e.g. "20/20") */
  rightEye: string
  /** Agudeza visual ojo izquierdo */
  leftEye: string
  /** Campo visual — pass/fail/conditional */
  visualField: PassFail
  /** Daltonismo — ausencia de deficiencia severa requerida para categorías C/D/E */
  colorVision: PassFail
  /** Uso de lentes requerido */
  requiresLenses: boolean
  /** Restricción: Solo conducción diurna */
  daytimeOnly: boolean
}

export interface HearingResult {
  result: PassFail
  /** dB loss — informational only */
  dbLoss?: number
  requiresHearingAid: boolean
}

export interface BloodPressureResult {
  systolic: number    // mmHg
  diastolic: number   // mmHg
  pulse: number       // bpm
  result: PassFail
}

export interface MotorResult {
  /** Coordinación mano-ojo */
  coordination: PassFail
  /** Fuerza en extremidades */
  strength: PassFail
  /** Reflejos */
  reflexes: PassFail
  /** Restricciones de adaptación vehicular requeridas */
  adaptations?: string[]
}

export interface PsychologicalResult {
  /** Estado mental general */
  mentalStatus: PassFail
  /** Evaluación de reacciones ante el estrés */
  stressResponse: PassFail
  /** Uso de sustancias (alcohol/drogas) — negativo requerido */
  substanceUse: PassFail
}

export interface ExamResults {
  vision: VisionResult
  hearing: HearingResult
  bloodPressure: BloodPressureResult
  motor: MotorResult
  psychological: PsychologicalResult
  /** Overall determination */
  overallResult: PassFail
  /** Doctor's free-form observations */
  observations?: string
}

// ---------------------------------------------------------------------------
// Dictamen Draft (pre-issuance, stored locally)
// ---------------------------------------------------------------------------

export interface PatientInfo {
  /** Patient's DID (from QR scan or manual entry) */
  did: string
  /** Cédula number */
  cedula: string
  nombre: string
  apellidos: string
  fechaNacimiento: string   // ISO date
  /** Nationality — 'CR' for Costa Rican, else country code */
  nacionalidad: string
}

export interface DoctorInfo {
  /** Doctor's DID (from vault) */
  did: string
  nombre: string
  apellidos: string
  /** Número de colegiado — Colegio de Médicos de CR */
  numeroColegiado: string
  /** Medical specialty relevant to the exam */
  especialidad: string
  /** Clinic / office name */
  consultorio?: string
}

export type DictamenStatus =
  | 'draft'       // being filled in
  | 'pending'     // filled, awaiting doctor signature
  | 'signed'      // signed by doctor, VC issued
  | 'anchored'    // VC anchored to Solana
  | 'revoked'     // revoked by issuer

export interface DictamenDraft {
  /** Local UUID — temporary until VC is issued */
  draftId: string
  status: DictamenStatus
  patient: PatientInfo
  doctor: DoctorInfo
  /** License categories being requested */
  requestedCategories: CRLicenseCategory[]
  /** Categories approved by doctor (subset of requested) */
  approvedCategories: CRLicenseCategory[]
  examDate: string          // ISO date
  expiresAt: string         // ISO date — typically 5 years for B1, varies
  results: ExamResults
  /** Restrictions attached to the dictamen */
  restrictions: string[]
  createdAt: string         // ISO timestamp
  updatedAt: string         // ISO timestamp
}

// ---------------------------------------------------------------------------
// Issued Dictamen VC credential subject
// ---------------------------------------------------------------------------

export interface DictamenMedicoSubject {
  /** Patient DID */
  id: string
  cedula: string
  nombreCompleto: string
  fechaNacimiento: string
  /** Approved categories */
  categoriasAprobadas: CRLicenseCategory[]
  /** Restrictions, if any */
  restricciones: string[]
  examDate: string
  expiresAt: string
  issuer: {
    did: string
    nombre: string
    numeroColegiado: string
    especialidad: string
  }
  /** Exam summary — full results stored encrypted off the VC for privacy */
  resumenExamen: {
    vision: PassFail
    audicion: PassFail
    presionArterial: PassFail
    motorFuncional: PassFail
    psicologico: PassFail
  }
  /** Hash of full encrypted exam record */
  examRecordHash?: string
  /** Solana anchor tx */
  anchorTx?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const LICENSE_CATEGORY_LABELS: Record<CRLicenseCategory, string> = {
  A1: 'A1 — Motocicleta ≤125cc',
  A2: 'A2 — Motocicleta ≤35kW',
  A:  'A — Motocicleta ilimitada',
  B1: 'B1 — Automóvil',
  B2: 'B2 — Automóvil + remolque',
  C:  'C — Camión >3,500kg',
  D:  'D — Autobús',
  D1: 'D1 — Minibús',
  E:  'E — Vehículo articulado',
}

/** Categories requiring color vision test */
export const COLOR_VISION_REQUIRED: CRLicenseCategory[] = ['C', 'D', 'D1', 'E']

/** Default validity in years by category */
export const DICTAMEN_VALIDITY_YEARS: Record<CRLicenseCategory, number> = {
  A1: 3, A2: 3, A: 3,
  B1: 5, B2: 5,
  C: 3, D: 2, D1: 2, E: 2,
}

export function computeExpiryDate(
  examDate: string,
  categories: CRLicenseCategory[],
): string {
  const minYears = Math.min(...categories.map((c) => DICTAMEN_VALIDITY_YEARS[c]))
  const expiry = new Date(examDate)
  expiry.setFullYear(expiry.getFullYear() + minYears)
  return expiry.toISOString().split('T')[0]
}
