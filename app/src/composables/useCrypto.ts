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
  return localStorage.getItem(DID_KEY) ?? 'did:web:demo.attestto.id'
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
