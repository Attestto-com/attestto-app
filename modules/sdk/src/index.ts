import type { Component, Ref } from 'vue'

// ── Module Manifest ──────────────────────────────────────────────

export interface ModuleManifest {
  /** Unique module identifier, e.g. "cr-driving" */
  id: string
  /** Display name, e.g. "Examen Teórico COSEVI" */
  name: string
  /** ISO 3166-1 alpha-2 country code, or "universal" */
  country: string
  /** Semver version */
  version: string
  /** Short description for the Modules screen */
  description: string
  /** Icon name (Material Icons) */
  icon: string
  /** Credential types required in vault to install this module */
  requiredCredentials: string[]
  /** Capabilities this module provides */
  capabilities: string[]
  /** Routes this module registers */
  routes: ModuleRoute[]
  /** Inbox card types this module can produce */
  inboxTypes?: string[]
  /** Wallet credential types this module manages */
  credentialTypes?: string[]
}

export interface ModuleRoute {
  path: string
  name: string
  component: () => Promise<{ default: Component }>
}

// ── Module Context (injected by the shell) ───────────────────────

export interface ModuleContext {
  /** Read credentials from vault (scoped to module's declared types) */
  getCredentials: (types: string[]) => Promise<VerifiableCredential[]>
  /** Store a credential in the vault */
  storeCredential: (vc: VerifiableCredential) => Promise<void>
  /** Push an inbox item to the home screen */
  pushInboxItem: (item: InboxItem) => void
  /** Request biometric confirmation from the user */
  requestBiometric: (reason: string) => Promise<boolean>
  /** Navigate to a route */
  navigate: (path: string) => void
  /** Module's persistent storage (scoped key-value) */
  storage: ModuleStorage
  /** On-device LLM text generation (MediaPipe + Gemma). Returns null if unavailable. */
  llm: LlmHandle
  /** Get the user's DID (e.g. "did:web:demo.attestto.id"). Throws if vault locked. */
  getDID: () => string
  /** Get the user's public key as base64url. Throws if vault locked. */
  getPublicKey: () => string
  /** Sign a payload with the user's Ed25519 key (biometric-gated). */
  sign: (payload: string) => Promise<{ signature: string; verificationMethod: string }>
}

export interface LlmHandle {
  /** Current status of the on-device LLM */
  status: () => LlmStatus
  /** Initialize the LLM (downloads model on first use, caches for offline) */
  init: () => Promise<void>
  /** Generate text from a prompt. Throws if not ready. */
  generate: (prompt: string) => Promise<string>
  /** Whether the device supports WebGPU (required for on-device LLM) */
  supported: boolean
}

export type LlmStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'generating' | 'error' | 'unsupported'

export interface ModuleStorage {
  get: <T = unknown>(key: string) => Promise<T | null>
  set: (key: string, value: unknown) => Promise<void>
  remove: (key: string) => Promise<void>
}

// ── Module Entry Point ───────────────────────────────────────────

export interface AttesttoModule {
  manifest: ModuleManifest
  /** Called once when module is loaded. Receives shell context. */
  install: (ctx: ModuleContext) => Promise<void> | void
  /** Called when the module is unloaded or credential revoked. */
  uninstall?: () => void
  /** Provides inbox items for the home screen */
  getInboxItems?: () => Promise<InboxItem[]>
  /** Provides widget component for home screen */
  getHomeWidget?: () => Component | null
  /** Module-specific onboarding screens shown on first use.
   *  Must explain what data the module collects, why, and what happens with it.
   *  Shell checks this on first module use; completion stored in scoped storage. */
  getOnboarding?: () => OnboardingFlow | null
}

// ── Onboarding Flow ──────────────────────────────────────────────

export interface OnboardingFlow {
  /** Unique ID for tracking completion */
  id: string
  /** Screens shown in sequence */
  screens: OnboardingScreen[]
  /** VC type minted on completion (optional) */
  completionCredential?: string
}

export interface OnboardingScreen {
  /** Icon name (Material Icons) */
  icon: string
  /** Title (short, translated) */
  title: string
  /** Body text (2-3 sentences max, translated) */
  body: string
}

// ── Shared Domain Types ──────────────────────────────────────────

export interface VerifiableCredential {
  '@context': string[]
  type: string[]
  id: string
  issuer: string | { id: string; name?: string }
  issuanceDate: string
  expirationDate?: string
  credentialSubject: Record<string, unknown>
  proof?: Record<string, unknown> | Record<string, unknown>[]
  /** Country code of the issuer's jurisdiction */
  jurisdiction?: string
  /** Revocation status if checked */
  revocationStatus?: 'valid' | 'revoked' | 'unknown'
}

export interface InboxItem {
  id: string
  moduleId: string
  type: 'action' | 'info' | 'warning'
  icon: string
  title: string
  subtitle: string
  /** CTA label, e.g. "Practicar →" */
  action?: string
  /** Route to navigate on tap */
  route?: string
  /** Timestamp for ordering */
  timestamp: number
  /** Priority: higher = shown first */
  priority?: number
}

// ── Credential Gating ────────────────────────────────────────────

export type CredentialGateResult =
  | { allowed: true }
  | { allowed: false; missing: string[] }

export function checkCredentialGate(
  manifest: ModuleManifest,
  vaultCredentialTypes: string[],
): CredentialGateResult {
  const missing = manifest.requiredCredentials.filter(
    (req) => !vaultCredentialTypes.includes(req),
  )
  if (missing.length === 0) return { allowed: true }
  return { allowed: false, missing }
}

// ── Revocation Policy ────────────────────────────────────────────

export type RevocationAction = 'disable-all' | 'read-only' | 'hybrid'

/**
 * Hybrid revocation (recommended):
 * - Capabilities that affect others (issue VCs, sign) → disabled immediately
 * - Self-service (view history, export evidence) → preserved
 */
export function getRevocationPolicy(): RevocationAction {
  return 'hybrid'
}

// ── Module Registration Helper ───────────────────────────────────

const moduleRegistry = new Map<string, AttesttoModule>()

export function registerModule(mod: AttesttoModule): void {
  moduleRegistry.set(mod.manifest.id, mod)
}

export function getRegisteredModules(): AttesttoModule[] {
  return Array.from(moduleRegistry.values())
}

export function getModule(id: string): AttesttoModule | undefined {
  return moduleRegistry.get(id)
}
