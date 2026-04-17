/**
 * Attestto PDF signer — browser port of desktop's pdf-attestto.ts
 *
 * Ed25519 signature over document hash, embedded in PDF Keywords field
 * + visible stamp on last page. NOT PAdES — this is Attestto's Nivel B
 * self-attested signing scheme.
 *
 * Browser-compatible: uses Web Crypto for SHA-256, @noble/curves for
 * Ed25519, pdf-lib for PDF manipulation. No Node.js dependencies.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as crypto from '@/composables/useCrypto'

// ── Types ──────────────────────────────────────────────────────

/** What we embed in the PDF. Stable wire shape — versioned. */
export interface AttesttoPdfSignature {
  v: 1
  type: ['VerifiableCredential', 'AttesttoPdfSignature']
  issuer: string
  issuerName?: string
  signedAt: string
  documentHash: string
  fileName: string
  level: 'self-attested'
  mock: false
  mode: 'final' | 'open'
  reason?: string
  proof: {
    type: 'Ed25519Signature2020'
    created: string
    verificationMethod: string
    proofPurpose: 'assertionMethod'
    proofValue: string
    publicKey: string
  }
}

export interface SignPdfOptions {
  pdfBytes: Uint8Array
  fileName: string
  mode?: 'final' | 'open'
  reason?: string
}

export interface SignPdfResult {
  pdfBytes: Uint8Array
  originalHash: string
  signature: AttesttoPdfSignature
  stampSuppressed: boolean
}

export interface VerifyResult {
  valid: boolean
  reason?: string
  signature: AttesttoPdfSignature
  signatureValid: boolean
  issuerBinding: boolean
}

// ── Helpers ────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  const binStr = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  return btoa(binStr)
}

function base64ToBytes(b64: string): Uint8Array {
  const binStr = atob(b64)
  return Uint8Array.from(binStr, (c) => c.charCodeAt(0))
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer as ArrayBuffer)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Canonicalize the signed payload. Keys sorted lexicographically,
 * compact JSON. The `proof` block is excluded from its own input.
 */
function canonicalPayload(sig: Omit<AttesttoPdfSignature, 'proof'>): Uint8Array {
  const sortedReplacer = (_key: string, value: unknown): unknown => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[k] = (value as Record<string, unknown>)[k]
      }
      return sorted
    }
    return value
  }
  return new TextEncoder().encode(JSON.stringify(sig, sortedReplacer))
}

const KEYWORD_PREFIX = 'attestto-sig-v1:'

// ── Incremental update (browser-compatible port) ───────────────

const TEXT_DECODER = new TextDecoder('latin1')
const TEXT_ENCODER = new TextEncoder()

function tailString(bytes: Uint8Array, n: number): string {
  return TEXT_DECODER.decode(bytes.subarray(Math.max(0, bytes.length - n)))
}

function findPrevStartxref(bytes: Uint8Array): number {
  const tail = tailString(bytes, 4096)
  const match = tail.match(/startxref\s+(\d+)\s+%%EOF\s*$/)
  if (!match) throw new Error('Could not locate trailing startxref/%%EOF')
  return parseInt(match[1], 10)
}

function extractTopLevelDict(text: string, from: number): string {
  const open = text.indexOf('<<', from)
  if (open < 0) throw new Error('Dict open marker not found')
  let depth = 0
  let i = open
  while (i < text.length - 1) {
    const two = text.substring(i, i + 2)
    if (two === '<<') { depth++; i += 2; continue }
    if (two === '>>') { depth--; if (depth === 0) return text.slice(open + 2, i); i += 2; continue }
    i++
  }
  throw new Error('Unbalanced dict in trailer')
}

function readTrailerDict(bytes: Uint8Array, startxrefOffset: number): string {
  const win = TEXT_DECODER.decode(bytes.subarray(startxrefOffset, Math.min(bytes.length, startxrefOffset + 65536)))
  if (win.startsWith('xref')) {
    const idx = win.indexOf('trailer')
    if (idx < 0) throw new Error('Classic xref without trailer keyword')
    return extractTopLevelDict(win, idx + 'trailer'.length)
  }
  const dictStart = win.indexOf('<<')
  if (dictStart < 0) throw new Error('Xref stream without dict')
  return extractTopLevelDict(win, dictStart)
}

interface PriorRevisionInfo {
  prevStartxref: number
  prevSize: number
  rootRef: string
  encrypted: boolean
}

function parseTrailerFields(dictBody: string, prevStartxref: number): PriorRevisionInfo {
  const sizeMatch = dictBody.match(/\/Size\s+(\d+)/)
  if (!sizeMatch) throw new Error('Trailer missing /Size')
  const rootMatch = dictBody.match(/\/Root\s+(\d+\s+\d+\s+R)/)
  if (!rootMatch) throw new Error('Trailer missing /Root')
  return {
    prevStartxref,
    prevSize: parseInt(sizeMatch[1], 10),
    rootRef: rootMatch[1],
    encrypted: /\/Encrypt\b/.test(dictBody),
  }
}

function pdfUnicodeString(s: string): string {
  const bytes: number[] = [0xfe, 0xff]
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (code <= 0xffff) {
      bytes.push((code >> 8) & 0xff, code & 0xff)
    } else {
      const offset = code - 0x10000
      const high = 0xd800 + (offset >> 10)
      const low = 0xdc00 + (offset & 0x3ff)
      bytes.push((high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff)
    }
  }
  let hex = '<'
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex + '>'
}

function pdfDateString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `(D:${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}+00'00')`
}

/** Detect pre-existing PAdES /Sig in the PDF. */
export function hasExistingSignature(bytes: Uint8Array): boolean {
  const text = TEXT_DECODER.decode(bytes)
  return /\/Type\s*\/Sig\b/.test(text) || /\/SigFlags\s+[13]\b/.test(text)
}

function appendKeywordRevision(pdfBytes: Uint8Array, keywordEntry: string, carriedInfo: Record<string, string | undefined> = {}): Uint8Array {
  const prevStartxref = findPrevStartxref(pdfBytes)
  const trailerDict = readTrailerDict(pdfBytes, prevStartxref)
  const prior = parseTrailerFields(trailerDict, prevStartxref)

  if (prior.encrypted) throw new Error('Encrypted PDFs are not supported')

  const newInfoObj = prior.prevSize
  const newSize = prior.prevSize + 1

  const lines: string[] = []
  if (carriedInfo.title) lines.push(`/Title ${pdfUnicodeString(carriedInfo.title)}`)
  if (carriedInfo.author) lines.push(`/Author ${pdfUnicodeString(carriedInfo.author)}`)
  if (carriedInfo.subject) lines.push(`/Subject ${pdfUnicodeString(carriedInfo.subject)}`)
  lines.push(`/Producer ${pdfUnicodeString('Attestto App')}`)
  lines.push(`/ModDate ${pdfDateString(new Date())}`)
  lines.push(`/Keywords ${pdfUnicodeString(keywordEntry)}`)

  let revision = ''
  const lastByte = pdfBytes[pdfBytes.length - 1]
  if (lastByte !== 0x0a && lastByte !== 0x0d) revision += '\n'

  const infoObjStartInRevision = revision.length
  revision += `${newInfoObj} 0 obj\n<<\n${lines.join('\n')}\n>>\nendobj\n`

  const xrefStartInRevision = revision.length
  const infoOffset = pdfBytes.length + infoObjStartInRevision
  revision += 'xref\n'
  revision += `${newInfoObj} 1\n`
  revision += `${infoOffset.toString().padStart(10, '0')} 00000 n \n`

  revision += 'trailer\n'
  revision += `<< /Size ${newSize} /Root ${prior.rootRef} /Info ${newInfoObj} 0 R /Prev ${prior.prevStartxref} >>\n`

  const newStartxref = pdfBytes.length + xrefStartInRevision
  revision += `startxref\n${newStartxref}\n%%EOF\n`

  const revBytes = TEXT_ENCODER.encode(revision)
  const out = new Uint8Array(pdfBytes.length + revBytes.length)
  out.set(pdfBytes, 0)
  out.set(revBytes, pdfBytes.length)
  return out
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Sign a PDF with the user's vault Ed25519 key.
 * Embeds JSON-LD VC in Keywords field + visible stamp on last page.
 */
export async function signPdf(opts: SignPdfOptions): Promise<SignPdfResult> {
  const originalHash = await sha256Hex(opts.pdfBytes)
  const signedAt = new Date().toISOString()
  const did = crypto.getDID()
  const displayName = crypto.getDisplayName()

  const unsigned: Omit<AttesttoPdfSignature, 'proof'> = {
    v: 1,
    type: ['VerifiableCredential', 'AttesttoPdfSignature'],
    issuer: did,
    issuerName: displayName || undefined,
    signedAt,
    documentHash: originalHash,
    fileName: opts.fileName,
    level: 'self-attested',
    mock: false,
    mode: opts.mode ?? 'final',
    reason: opts.reason,
  }

  const payloadBytes = canonicalPayload(unsigned)
  const sigBytes = crypto.sign(payloadBytes)
  const publicKey = crypto.getPublicKeyBytes()

  const signature: AttesttoPdfSignature = {
    ...unsigned,
    proof: {
      type: 'Ed25519Signature2020',
      created: signedAt,
      verificationMethod: `${did}#key-1`,
      proofPurpose: 'assertionMethod',
      proofValue: bytesToBase64(sigBytes),
      publicKey: bytesToBase64(publicKey),
    },
  }

  const sigJson = JSON.stringify(signature)
  const sigB64 = btoa(unescape(encodeURIComponent(sigJson)))
  const keywordEntry = `${KEYWORD_PREFIX}${sigB64}`

  // If pre-existing PAdES signature, use incremental update to preserve it
  if (hasExistingSignature(opts.pdfBytes)) {
    let carriedInfo: Record<string, string | undefined> = {}
    try {
      const probe = await PDFDocument.load(opts.pdfBytes, { ignoreEncryption: true, updateMetadata: false })
      carriedInfo = {
        title: probe.getTitle(),
        author: probe.getAuthor(),
        subject: probe.getSubject(),
      }
    } catch { /* best-effort */ }

    return {
      pdfBytes: appendKeywordRevision(opts.pdfBytes, keywordEntry, carriedInfo),
      originalHash,
      signature,
      stampSuppressed: true,
    }
  }

  // Full rewrite path: embed keyword + visible stamp
  const doc = await PDFDocument.load(opts.pdfBytes)
  doc.setProducer('Attestto App')
  doc.setModificationDate(new Date())

  const existing = (doc.getKeywords() ?? '')
    .split(/\s+/)
    .filter((k) => k && !k.startsWith(KEYWORD_PREFIX))
  doc.setKeywords([...existing, keywordEntry])

  // Visible stamp on last page
  const pages = doc.getPages()
  const lastPage = pages[pages.length - 1]
  const { width } = lastPage.getSize()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontSm = await doc.embedFont(StandardFonts.Helvetica)

  const stampW = 240
  const stampH = 92
  const margin = 24
  const x = width - stampW - margin
  const y = margin

  lastPage.drawRectangle({
    x, y, width: stampW, height: stampH,
    color: rgb(0.96, 0.99, 0.97),
    borderColor: rgb(0.02, 0.47, 0.34),
    borderWidth: 1.2,
    opacity: 0.95,
  })

  const headline = opts.mode === 'open' ? 'FIRMADO · EDITABLE' : 'FIRMADO · FINAL'
  lastPage.drawText(headline, {
    x: x + 12, y: y + stampH - 18, size: 10, font,
    color: rgb(0.02, 0.47, 0.34),
  })

  const nameLine = displayName || did.slice(0, 30) + '…'
  lastPage.drawText(nameLine, {
    x: x + 12, y: y + stampH - 34, size: 9, font: fontSm,
    color: rgb(0.1, 0.15, 0.2), maxWidth: stampW - 24,
  })

  const dateLine = signedAt.slice(0, 19).replace('T', ' ') + ' UTC'
  lastPage.drawText(dateLine, {
    x: x + 12, y: y + stampH - 62, size: 7, font: fontSm,
    color: rgb(0.3, 0.35, 0.4),
  })

  lastPage.drawText('Attestto · Nivel B (auto-atestada)', {
    x: x + 12, y: y + 12, size: 7, font: fontSm,
    color: rgb(0.4, 0.45, 0.5),
  })

  const out = await doc.save({ useObjectStreams: false })

  return {
    pdfBytes: out,
    originalHash,
    signature,
    stampSuppressed: false,
  }
}

/**
 * Extract the Attestto signature from a PDF, if present.
 */
export async function extractSignature(pdfBytes: Uint8Array): Promise<AttesttoPdfSignature | null> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  } catch {
    return null
  }

  const keywords = doc.getKeywords() ?? ''
  const entry = keywords.split(/\s+/).find((k) => k.startsWith(KEYWORD_PREFIX))
  if (!entry) return null

  const b64 = entry.slice(KEYWORD_PREFIX.length)
  try {
    const json = decodeURIComponent(escape(atob(b64)))
    const parsed = JSON.parse(json) as AttesttoPdfSignature
    if (parsed?.v === 1 && parsed?.proof?.type === 'Ed25519Signature2020') return parsed
    return null
  } catch {
    return null
  }
}

/**
 * Verify an Attestto signature extracted from a PDF.
 */
export async function verifySignature(pdfBytes: Uint8Array): Promise<VerifyResult | null> {
  const sig = await extractSignature(pdfBytes)
  if (!sig) return null

  const { proof, ...rest } = sig
  const canonical = canonicalPayload(rest as Omit<AttesttoPdfSignature, 'proof'>)

  const pubkey = base64ToBytes(proof.publicKey)
  const sigBytes = base64ToBytes(proof.proofValue)

  let signatureValid = false
  try {
    signatureValid = crypto.verify(canonical, sigBytes, pubkey)
  } catch {
    signatureValid = false
  }

  const issuerBinding = sig.issuer.startsWith('did:key:z') && pubkey.length === 32

  return {
    valid: signatureValid && issuerBinding,
    reason: !signatureValid
      ? 'Ed25519 signature mismatch'
      : !issuerBinding ? 'Issuer DID does not match embedded public key' : undefined,
    signature: sig,
    signatureValid,
    issuerBinding,
  }
}
