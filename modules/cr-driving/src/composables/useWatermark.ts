/**
 * Invisible watermark for exam question area (ATT-403).
 *
 * Embeds a steganographic identifier into the question display
 * using zero-width Unicode characters + CSS-based micro-positioning.
 * If someone screenshots the exam, the watermark can be extracted
 * to identify the session and user.
 */

// Zero-width characters for binary encoding
const ZERO = '\u200B' // zero-width space  = 0
const ONE = '\u200C'  // zero-width non-joiner = 1
const SEP = '\u200D'  // zero-width joiner = separator

/**
 * Encode a string into zero-width Unicode characters.
 * Each byte becomes 8 zero-width chars.
 */
export function encodeWatermark(payload: string): string {
  const bytes = new TextEncoder().encode(payload)
  let result = ''
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit--) {
      result += (byte >> bit) & 1 ? ONE : ZERO
    }
    result += SEP
  }
  return result
}

/**
 * Decode zero-width Unicode characters back to a string.
 */
export function decodeWatermark(encoded: string): string {
  const parts = encoded.split(SEP).filter((p) => p.length > 0)
  const bytes = new Uint8Array(parts.length)
  for (let i = 0; i < parts.length; i++) {
    let byte = 0
    for (let bit = 0; bit < 8 && bit < parts[i].length; bit++) {
      if (parts[i][bit] === ONE) {
        byte |= 1 << (7 - bit)
      }
    }
    bytes[i] = byte
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Build a watermark payload for an exam session.
 */
export function buildWatermarkPayload(
  sessionId: string,
  userDid: string,
  questionIndex: number,
): string {
  const ts = Math.floor(Date.now() / 1000)
  return `${sessionId.slice(0, 8)}|${userDid.slice(-12)}|${questionIndex}|${ts}`
}

/**
 * Generate CSS for invisible visual watermark overlay.
 * Uses repeating micro-text with very low opacity.
 */
export function getWatermarkStyle(payload: string): Record<string, string> {
  // Encode payload into a CSS-safe format using data URI
  const encoded = btoa(payload)
  return {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    userSelect: 'none',
    overflow: 'hidden',
    opacity: '0.003',
    fontSize: '8px',
    lineHeight: '10px',
    color: 'white',
    wordBreak: 'break-all',
    zIndex: '1',
    // Repeat the encoded payload to fill the area
    content: encoded,
  }
}

/**
 * Strip zero-width characters from visible text for display.
 */
export function stripWatermark(text: string): string {
  return text.replace(/[\u200B\u200C\u200D]/g, '')
}
