/**
 * useIdentityIssuance — orchestrates IdentityVC issuance.
 *
 * Flow: validateDraft → requestBiometric → buildVC → storeCredential → anchor
 * Mirrors useDictamen.ts from cr-medical.
 */

import { ref } from 'vue'
import type { ModuleContext, VerifiableCredential } from '@attestto/module-sdk'
import type { IdentityDraft, IssuedIdentityRecord } from '../types/identity'
import { useIdentityStore } from '../stores/identity.store'

const W3C_VC_CONTEXT = 'https://www.w3.org/2018/credentials/v1'
const CR_IDENTITY_CONTEXT = 'https://schemas.attestto.org/cr/identity/v1'
const IDENTITY_SCHEMA_URL = 'https://schemas.attestto.org/cr/identity/v1/IdentityVC.schema.json'

let moduleCtx: ModuleContext | null = null

export function setIdentityContext(ctx: ModuleContext): void {
  moduleCtx = ctx
}

function getCtx(): ModuleContext {
  if (!moduleCtx) throw new Error('Identity module context not initialized')
  return moduleCtx
}

export function useIdentityIssuance() {
  const store = useIdentityStore()
  const issuing = ref(false)
  const issueError = ref<string | null>(null)

  /**
   * Issue the IdentityVC from a validated draft.
   */
  async function issueIdentityVC(draftId: string): Promise<VerifiableCredential | null> {
    const draft = store.getDraft(draftId)
    if (!draft) {
      issueError.value = 'Borrador no encontrado.'
      return null
    }

    if (!validateDraft(draft)) return null

    issuing.value = true
    issueError.value = null

    try {
      // Step 1: Biometric confirmation
      const confirmed = await getCtx().requestBiometric(
        `Firmar Credencial de Identidad para ${draft.citizen.fullName}`,
      )
      if (!confirmed) {
        issueError.value = 'Firma cancelada.'
        return null
      }

      // Step 2: Build VC
      const vc = buildNotarialIdentityVC(draft)

      // Step 3: Sign with Ed25519 and store in vault
      const ctx = getCtx()
      const canonicalPayload = JSON.stringify({
        '@context': vc['@context'],
        type: vc.type,
        issuer: vc.issuer,
        issuanceDate: vc.issuanceDate,
        credentialSubject: vc.credentialSubject,
      })
      const { signature, verificationMethod } = await ctx.sign(canonicalPayload)
      vc.proof = {
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
        verificationMethod,
        proofPurpose: 'assertionMethod',
        proofValue: signature,
        publicKey: ctx.getPublicKey(),
      }
      await ctx.storeCredential(vc)

      // Step 4: Update store
      store.markStatus(draftId, 'signed')
      store.addIssuedRecord({
        draftId,
        vcId: vc.id,
        citizenName: draft.citizen.fullName,
        citizenDid: draft.citizen.did,
        nationalIdNumber: draft.citizen.nationalId.number,
        issuedAt: vc.issuanceDate,
        anchorTx: null,
      })

      // Step 5: Anchor (non-blocking)
      anchorInBackground(draftId, vc)

      return vc
    } catch (e) {
      issueError.value = 'Error al emitir la credencial. Intente de nuevo.'
      return null
    } finally {
      issuing.value = false
    }
  }

  function buildNotarialIdentityVC(draft: IdentityDraft): VerifiableCredential {
    const now = new Date().toISOString()
    const vcId = `urn:uuid:${crypto.randomUUID()}`

    // 10-year expiration (matches cedula renewal cycle)
    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 10)

    const credentialSubject: Record<string, unknown> = {
      id: draft.citizen.did,
      type: 'NaturalPerson',
      nationalId: draft.citizen.nationalId,
      fullName: draft.citizen.fullName,
      dateOfBirth: draft.citizen.dateOfBirth,
      nationality: draft.citizen.nationality,
      photoHash: draft.citizen.photoHash,
      notarialAttestation: {
        protocolNumber: draft.notary.protocolNumber,
        attestedAt: now,
      },
    }

    if (draft.citizen.maritalStatus) {
      credentialSubject.maritalStatus = draft.citizen.maritalStatus
    }

    if (draft.organizationRoles.length > 0) {
      credentialSubject.organizationRoles = draft.organizationRoles
    }

    return {
      '@context': [W3C_VC_CONTEXT, CR_IDENTITY_CONTEXT],
      type: ['VerifiableCredential', 'IdentityVC'],
      id: vcId,
      issuer: {
        id: draft.notary.did,
        name: draft.notary.name,
        carneNumber: draft.notary.carneNumber,
        colegioId: draft.notary.colegioId,
      },
      issuanceDate: now,
      expirationDate: expiry.toISOString(),
      credentialSubject: credentialSubject as VerifiableCredential['credentialSubject'],
      evidence: draft.evidence.map((e) => ({
        type: e.type,
        method: e.method,
        documentsChecked: e.documentsChecked,
        biometricMatch: e.biometricMatch,
        verifiedAt: e.verifiedAt,
      })),
      credentialSchema: {
        id: IDENTITY_SCHEMA_URL,
        type: 'JsonSchema',
      },
    } as VerifiableCredential
  }

  function anchorInBackground(draftId: string, _vc: VerifiableCredential): void {
    getCtx().pushInboxItem({
      id: `anchor-${draftId}`,
      moduleId: 'cr-identity',
      type: 'info',
      icon: 'link',
      title: 'Anclando en Solana...',
      subtitle: 'La credencial se esta registrando en la cadena de bloques.',
      timestamp: Date.now(),
      priority: 1,
    })
  }

  function validateDraft(draft: IdentityDraft): boolean {
    if (!draft.citizen.nationalId.number) {
      issueError.value = 'Falta numero de documento de identidad.'
      return false
    }
    if (!draft.citizen.fullName) {
      issueError.value = 'Falta nombre completo del ciudadano.'
      return false
    }
    if (!draft.citizen.dateOfBirth) {
      issueError.value = 'Falta fecha de nacimiento.'
      return false
    }
    if (!draft.citizen.photoHash) {
      issueError.value = 'Falta verificacion de foto.'
      return false
    }
    if (!draft.citizen.did) {
      issueError.value = 'Falta DID del ciudadano.'
      return false
    }
    if (!draft.notary.carneNumber) {
      issueError.value = 'Falta numero de carne del notario.'
      return false
    }
    if (!draft.notary.protocolNumber) {
      issueError.value = 'Falta numero de protocolo notarial.'
      return false
    }
    if (draft.evidence.length === 0) {
      issueError.value = 'Debe registrar al menos una verificacion de evidencia.'
      return false
    }
    return true
  }

  return { issuing, issueError, issueIdentityVC, buildNotarialIdentityVC, validateDraft }
}
