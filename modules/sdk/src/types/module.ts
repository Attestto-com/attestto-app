/**
 * @attestto/module-sdk — Module contract types
 * Every module must export a ModuleManifest and implement ModuleContext.
 */

import type { Component } from 'vue'
import type { VaultAPI } from './vault'

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export interface RequiredCredential {
  /** VC type string that must be present in vault, e.g. 'ColegioMedicosVC' */
  type: string
  /** Human-readable label shown in Modules screen */
  label: string
  /** Optional — only this issuer's VCs count */
  issuer?: string
}

export interface ModuleRoute {
  path: string
  component: Component
  meta?: Record<string, unknown>
}

export interface InboxWidget {
  /** Vue component rendered in the Home inbox when module has pending items */
  component: Component
  /** Called to check if widget should appear. Return count of pending items, 0 = hide. */
  getPendingCount: () => Promise<number>
}

export interface ModuleManifest {
  /** Unique module ID, e.g. 'cr-medical' */
  id: string
  /** Display name */
  name: string
  /** Short description */
  description: string
  /** ISO 3166-1 alpha-2 country code, or 'GLOBAL' */
  country: string
  /** Semver */
  version: string
  /** Credentials the user must hold to install/use this module */
  requiredCredentials: RequiredCredential[]
  /** Vue Router routes this module contributes. First route = module entry point. */
  routes: ModuleRoute[]
  /** Optional inbox widget */
  inboxWidget?: InboxWidget
  /** Credential types this module is allowed to read from the vault */
  vaultReadScope: string[]
  /** Credential types this module can issue */
  vaultIssueScope: string[]
}

// ---------------------------------------------------------------------------
// Runtime context — injected by shell when module is loaded
// ---------------------------------------------------------------------------

export interface ModuleContext {
  /** Scoped vault access — can only do what the manifest declares */
  vault: VaultAPI
  /** Current user's locale, e.g. 'es-CR' */
  locale: string
  /** Shell version, for compatibility checks */
  shellVersion: string
  /** Emit an event to the shell (e.g. to show a notification) */
  emit: (event: ModuleEvent) => void
}

export type ModuleEvent =
  | { type: 'notification'; title: string; body: string; icon?: string }
  | { type: 'credential_issued'; vcType: string }
  | { type: 'navigate'; path: string }

// ---------------------------------------------------------------------------
// Module entry point interface
// ---------------------------------------------------------------------------

export interface AttesttoModule {
  manifest: ModuleManifest
  /** Called once when the module is mounted. Receives context from shell. */
  install: (ctx: ModuleContext) => void | Promise<void>
}
