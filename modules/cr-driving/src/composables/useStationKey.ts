/**
 * useStationKey — ephemeral Ed25519 station/proctor key.
 *
 * Each exam session generates a fresh station keypair.
 * The station key signs the final session proof VC as an endorsement:
 * "This proctor station witnessed the session and attests to the chain head."
 *
 * The station key is ephemeral — it lives only for the session duration.
 * Its public key is recorded in the VC so verifiers can confirm the endorsement.
 */
import { ed25519 } from '@noble/curves/ed25519'
import { randomBytes } from '@noble/hashes/utils'

let stationPrivateKey: Uint8Array | null = null
let stationPublicKey: Uint8Array | null = null
let stationId: string | null = null

function toBase64url(bytes: Uint8Array): string {
  const binStr = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  return btoa(binStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Generate a fresh station keypair for this session */
export function initStation(sessionId: string): { publicKey: string; stationDid: string } {
  const privKey = randomBytes(32)
  stationPrivateKey = privKey
  stationPublicKey = ed25519.getPublicKey(privKey)
  stationId = `did:key:station:${sessionId.slice(0, 8)}`

  return {
    publicKey: toBase64url(stationPublicKey),
    stationDid: stationId,
  }
}

/** Sign a payload with the station key */
export function stationSign(payload: Uint8Array): string {
  if (!stationPrivateKey) throw new Error('Station key not initialized')
  const sig = ed25519.sign(payload, stationPrivateKey)
  return toBase64url(sig)
}

/** Get station verification method */
export function getStationVerificationMethod(): string {
  if (!stationId) throw new Error('Station key not initialized')
  return `${stationId}#proctor-key-1`
}

/** Get station public key as base64url */
export function getStationPublicKey(): string {
  const pk = stationPublicKey
  if (!pk) throw new Error('Station key not initialized')
  return toBase64url(pk)
}

/** Destroy the station key (end of session) */
export function destroyStation(): void {
  if (stationPrivateKey) {
    stationPrivateKey.fill(0)
    stationPrivateKey = null
  }
  stationPublicKey = null
  stationId = null
}
