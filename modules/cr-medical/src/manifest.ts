/**
 * app-module-cr-medical — Module Manifest
 *
 * Credential-gated: only doctors with a valid Colegio de Médicos VC
 * can install and use this module.
 *
 * Capabilities:
 *   - Issue Dictamen Médico VCs for patients
 *   - Required for COSEVI driving license process (categories B1, B2, C, D, E)
 *   - Anchored on Solana for tamper-proof audit trail
 */

import type { ModuleManifest } from '@attestto/module-sdk'

export const manifest: ModuleManifest = {
  id: 'cr-medical',
  name: 'Dictamen Médico',
  description: 'Emitir dictámenes médicos para licencias de conducir. Requiere credencial del Colegio de Médicos de Costa Rica.',
  country: 'CR',
  version: '0.1.0',
  icon: 'local_hospital',

  // Only doctors registered with Colegio de Médicos CR can access this module
  requiredCredentials: ['ColegioMedicosCRVC'],

  capabilities: [
    'issue:DictamenMedicoVC',     // doctor can issue medical certificates
    'read:CedulaVC',              // read patient identity during exam
    'anchor:Solana',              // anchor issued VCs to Solana
  ],

  routes: [
    { path: '/cr-medical', name: 'cr-medical-dashboard', component: () => import('./views/DoctorDashboard.vue') },
    { path: '/cr-medical/paciente', name: 'cr-medical-patient', component: () => import('./views/PatientLookup.vue') },
    { path: '/cr-medical/examen/:patientDid', name: 'cr-medical-exam', component: () => import('./views/ExaminationForm.vue') },
    { path: '/cr-medical/vista-previa/:draftId', name: 'cr-medical-preview', component: () => import('./views/DictamenPreview.vue') },
    { path: '/cr-medical/historial', name: 'cr-medical-history', component: () => import('./views/DictamenHistory.vue') },
  ],

  inboxTypes: ['dictamen-pendiente', 'dictamen-firmado'],

  credentialTypes: ['DictamenMedicoVC'],
}
