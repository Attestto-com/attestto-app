/**
 * app-module-cr-identity
 *
 * Notary-facing module for issuing IdentityVC (Credencial de Identidad Notarial).
 * The ROOT credential in Attestto — everything else derives from it.
 *
 * Credential gate: ColegioAbogadosCRVC required.
 * Issues: IdentityVC
 * Anchors: Solana
 */

import type { AttesttoModule, ModuleContext } from '@attestto/module-sdk'
import { manifest } from './manifest'

const crIdentityModule: AttesttoModule = {
  manifest,

  async install(ctx: ModuleContext) {
    const credentials = await ctx.getCredentials(['ColegioAbogadosCRVC'])
    if (credentials.length === 0) {
      console.warn('[cr-identity] No ColegioAbogadosCRVC found — module installed but notary VC missing')
      return
    }

    // Check for pending drafts
    const raw = localStorage.getItem('cr-identity:drafts')
    if (raw) {
      try {
        const drafts = JSON.parse(raw) as Array<{ status: string; citizen: { fullName: string } }>
        const pending = drafts.filter((d) => d.status === 'draft' || d.status === 'review')
        if (pending.length > 0) {
          ctx.pushInboxItem({
            id: 'cr-identity:pending-drafts',
            moduleId: 'cr-identity',
            type: 'warning',
            icon: 'pending_actions',
            title: `${pending.length} credencial${pending.length > 1 ? 'es' : ''} pendiente${pending.length > 1 ? 's' : ''}`,
            subtitle: `Ultimo: ${pending[0].citizen.fullName}`,
            action: 'Continuar',
            route: '/module/cr-identity/cr-identity',
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
    // Session state cleared; drafts preserved for continuity
  },

  async getInboxItems() {
    const raw = localStorage.getItem('cr-identity:drafts')
    if (!raw) return []
    try {
      const drafts = JSON.parse(raw) as Array<{
        draftId: string
        status: string
        citizen: { fullName: string }
        updatedAt: string
      }>
      return drafts
        .filter((d) => d.status === 'draft' || d.status === 'review')
        .map((d) => ({
          id: `cr-identity:draft:${d.draftId}`,
          moduleId: 'cr-identity',
          type: 'action' as const,
          icon: 'fingerprint',
          title: 'Credencial de identidad pendiente',
          subtitle: d.citizen.fullName,
          action: 'Continuar',
          route: `/module/cr-identity/cr-identity/revision/${d.draftId}`,
          timestamp: new Date(d.updatedAt).getTime(),
          priority: 7,
        }))
    } catch {
      return []
    }
  },
}

export default crIdentityModule

export type { IdentityDraft, CitizenData, NotaryData, EvidenceEntry, OrganizationRole } from './types/identity'
export { manifest } from './manifest'
