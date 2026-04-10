/**
 * @attestto/module-sdk — Verifiable Credential base types
 * Aligned with W3C VC Data Model 2.0 + Attestto extensions
 */

export interface VerifiableCredential<S = Record<string, unknown>> {
  '@context': string[]
  id?: string
  type: string[]
  issuer: string | { id: string; name?: string }
  issuanceDate: string
  expirationDate?: string
  credentialSubject: { id: string } & S
  proof?: CredentialProof
}

export interface CredentialProof {
  type: string
  created: string
  verificationMethod: string
  proofPurpose: string
  proofValue: string
}

export interface VerifiablePresentation {
  '@context': string[]
  type: string[]
  holder: string
  verifiableCredential: VerifiableCredential[]
  proof?: CredentialProof
}

export type CredentialStatus = 'valid' | 'expired' | 'revoked' | 'pending' | 'unknown'

export interface VCEnvelope {
  vc: VerifiableCredential
  status: CredentialStatus
  anchorTx?: string        // Solana transaction signature
  receivedAt: string       // ISO timestamp
  storedLocally: boolean
}
