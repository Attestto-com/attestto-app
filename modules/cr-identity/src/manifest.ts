import type { ModuleManifest } from '@attestto/module-sdk'

export const manifest: ModuleManifest = {
  id: 'cr-identity',
  name: 'Identidad Digital',
  description: 'Escanea tu cedula, licencia o pasaporte. Crea credenciales verificables firmadas con tu identidad digital.',
  country: 'CR',
  version: '0.2.0',
  icon: 'fingerprint',

  // No credential gate — this module CREATES identity credentials
  requiredCredentials: [],

  capabilities: [
    'scan:CedulaCR',
    'scan:DrivingLicenseCR',
    'scan:PassportCR',
    'issue:SelfAttestedVC',
    'issue:IdentityVC',
    'anchor:Solana',
  ],

  routes: [
    // Citizen routes
    { path: '/cr-identity', name: 'cr-identity-dashboard', component: () => import('./views/CitizenDashboard.vue') },
    { path: '/cr-identity/escanear', name: 'cr-identity-scan', component: () => import('./views/DocumentScanFlow.vue') },
    { path: '/cr-identity/credenciales', name: 'cr-identity-credentials', component: () => import('./views/MyCredentials.vue') },

    // Notary routes (runtime-gated by ColegioAbogadosCRVC check)
    { path: '/cr-identity/notarial', name: 'cr-identity-notary', component: () => import('./views/NotaryDashboard.vue') },
    { path: '/cr-identity/notarial/nueva', name: 'cr-identity-notary-new', component: () => import('./views/NewIdentityForm.vue') },
    { path: '/cr-identity/notarial/revision/:draftId', name: 'cr-identity-notary-review', component: () => import('./views/IdentityReview.vue') },
    { path: '/cr-identity/notarial/historial', name: 'cr-identity-notary-history', component: () => import('./views/IssuanceHistory.vue') },
  ],

  inboxTypes: ['identity-scan', 'identity-draft', 'identity-issued'],

  credentialTypes: ['CedulaIdentidadCR', 'DrivingLicenseCR', 'PassportCR', 'IdentityVC'],
}
