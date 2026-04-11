/**
 * useFaceIdentity — Continuous face identity verification.
 *
 * Captures a reference face at exam start (pixel hash), then
 * periodically compares current face against the reference.
 *
 * Uses lightweight pixel-diff comparison (not a neural embedding).
 * Sufficient for detecting person swap, not for biometric matching.
 * TSE/BIOMETRIC API integration is deferred until MOPT API access.
 *
 * All processing is local — no frames leave the device.
 */
import { ref } from 'vue'

export interface IdentityVerification {
  referenceHash: string
  capturedAt: number
  checkCount: number
  lastCheckAt: number
  mismatchCount: number
}

const SIMILARITY_THRESHOLD = 0.65 // Pixel-diff similarity (0-1), below = mismatch
const CHECK_INTERVAL_MS = 10_000 // Check every 10s

export function useFaceIdentity() {
  const hasReference = ref(false)
  const mismatchDetected = ref(false)
  const verification = ref<IdentityVerification | null>(null)

  let referencePixels: Uint8ClampedArray | null = null
  let referenceWidth = 0
  let referenceHeight = 0
  let checkInterval: ReturnType<typeof setInterval> | null = null
  let captureFrameFn: (() => ImageData | null) | null = null
  let onMismatch: (() => void) | null = null

  /**
   * Capture reference face at exam start.
   * Call this once after liveness challenge passes.
   */
  async function captureReference(
    getFrame: () => ImageData | null,
  ): Promise<string> {
    captureFrameFn = getFrame
    const frame = getFrame()
    if (!frame) throw new Error('No frame available for reference capture')

    referencePixels = frame.data
    referenceWidth = frame.width
    referenceHeight = frame.height

    // Hash the reference frame
    const hash = await hashPixels(frame.data)

    hasReference.value = true
    verification.value = {
      referenceHash: hash,
      capturedAt: Date.now(),
      checkCount: 0,
      lastCheckAt: Date.now(),
      mismatchCount: 0,
    }

    return hash
  }

  /**
   * Start continuous identity checks during exam.
   */
  function startChecking(onMismatchCb: () => void): void {
    onMismatch = onMismatchCb
    if (!captureFrameFn || !referencePixels) return

    checkInterval = setInterval(() => {
      if (!captureFrameFn || !referencePixels || !verification.value) return

      const frame = captureFrameFn()
      if (!frame) return

      const similarity = compareFrames(referencePixels, frame.data, referenceWidth, referenceHeight)
      verification.value.checkCount++
      verification.value.lastCheckAt = Date.now()

      if (similarity < SIMILARITY_THRESHOLD) {
        verification.value.mismatchCount++

        // Require 3 consecutive mismatches to trigger (avoid false positives)
        if (verification.value.mismatchCount >= 3) {
          mismatchDetected.value = true
          onMismatch?.()
        }
      } else {
        // Reset consecutive mismatch counter on good match
        if (verification.value.mismatchCount > 0) {
          verification.value.mismatchCount = 0
        }
      }
    }, CHECK_INTERVAL_MS)
  }

  function stopChecking(): void {
    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = null
    }
  }

  function reset(): void {
    stopChecking()
    referencePixels = null
    hasReference.value = false
    mismatchDetected.value = false
    verification.value = null
    captureFrameFn = null
    onMismatch = null
  }

  return {
    hasReference,
    mismatchDetected,
    verification,
    captureReference,
    startChecking,
    stopChecking,
    reset,
  }
}

// ── Helpers ──────────────────────────────────────────

/**
 * Lightweight pixel-difference comparison.
 * Downsamples to 64x64 grayscale grid, computes normalized cross-correlation.
 * Returns 0-1 similarity score (1 = identical).
 */
function compareFrames(
  refPixels: Uint8ClampedArray,
  curPixels: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const gridSize = 64
  const stepX = Math.max(1, Math.floor(width / gridSize))
  const stepY = Math.max(1, Math.floor(height / gridSize))

  let sumRef = 0
  let sumCur = 0
  let sumRefSq = 0
  let sumCurSq = 0
  let sumRefCur = 0
  let count = 0

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const idx = (y * width + x) * 4
      // Grayscale luminance
      const refGray = refPixels[idx] * 0.299 + refPixels[idx + 1] * 0.587 + refPixels[idx + 2] * 0.114
      const curGray = curPixels[idx] * 0.299 + curPixels[idx + 1] * 0.587 + curPixels[idx + 2] * 0.114

      sumRef += refGray
      sumCur += curGray
      sumRefSq += refGray * refGray
      sumCurSq += curGray * curGray
      sumRefCur += refGray * curGray
      count++
    }
  }

  if (count === 0) return 0

  // Normalized cross-correlation (Pearson)
  const meanRef = sumRef / count
  const meanCur = sumCur / count
  const varRef = sumRefSq / count - meanRef * meanRef
  const varCur = sumCurSq / count - meanCur * meanCur

  if (varRef <= 0 || varCur <= 0) return 0

  const covariance = sumRefCur / count - meanRef * meanCur
  const correlation = covariance / (Math.sqrt(varRef) * Math.sqrt(varCur))

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, correlation))
}

async function hashPixels(data: Uint8ClampedArray): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
