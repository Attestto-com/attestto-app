/**
 * app-module-cr-medical
 *
 * Doctor-facing module for issuing Dictámenes Médicos (Medical Certificates)
 * required for Costa Rica driving licenses (COSEVI process).
 *
 * Credential gate: ColegioMedicosCRVC required.
 * Issues: DictamenMedicoVC
 * Anchors: Solana
 */

import type { AttesttoModule, ModuleContext } from '@attestto/module-sdk'
import { manifest } from './manifest'

const crMedicalModule: AttesttoModule = {
  manifest,

  async install(ctx: ModuleContext) {
    // Check for pending drafts on startup and push inbox items
    const credentials = await ctx.getCredentials(['ColegioMedicosCRVC'])
    if (credentials.length === 0) {
      console.warn('[cr-medical] No ColegioMedicosCRVC found — module installed but doctor VC missing')
      return
    }

    // Push inbox item if there are locally persisted pending drafts
    const raw = localStorage.getItem('cr-medical:drafts')
    if (raw) {
      try {
        const drafts = JSON.parse(raw) as Array<{ status: string; patient: { nombre: string; apellidos: string } }>
        const pending = drafts.filter((d) => d.status === 'draft' || d.status === 'pending')
        if (pending.length > 0) {
          ctx.pushInboxItem({
            id: 'cr-medical:pending-drafts',
            moduleId: 'cr-medical',
            type: 'warning',
            icon: 'pending_actions',
            title: `${pending.length} dictamen${pending.length > 1 ? 'es' : ''} pendiente${pending.length > 1 ? 's' : ''}`,
            subtitle: `Último: ${pending[0].patient.nombre} ${pending[0].patient.apellidos}`,
            action: 'Continuar →',
            route: '/cr-medical',
            timestamp: Date.now(),
            priority: 8,
          })
        }
      } catch {
        // Corrupted storage — ignore
      }
    }
  },

  uninstall() {
    // Session state cleared; drafts intentionally preserved for continuity
  },

  async getInboxItems() {
    const raw = localStorage.getItem('cr-medical:drafts')
    if (!raw) return []
    try {
      const drafts = JSON.parse(raw) as Array<{
        draftId: string
        status: string
        patient: { nombre: string; apellidos: string }
        updatedAt: string
      }>
      return drafts
        .filter((d) => d.status === 'draft' || d.status === 'pending')
        .map((d) => ({
          id: `cr-medical:draft:${d.draftId}`,
          moduleId: 'cr-medical',
          type: 'action' as const,
          icon: 'local_hospital',
          title: 'Dictamen pendiente de firma',
          subtitle: `${d.patient.nombre} ${d.patient.apellidos}`,
          action: 'Continuar →',
          route: `/cr-medical/vista-previa/${d.draftId}`,
          timestamp: new Date(d.updatedAt).getTime(),
          priority: 7,
        }))
    } catch {
      return []
    }
  },
}

export default crMedicalModule

// Re-export types for consumers
export type { DictamenDraft, DictamenMedicoSubject, CRLicenseCategory } from './types/dictamen'
export { manifest } from './manifest'
