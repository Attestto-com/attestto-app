/**
 * app-module-cr-medical — useDictamen
 *
 * Orchestrates the full dictamen issuance flow:
 *   1. Build the VC payload from the draft
 *   2. Request doctor biometric sign
 *   3. Store VC in patient's vault (via module IPC — patient must accept)
 *   4. Anchor on Solana
 *   5. Return issued VC
 */

import { ref } from 'vue'
import type { DictamenDraft, DictamenMedicoSubject } from '../types/dictamen'
import type { ModuleContext, VerifiableCredential } from '@attestto/module-sdk'
import { useDictamenStore } from '../stores/dictamen.store'

export function useDictamen(ctx: ModuleContext) {
  const store = useDictamenStore()
  const issuing = ref(false)
  const issueError = ref<string | null>(null)

  /**
   * Issue the dictamen as a Verifiable Credential.
   *
   * Flow:
   *   1. Validate draft completeness
   *   2. Build VC payload
   *   3. Request biometric — doctor must confirm
   *   4. Sign VC with doctor's DID key (via vault)
   *   5. Transmit to patient's vault (patient receives & accepts in their app)
   *   6. Anchor VC hash to Solana
   *   7. Update local draft status
   */
  async function issueDictamen(draftId: string): Promise<VerifiableCredential | null> {
    const draft = store.drafts.find((d) => d.draftId === draftId)
    if (!draft) {
      issueError.value = 'Borrador no encontrado.'
      return null
    }

    if (!validateDraft(draft)) return null

    issuing.value = true
    issueError.value = null

    try {
      // Step 1: Biometric confirmation
      const confirmed = await ctx.requestBiometric(
        `Firmar Dictamen Médico para ${draft.patient.nombre} ${draft.patient.apellidos}`
      )
      if (!confirmed) {
        issueError.value = 'Firma cancelada.'
        return null
      }

      // Step 2: Build VC
      const vc = buildVC(draft)

      // Step 3: Store in patient's vault
      // In production, this sends a VC offer to the patient's DID via DIDComm v2.
      // The patient receives a push notification and accepts/rejects in their wallet.
      await ctx.storeCredential(vc)

      // Step 4: Update store
      store.markSigned(draftId)

      // Step 5: Anchor (non-blocking — shell handles this async)
      anchorInBackground(draftId, vc)

      return vc
    } catch (e) {
      issueError.value = 'Error al emitir el dictamen. Intente de nuevo.'
      return null
    } finally {
      issuing.value = false
    }
  }

  function buildVC(draft: DictamenDraft): VerifiableCredential {
    const subject: DictamenMedicoSubject = {
      id: draft.patient.did,
      cedula: draft.patient.cedula,
      nombreCompleto: `${draft.patient.nombre} ${draft.patient.apellidos}`,
      fechaNacimiento: draft.patient.fechaNacimiento,
      categoriasAprobadas: draft.approvedCategories,
      restricciones: draft.restrictions,
      examDate: draft.examDate,
      expiresAt: draft.expiresAt,
      issuer: {
        did: draft.doctor.did,
        nombre: `${draft.doctor.nombre} ${draft.doctor.apellidos}`,
        numeroColegiado: draft.doctor.numeroColegiado,
        especialidad: draft.doctor.especialidad,
      },
      resumenExamen: {
        vision: draft.results.vision.visualField,
        audicion: draft.results.hearing.result,
        presionArterial: draft.results.bloodPressure.result,
        motorFuncional: draft.results.motor.coordination,
        psicologico: draft.results.psychological.mentalStatus,
      },
    }

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://attestto.com/contexts/cr-medical/v1',
      ],
      type: ['VerifiableCredential', 'DictamenMedicoVC'],
      id: `urn:uuid:${crypto.randomUUID()}`,
      issuer: {
        id: draft.doctor.did,
        name: `${draft.doctor.nombre} ${draft.doctor.apellidos}`,
      },
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(`${draft.expiresAt}T23:59:59Z`).toISOString(),
      credentialSubject: subject,
    }
  }

  async function anchorInBackground(draftId: string, _vc: VerifiableCredential) {
    // The shell handles Solana anchoring via its IPC bridge.
    // We optimistically push an inbox item and update when confirmed.
    ctx.pushInboxItem({
      id: `anchor-${draftId}`,
      moduleId: 'cr-medical',
      type: 'info',
      icon: 'link',
      title: 'Anclando en Solana…',
      subtitle: 'El dictamen se está registrando en la cadena de bloques.',
      timestamp: Date.now(),
      priority: 1,
    })
    // Actual anchoring is handled by the shell's Solana service.
    // When complete, shell emits a 'anchor_confirmed' event with the tx signature.
  }

  function validateDraft(draft: DictamenDraft): boolean {
    if (draft.approvedCategories.length === 0) {
      issueError.value = 'Debe seleccionar al menos una categoría aprobada.'
      return false
    }
    if (!draft.patient.cedula) {
      issueError.value = 'Falta cédula del paciente.'
      return false
    }
    if (!draft.doctor.numeroColegiado) {
      issueError.value = 'Falta número de colegiado del médico.'
      return false
    }
    if (draft.results.overallResult === 'fail') {
      issueError.value = 'No se puede emitir dictamen con resultado general negativo.'
      return false
    }
    return true
  }

  return { issuing, issueError, issueDictamen }
}
