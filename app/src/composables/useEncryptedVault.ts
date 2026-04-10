/**
 * Encrypted vault storage — IndexedDB + AES-256-GCM via Web Crypto.
 *
 * Replaces plain localStorage for credential storage.
 * Data is encrypted at rest using a key derived from the user's
 * Ed25519 signing key via HKDF.
 *
 * Storage layout in IndexedDB (via idb-keyval):
 *   attestto:vault:encrypted → { ciphertext, iv, version }
 */

import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'

const VAULT_KEY = 'attestto:vault:encrypted'
const VAULT_VERSION = 1

interface EncryptedVaultData {
  version: number
  ciphertext: string // base64
  iv: string         // base64
}

/**
 * Derive an AES-256-GCM key from a signing key seed using HKDF.
 * The signing key is never used directly for encryption.
 */
async function deriveVaultKey(signingKeySeed: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    signingKeySeed,
    'HKDF',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('attestto:vault:v1'),
      info: new TextEncoder().encode('vault-encryption'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Encrypt vault data and store in IndexedDB.
 */
export async function saveEncryptedVault(
  data: unknown,
  signingKeySeed: Uint8Array,
): Promise<void> {
  const aesKey = await deriveVaultKey(signingKeySeed)
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintext,
  )

  const vaultData: EncryptedVaultData = {
    version: VAULT_VERSION,
    ciphertext: arrayToBase64(new Uint8Array(ciphertext)),
    iv: arrayToBase64(iv),
  }

  await idbSet(VAULT_KEY, vaultData)
}

/**
 * Load and decrypt vault data from IndexedDB.
 * Returns null if no vault data exists.
 */
export async function loadEncryptedVault<T = unknown>(
  signingKeySeed: Uint8Array,
): Promise<T | null> {
  const vaultData = await idbGet<EncryptedVaultData>(VAULT_KEY)
  if (!vaultData) return null

  const aesKey = await deriveVaultKey(signingKeySeed)

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArray(vaultData.iv) },
    aesKey,
    base64ToArray(vaultData.ciphertext),
  )

  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}

/**
 * Delete encrypted vault data from IndexedDB.
 */
export async function clearEncryptedVault(): Promise<void> {
  await idbDel(VAULT_KEY)
}

/**
 * Check if encrypted vault data exists.
 */
export async function hasEncryptedVault(): Promise<boolean> {
  const data = await idbGet<EncryptedVaultData>(VAULT_KEY)
  return data !== undefined
}

/**
 * Migrate from localStorage to encrypted vault.
 * Call once during first unlock after upgrade.
 */
export async function migrateFromLocalStorage(
  signingKeySeed: Uint8Array,
): Promise<boolean> {
  const raw = localStorage.getItem('attestto:vault:credentials')
  if (!raw) return false

  const hasExisting = await hasEncryptedVault()
  if (hasExisting) return false // Already migrated

  try {
    const credentials = JSON.parse(raw)
    await saveEncryptedVault(credentials, signingKeySeed)
    localStorage.removeItem('attestto:vault:credentials')
    return true
  } catch {
    return false
  }
}

// ── Helpers ──────────────────────────────────────────

function arrayToBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
}

function base64ToArray(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
}
