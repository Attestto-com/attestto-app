import type { VerifiableCredential } from '@attestto/module-sdk'
import { useVaultStore } from '@/stores/vault'
import * as crypto from '@/composables/useCrypto'

interface ExamResultInput {
  score: number
  passed: boolean
  chainHead: string
  totalQuestions: number
  correctAnswers: number
  durationSeconds: number
  categories: Record<string, { correct: number; total: number; percentage: number }>
  incidentCount: number
}

interface StationEndorsement {
  sign: (payload: Uint8Array) => string
  getVerificationMethod: () => string
  getPublicKey: () => string
}

export async function issueExamCredential(
  result: ExamResultInput,
  licenseType: string = 'B1',
  station?: StationEndorsement,
): Promise<VerifiableCredential> {
  const vault = useVaultStore()
  if (!vault.did) throw new Error('Vault not unlocked')

  const now = new Date().toISOString()
  const vcId = `urn:uuid:${globalThis.crypto.randomUUID()}`

  const vc: VerifiableCredential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://schema.attestto.com/cr-driving/v1',
    ],
    type: ['VerifiableCredential', 'DrivingTheoryExamCR'],
    id: vcId,
    issuer: { id: vault.did, name: 'Attestto' },
    issuanceDate: now,
    credentialSubject: {
      id: vault.did,
      examType: 'teoria',
      licenseType,
      score: result.score,
      passed: result.passed,
      totalQuestions: result.totalQuestions,
      correctAnswers: result.correctAnswers,
      durationSeconds: result.durationSeconds,
      chainHead: result.chainHead,
      incidentCount: result.incidentCount,
      categories: result.categories,
    },
    jurisdiction: 'CR',
    revocationStatus: result.passed ? 'valid' : 'unknown',
  }

  // Sign the VC with user's key
  const canonicalPayload = JSON.stringify({
    '@context': vc['@context'],
    type: vc.type,
    issuer: vc.issuer,
    issuanceDate: vc.issuanceDate,
    credentialSubject: vc.credentialSubject,
  })

  const { signature, verificationMethod } = await vault.sign(canonicalPayload)

  const userProof = {
    type: 'Ed25519Signature2020',
    created: now,
    verificationMethod,
    proofPurpose: 'assertionMethod',
    proofValue: signature,
    publicKey: crypto.getPublicKeyBase64url(),
  }

  if (station) {
    // Station endorsement: proctor attests to the chain head it witnessed
    const stationPayload = JSON.stringify({
      chainHead: result.chainHead,
      sessionVcId: vcId,
      witnessedAt: now,
      incidentCount: result.incidentCount,
    })
    const stationSig = station.sign(new TextEncoder().encode(stationPayload))

    const stationProof = {
      type: 'Ed25519Signature2020',
      created: now,
      verificationMethod: station.getVerificationMethod(),
      proofPurpose: 'authentication',
      proofValue: stationSig,
      publicKey: station.getPublicKey(),
    }

    // proofChain: user assertion + station endorsement
    vc.proof = [userProof, stationProof]
  } else {
    vc.proof = userProof
  }

  return vc
}
