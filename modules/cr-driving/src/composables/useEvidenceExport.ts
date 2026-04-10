/**
 * Evidence export — watermarked PDF + encrypted bundle (ATT-404).
 *
 * Exports exam evidence as an encrypted ZIP-like bundle:
 * - Exam result JSON (signed)
 * - Hash chain log
 * - Face capture frames (if any)
 * - Session metadata
 *
 * Bundle is encrypted with AES-GCM via Web Crypto API.
 * Key derived from user's vault key + exam session ID.
 */

import type { ExamResult, ExamIncident } from '../types'

interface EvidenceBundle {
  version: 1
  sessionId: string
  exportedAt: string
  result: ExamResult
  incidents: ExamIncident[]
  chainLog: string[]
  /** AES-GCM encrypted payload (base64) */
  encrypted?: string
  /** IV for AES-GCM (base64) */
  iv?: string
}

/**
 * Build an evidence bundle from exam data.
 */
export function buildEvidenceBundle(
  sessionId: string,
  result: ExamResult,
  chainLog: string[] = [],
): EvidenceBundle {
  return {
    version: 1,
    sessionId,
    exportedAt: new Date().toISOString(),
    result,
    incidents: result.incidents,
    chainLog,
  }
}

/**
 * Encrypt evidence bundle with AES-256-GCM.
 * Uses Web Crypto API — works in browser and service worker.
 */
export async function encryptBundle(
  bundle: EvidenceBundle,
  passphrase: string,
): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder()
  const data = encoder.encode(JSON.stringify(bundle))

  // Derive AES key from passphrase using PBKDF2
  const salt = encoder.encode(`attestto:evidence:${bundle.sessionId}`)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )

  // Encrypt with random IV
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data,
  )

  return {
    encrypted: arrayToBase64(new Uint8Array(ciphertext)),
    iv: arrayToBase64(iv),
  }
}

/**
 * Decrypt an encrypted evidence bundle.
 */
export async function decryptBundle(
  encrypted: string,
  iv: string,
  passphrase: string,
  sessionId: string,
): Promise<EvidenceBundle> {
  const encoder = new TextEncoder()
  const salt = encoder.encode(`attestto:evidence:${sessionId}`)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArray(iv) },
    aesKey,
    base64ToArray(encrypted),
  )

  return JSON.parse(new TextDecoder().decode(plaintext))
}

/**
 * Download evidence as an encrypted JSON file.
 */
export async function downloadEvidence(
  bundle: EvidenceBundle,
  passphrase: string,
): Promise<void> {
  const { encrypted, iv } = await encryptBundle(bundle, passphrase)

  const exportData = {
    type: 'attestto-evidence-v1',
    sessionId: bundle.sessionId,
    exportedAt: bundle.exportedAt,
    encrypted,
    iv,
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `attestto-evidence-${bundle.sessionId.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Helpers ──────────────────────────────────────────

function arrayToBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
}

function base64ToArray(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
}
