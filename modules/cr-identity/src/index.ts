/**
 * app-module-cr-identity
 *
 * Citizen identity management: scan cedula, license, passport → self-attested VCs.
 * Notary mode: issue IdentityVC with fe publica notarial (runtime-gated).
 */

import type { AttesttoModule, ModuleContext } from '@attestto/module-sdk'
import { manifest } from './manifest'
import { setIdentityContext } from './composables/useIdentityIssuance'
import { setBuilderContext } from './composables/useCredentialBuilder'

let ctx: ModuleContext | null = null

const crIdentityModule: AttesttoModule = {
  manifest,

  async install(moduleCtx: ModuleContext) {
    ctx = moduleCtx
    setIdentityContext(moduleCtx)
    setBuilderContext(moduleCtx)

    // Citizen mode: always show scan CTA
    moduleCtx.pushInboxItem({
      id: 'cr-identity:scan-cta',
      moduleId: 'cr-identity',
      type: 'action',
      icon: 'fingerprint',
      title: 'Identidad Digital',
      subtitle: 'Escanea tu cedula, licencia o pasaporte',
      action: 'Escanear',
      route: '/module/cr-identity/cr-identity',
      timestamp: Date.now(),
      priority: 9,
    })

    // Notary mode: check if user has notary credential
    const notaryCredentials = await moduleCtx.getCredentials(['ColegioAbogadosCRVC'])
    if (notaryCredentials.length > 0) {
      await moduleCtx.storage.set('notaryMode', true)

      // Check for pending notary drafts
      const draftsRaw = await moduleCtx.storage.get<Array<{ status: string; citizen: { fullName: string } }>>('drafts')
      if (draftsRaw) {
        const pending = draftsRaw.filter((d) => d.status === 'draft' || d.status === 'review')
        if (pending.length > 0) {
          moduleCtx.pushInboxItem({
            id: 'cr-identity:pending-drafts',
            moduleId: 'cr-identity',
            type: 'warning',
            icon: 'pending_actions',
            title: `${pending.length} credencial${pending.length > 1 ? 'es' : ''} notarial${pending.length > 1 ? 'es' : ''} pendiente${pending.length > 1 ? 's' : ''}`,
            subtitle: `Ultimo: ${pending[0].citizen.fullName}`,
            action: 'Continuar',
            route: '/module/cr-identity/cr-identity/notarial',
            timestamp: Date.now(),
            priority: 8,
          })
        }
      }
    } else {
      await moduleCtx.storage.set('notaryMode', false)
    }
  },

  uninstall() {
    ctx = null
  },

  getOnboarding() {
    return {
      id: 'cr-identity-onboarding',
      screens: [
        {
          icon: 'fingerprint',
          title: 'Tu Identidad Digital',
          body: 'Escanea tu cedula, licencia de conducir o pasaporte. Los datos se extraen localmente con OCR — nada sale de tu dispositivo.',
        },
        {
          icon: 'verified_user',
          title: 'Credenciales Verificables',
          body: 'Cada documento escaneado se convierte en una credencial firmada con tu llave Ed25519. Puedes compartirla sin revelar datos innecesarios.',
        },
        {
          icon: 'gavel',
          title: 'Atestacion Notarial',
          body: 'Un notario puede elevar tu credencial auto-atestada a una credencial con fe publica, añadiendo un nivel superior de confianza.',
        },
      ],
      completionCredential: 'IdentityOnboarding',
    }
  },

  async getInboxItems() {
    return [
      {
        id: 'cr-identity:scan-cta',
        moduleId: 'cr-identity',
        type: 'action' as const,
        icon: 'fingerprint',
        title: 'Identidad Digital',
        subtitle: 'Escanea tu cedula, licencia o pasaporte',
        action: 'Escanear',
        route: '/module/cr-identity/cr-identity',
        timestamp: Date.now(),
        priority: 9,
      },
    ]
  },
}

export default crIdentityModule

export type {
  IdentityDraft, CitizenData, NotaryData, EvidenceEntry, OrganizationRole,
  DocumentType, ScanResult, CedulaSubject, DrivingLicenseSubject, PassportSubject,
  LicenseCategory, MRZResult, PassportMRZResult, SelfAttestedEvidence,
} from './types/identity'

export { manifest } from './manifest'
