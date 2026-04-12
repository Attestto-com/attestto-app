/**
 * app-module-cr-identity — Module Manifest
 *
 * Credential-gated: only notaries with a valid Colegio de Abogados VC
 * can install and use this module.
 *
 * Capabilities:
 *   - Issue IdentityVC (notarial identity credential) for citizens
 *   - Anchored on Solana for tamper-proof audit trail
 *   - Supports natural persons and UBO/corporate roles
 */

import type { ModuleManifest } from '@attestto/module-sdk'

export const manifest: ModuleManifest = {
  id: 'cr-identity',
  name: 'Credencial de Identidad',
  description: 'Emitir credenciales de identidad verificables con fe publica notarial. Requiere credencial del Colegio de Abogados de Costa Rica.',
  country: 'CR',
  version: '0.1.0',
  icon: 'fingerprint',

  requiredCredentials: ['ColegioAbogadosCRVC'],

  capabilities: [
    'issue:IdentityVC',
    'read:CedulaVC',
    'anchor:Solana',
  ],

  routes: [
    { path: '/cr-identity', name: 'cr-identity-dashboard', component: () => import('./views/NotaryDashboard.vue') },
    { path: '/cr-identity/nueva', name: 'cr-identity-new', component: () => import('./views/NewIdentityForm.vue') },
    { path: '/cr-identity/revision/:draftId', name: 'cr-identity-review', component: () => import('./views/IdentityReview.vue') },
    { path: '/cr-identity/historial', name: 'cr-identity-history', component: () => import('./views/IssuanceHistory.vue') },
  ],

  inboxTypes: ['identity-draft', 'identity-issued'],

  credentialTypes: ['IdentityVC'],
}
