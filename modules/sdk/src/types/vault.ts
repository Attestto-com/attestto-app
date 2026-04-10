/**
 * @attestto/module-sdk — Vault API interface
 * The sandboxed surface a module gets to interact with the user's vault.
 * A module can only read credentials it is explicitly scoped to.
 */

import type { VCEnvelope, VerifiableCredential } from './vc'

export interface VaultReadOptions {
  /** Filter by VC type string, e.g. 'DictamenMedicoVC' */
  type?: string
  /** Filter by issuer DID */
  issuer?: string
  /** Only return non-expired, non-revoked credentials */
  validOnly?: boolean
}

export interface VaultAPI {
  /**
   * Read credentials the module is scoped to see.
   * A module cannot read credentials outside its declared scope.
   */
  readCredentials(opts?: VaultReadOptions): Promise<VCEnvelope[]>

  /**
   * Store a newly issued VC into the holder's vault.
   * Used by issuer modules (e.g. doctor issuing dictamen to patient).
   */
  storeCredential(vc: VerifiableCredential): Promise<void>

  /**
   * Request the vault to sign a payload with the user's DID key.
   * Triggers biometric confirmation in the shell.
   */
  sign(payload: string): Promise<{ signature: string; verificationMethod: string }>

  /**
   * Get the current user's DID.
   */
  getDID(): Promise<string>

  /**
   * Present a credential to a verifier (selective disclosure).
   * Returns a signed VP containing only the requested fields.
   */
  presentCredential(vcId: string, fields: string[]): Promise<string> // returns VP JWT
}
