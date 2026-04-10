/**
 * app-module-cr-medical — usePatient
 *
 * Handles patient identity resolution:
 *   1. Scan patient QR → extract DID
 *   2. Resolve DID → retrieve identity VC (cédula)
 *   3. Return PatientInfo for use in the exam form
 */

import { ref } from 'vue'
import type { PatientInfo } from '../types/dictamen'
import type { ModuleContext } from '@attestto/module-sdk'

export function usePatient(ctx: ModuleContext) {
  const patient = ref<PatientInfo | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Resolve patient identity from their DID.
   * In production, this calls the Attestto resolver to fetch the holder's
   * presentation of their CedulaVC. For now, it's a stub that the
   * shell will implement via the vault IPC.
   */
  async function resolveFromDID(did: string): Promise<PatientInfo | null> {
    loading.value = true
    error.value = null

    try {
      // Ask vault to fetch the patient's identity credentials
      const credentials = await ctx.getCredentials(['CedulaVC', 'DIMEXVC'])

      // In a real flow: the patient would have presented a VP via QR.
      // We match the VP's holder DID to the credential subject.
      const identityVC = credentials.find(
        (vc) =>
          vc.credentialSubject['id'] === did ||
          (vc.issuer === 'did:web:tse.go.cr' || vc.issuer === 'did:web:dimex.go.cr')
      )

      if (!identityVC) {
        error.value = 'No se encontró credencial de identidad para este paciente.'
        return null
      }

      const subject = identityVC.credentialSubject as {
        id: string
        cedula?: string
        numeroDIMEX?: string
        nombre: string
        apellido1: string
        apellido2?: string
        fechaNacimiento: string
        nacionalidad?: string
      }

      patient.value = {
        did,
        cedula: subject.cedula ?? subject.numeroDIMEX ?? '',
        nombre: subject.nombre,
        apellidos: [subject.apellido1, subject.apellido2].filter(Boolean).join(' '),
        fechaNacimiento: subject.fechaNacimiento,
        nacionalidad: subject.nacionalidad ?? 'CR',
      }

      return patient.value
    } catch (e) {
      error.value = 'Error al resolver identidad del paciente. Intente de nuevo.'
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Manual entry fallback — used when patient doesn't have a digital credential.
   * Doctor manually enters cédula and identity data.
   */
  function setManual(info: PatientInfo) {
    patient.value = info
    error.value = null
  }

  function clear() {
    patient.value = null
    error.value = null
  }

  return { patient, loading, error, resolveFromDID, setManual, clear }
}
