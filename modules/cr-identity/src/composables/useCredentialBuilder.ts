/**
 * Credential builder for self-attested identity VCs.
 * Builds W3C VCs and signs them with the user's Ed25519 key via ModuleContext.
 */

import type { VerifiableCredential, ModuleContext } from '@attestto/module-sdk'
import type {
  CedulaSubject,
  DrivingLicenseSubject,
  PassportSubject,
  SelfAttestedEvidence,
} from '../types/identity'

// ── Module Context ──────────────────────────────────────────────

let moduleCtx: ModuleContext | null = null

export function setBuilderContext(ctx: ModuleContext): void {
  moduleCtx = ctx
}

function getCtx(): ModuleContext {
  if (!moduleCtx) throw new Error('Identity module context not initialized')
  return moduleCtx
}

// ── VC Builders ─────────────────────────────────────────────────

export function buildCedulaVC(
  subject: CedulaSubject,
  evidence: SelfAttestedEvidence,
): VerifiableCredential {
  const ctx = getCtx()
  const did = ctx.getDID()
  const now = new Date().toISOString()

  const expiry = new Date()
  expiry.setFullYear(expiry.getFullYear() + 10)

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://schemas.attestto.org/cr/identity/v1',
    ],
    type: ['VerifiableCredential', 'CedulaIdentidadCR'],
    id: `urn:uuid:${crypto.randomUUID()}`,
    issuer: did,
    issuanceDate: now,
    expirationDate: expiry.toISOString(),
    credentialSubject: {
      id: did,
      nationalId: {
        type: 'cedula',
        number: subject.cedula,
        country: 'CR',
      },
      fullName: subject.fullName,
      nombre: subject.nombre,
      apellido1: subject.apellido1,
      apellido2: subject.apellido2,
      dateOfBirth: subject.dateOfBirth,
      dateOfExpiry: subject.dateOfExpiry,
      nationality: subject.nationality,
      sex: subject.sex,
      photoHash: subject.photoHash || '',
    },
    evidence: [evidence],
    jurisdiction: 'CR',
  } as VerifiableCredential
}

export function buildDrivingLicenseVC(
  subject: DrivingLicenseSubject,
  evidence: SelfAttestedEvidence,
): VerifiableCredential {
  const ctx = getCtx()
  const did = ctx.getDID()
  const now = new Date().toISOString()

  // Use license expiry if available, otherwise 6 years
  let expirationDate: string
  if (subject.dateOfExpiry) {
    // Parse DD/MM/YYYY or ISO
    const parts = subject.dateOfExpiry.split('/')
    if (parts.length === 3) {
      expirationDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString()
    } else {
      expirationDate = new Date(subject.dateOfExpiry).toISOString()
    }
  } else {
    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 6)
    expirationDate = expiry.toISOString()
  }

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://schemas.attestto.org/cr/driving/v1',
    ],
    type: ['VerifiableCredential', 'DrivingLicenseCR'],
    id: `urn:uuid:${crypto.randomUUID()}`,
    issuer: did,
    issuanceDate: now,
    expirationDate,
    credentialSubject: {
      id: did,
      license: {
        cedula: subject.cedula,
        fullName: subject.fullName,
        dateOfBirth: subject.dateOfBirth,
        dateOfExpiry: subject.dateOfExpiry,
        categories: subject.categories,
        points: subject.points,
        status: subject.status,
        restrictions: subject.restrictions,
        bloodType: subject.bloodType || '',
        photoHash: subject.photoHash || '',
      },
    },
    evidence: [evidence],
    jurisdiction: 'CR',
  } as VerifiableCredential
}

export function buildPassportVC(
  subject: PassportSubject,
  evidence: SelfAttestedEvidence,
): VerifiableCredential {
  const ctx = getCtx()
  const did = ctx.getDID()
  const now = new Date().toISOString()

  // Parse expiry date
  let expirationDate: string
  if (subject.dateOfExpiry) {
    const parts = subject.dateOfExpiry.split('/')
    if (parts.length === 3) {
      expirationDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString()
    } else {
      expirationDate = new Date(subject.dateOfExpiry).toISOString()
    }
  } else {
    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 10)
    expirationDate = expiry.toISOString()
  }

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://schemas.attestto.org/cr/identity/v1',
    ],
    type: ['VerifiableCredential', 'PassportCR'],
    id: `urn:uuid:${crypto.randomUUID()}`,
    issuer: did,
    issuanceDate: now,
    expirationDate,
    credentialSubject: {
      id: did,
      documentNumber: subject.documentNumber,
      surname: subject.surname,
      givenNames: subject.givenNames,
      nationality: subject.nationality,
      dateOfBirth: subject.dateOfBirth,
      sex: subject.sex,
      dateOfExpiry: subject.dateOfExpiry,
      issuingCountry: subject.issuingCountry,
      photoHash: subject.photoHash || '',
    },
    evidence: [evidence],
  } as VerifiableCredential
}

// ── Sign and Store ──────────────────────────────────────────────

export async function signAndStoreVC(vc: VerifiableCredential): Promise<VerifiableCredential> {
  const ctx = getCtx()
  const now = new Date().toISOString()

  // Build canonical payload (everything except proof)
  const canonicalPayload = JSON.stringify({
    '@context': vc['@context'],
    type: vc.type,
    issuer: vc.issuer,
    issuanceDate: vc.issuanceDate,
    credentialSubject: vc.credentialSubject,
  })

  // Sign with Ed25519 (biometric-gated)
  const { signature, verificationMethod } = await ctx.sign(canonicalPayload)

  vc.proof = {
    type: 'Ed25519Signature2020',
    created: now,
    verificationMethod,
    proofPurpose: 'assertionMethod',
    proofValue: signature,
    publicKey: ctx.getPublicKey(),
  }

  // Store in encrypted vault
  await ctx.storeCredential(vc)

  return vc
}
