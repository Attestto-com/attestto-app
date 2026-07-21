import { ed25519 } from '@noble/curves/ed25519'
import { randomBytes } from '@noble/hashes/utils'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'

const CREDENTIAL_ID_KEY = 'attestto:webauthn:credentialId'
const PUBKEY_KEY = 'attestto:pubkey'
const DID_KEY = 'attestto:did'
const DISPLAY_NAME_KEY = 'attestto:displayName'
const IDB_SIGNING_KEY = 'attestto:signing-key'

// In-memory only — cleared on lock
let sessionPrivateKey: Uint8Array | null = null
let sessionKeySeed: Uint8Array | null = null

// ── Base64url helpers ──────────────────────────────────────────

function toBase64url(bytes: Uint8Array): string {
  const binStr = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  return btoa(binStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (str.length % 4)) % 4)
  const binStr = atob(padded)
  return Uint8Array.from(binStr, (c) => c.charCodeAt(0))
}

// ── did:key (Ed25519) via base58btc multibase ──────────────────

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58btcEncode(bytes: Uint8Array): string {
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++
  const digits: number[] = []
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i]
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 256
      digits[j] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  let result = '1'.repeat(zeros)
  for (let i = digits.length - 1; i >= 0; i--) result += BASE58_ALPHABET[digits[i]]
  return result
}

export function didKeyFromEd25519PublicKey(publicKey: Uint8Array): string {
  // Multicodec prefix for Ed25519 public key: 0xED 0x01 (varint-encoded)
  const prefixed = new Uint8Array(publicKey.length + 2)
  prefixed[0] = 0xed
  prefixed[1] = 0x01
  prefixed.set(publicKey, 2)
  return `did:key:z${base58btcEncode(prefixed)}`
}

// ── WebAuthn helpers ───────────────────────────────────────────

function getRpId(): string {
  return location.hostname
}

function getStoredCredentialId(): Uint8Array | null {
  const stored = localStorage.getItem(CREDENTIAL_ID_KEY)
  if (!stored) return null
  return fromBase64url(stored)
}

// ── Public API ─────────────────────────────────────────────────

export function isRegistered(): boolean {
  return localStorage.getItem(CREDENTIAL_ID_KEY) !== null
}

export function isAuthenticated(): boolean {
  return sessionPrivateKey !== null
}

export async function register(displayName: string): Promise<void> {
  const userId = randomBytes(16)
  const challenge = randomBytes(32)

  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Attestto', id: getRpId() },
      user: {
        id: userId.buffer as ArrayBuffer,
        name: 'attestto-user',
        displayName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
      challenge: challenge.buffer as ArrayBuffer,
      timeout: 60000,
    },
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('WebAuthn registration cancelled')

  // Store credential ID
  const credId = new Uint8Array(credential.rawId)
  localStorage.setItem(CREDENTIAL_ID_KEY, toBase64url(credId))

  // Generate Ed25519 keypair
  const privateKey = randomBytes(32)
  const publicKey = ed25519.getPublicKey(privateKey)

  // Store private key in IndexedDB, public key in localStorage
  await idbSet(IDB_SIGNING_KEY, privateKey)
  localStorage.setItem(PUBKEY_KEY, toBase64url(publicKey))
  localStorage.setItem(DISPLAY_NAME_KEY, displayName)
  localStorage.setItem(DID_KEY, didKeyFromEd25519PublicKey(publicKey))

  // Request persistent storage to prevent Safari eviction
  if (navigator.storage?.persist) {
    const persisted = await navigator.storage.persist()
    if (!persisted) {
      console.warn('Storage persistence denied — vault data may be evicted by browser')
    }
  }

  // Load into session
  sessionPrivateKey = privateKey
  sessionKeySeed = privateKey.slice()
}

export async function authenticate(): Promise<void> {
  const credentialId = getStoredCredentialId()
  if (!credentialId) throw new Error('No registered credential')

  const challenge = randomBytes(32)

  const assertion = (await navigator.credentials.get({
    publicKey: {
      allowCredentials: [{ id: credentialId.buffer as ArrayBuffer, type: 'public-key' }],
      challenge: challenge.buffer as ArrayBuffer,
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null

  if (!assertion) throw new Error('WebAuthn authentication cancelled')

  // Load private key into session
  const privateKey = await idbGet<Uint8Array>(IDB_SIGNING_KEY)
  if (!privateKey) {
    throw new Error('KEY_MISSING')
  }

  sessionPrivateKey = privateKey
  sessionKeySeed = privateKey.slice()

  // Backfill did:key for identities registered before did:key derivation
  // was added to register(). Idempotent — no-op if DID already present.
  if (!localStorage.getItem(DID_KEY)) {
    const pubkey = localStorage.getItem(PUBKEY_KEY)
    if (pubkey) {
      localStorage.setItem(DID_KEY, didKeyFromEd25519PublicKey(fromBase64url(pubkey)))
    }
  }
}

export function getPublicKeyBytes(): Uint8Array {
  const stored = localStorage.getItem(PUBKEY_KEY)
  if (!stored) throw new Error('No public key registered')
  return fromBase64url(stored)
}

export function getPublicKeyBase64url(): string {
  const stored = localStorage.getItem(PUBKEY_KEY)
  if (!stored) throw new Error('No public key registered')
  return stored
}

export function getDID(): string {
  const stored = localStorage.getItem(DID_KEY)
  if (!stored) throw new Error('No DID registered — complete onboarding first')
  return stored
}

export function setDID(did: string): void {
  localStorage.setItem(DID_KEY, did)
}

export function getDisplayName(): string {
  return localStorage.getItem(DISPLAY_NAME_KEY) ?? ''
}

export function getVerificationMethod(): string {
  return `${getDID()}#key-1`
}

export function getPrivateKeyBytes(): Uint8Array {
  if (!sessionPrivateKey) throw new Error('Vault locked — authenticate first')
  return sessionPrivateKey
}

export function sign(payload: Uint8Array): Uint8Array {
  if (!sessionPrivateKey) throw new Error('Vault locked — authenticate first')
  return ed25519.sign(payload, sessionPrivateKey)
}

export function verify(payload: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
  return ed25519.verify(signature, payload, publicKey)
}

export function getKeySeed(): Uint8Array {
  if (!sessionKeySeed) throw new Error('Vault locked — authenticate first')
  return sessionKeySeed
}

export function clearSession(): void {
  if (sessionPrivateKey) {
    sessionPrivateKey.fill(0)
    sessionPrivateKey = null
  }
  if (sessionKeySeed) {
    sessionKeySeed.fill(0)
    sessionKeySeed = null
  }
}

export async function destroyIdentity(): Promise<void> {
  clearSession()
  await idbDel(IDB_SIGNING_KEY)
  localStorage.removeItem(CREDENTIAL_ID_KEY)
  localStorage.removeItem(PUBKEY_KEY)
  localStorage.removeItem(DID_KEY)
  localStorage.removeItem(DISPLAY_NAME_KEY)
}

// ── Encoding exports (used by VC issuer) ───────────────────────

export { toBase64url, fromBase64url }
