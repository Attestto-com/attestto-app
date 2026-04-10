/**
 * useFaceDetection — MediaPipe Face Detector for PWA.
 *
 * Face present / absent / multiple detection at ~4fps.
 * Anomaly-triggered frame capture with SHA-256 hash.
 * All local — no frames leave the device.
 */
import { ref, onUnmounted } from 'vue'
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

export type FaceStatus = 'initializing' | 'present' | 'absent' | 'multiple' | 'error'

export interface FaceEvent {
  type: 'face-absent' | 'face-present' | 'face-multiple' | 'frame-captured'
  data?: Record<string, unknown>
  timestamp: number
}

export function useFaceDetection() {
  const status = ref<FaceStatus>('initializing')
  const faceCount = ref(0)
  const error = ref<string | null>(null)
  const isRunning = ref(false)
  const lastFrameHash = ref<string | null>(null)

  let detector: FaceDetector | null = null
  let animationFrameId: number | null = null
  let videoElement: HTMLVideoElement | null = null
  let onEvent: ((event: FaceEvent) => void) | null = null

  const DETECTION_INTERVAL_MS = 250 // ~4fps
  let lastDetectionTime = 0

  // Absence tracking — fire event after 5s sustained absence
  let absenceStart: number | null = null
  let wasAbsent = false
  const ABSENCE_THRESHOLD_MS = 5_000

  async function initialize(): Promise<void> {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      )

      detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      })

      status.value = 'absent'
    } catch (err) {
      error.value = `Error al inicializar deteccion facial: ${err}`
      status.value = 'error'
    }
  }

  function setEventCallback(cb: (event: FaceEvent) => void): void {
    onEvent = cb
  }

  // ── Anomaly-triggered frame capture ────────────────

  async function captureFrameHash(): Promise<string> {
    if (!videoElement || videoElement.readyState < 2) return ''
    const canvas = document.createElement('canvas')
    canvas.width = videoElement.videoWidth
    canvas.height = videoElement.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(videoElement, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.5),
    )
    if (!blob) return ''
    const buffer = await blob.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    lastFrameHash.value = hash
    onEvent?.({ type: 'frame-captured', data: { frameHash: hash }, timestamp: Date.now() })
    return hash
  }

  // ── Detection loop ─────────────────────────────────

  function detectLoop(timestamp: number): void {
    if (!isRunning.value || !detector || !videoElement) return

    if (timestamp - lastDetectionTime >= DETECTION_INTERVAL_MS) {
      lastDetectionTime = timestamp

      try {
        const result = detector.detectForVideo(videoElement, timestamp)
        const count = result.detections.length
        faceCount.value = count

        if (count === 0) {
          status.value = 'absent'
          if (!absenceStart) absenceStart = timestamp

          if (!wasAbsent && absenceStart && timestamp - absenceStart >= ABSENCE_THRESHOLD_MS) {
            wasAbsent = true
            onEvent?.({
              type: 'face-absent',
              data: { durationMs: timestamp - absenceStart },
              timestamp: Date.now(),
            })
            captureFrameHash() // capture on anomaly
          }
        } else if (count === 1) {
          status.value = 'present'
          if (wasAbsent && absenceStart) {
            onEvent?.({
              type: 'face-present',
              data: { absentMs: timestamp - absenceStart },
              timestamp: Date.now(),
            })
          }
          absenceStart = null
          wasAbsent = false
        } else {
          status.value = 'multiple'
          onEvent?.({
            type: 'face-multiple',
            data: { count },
            timestamp: Date.now(),
          })
          captureFrameHash() // capture on anomaly
          absenceStart = null
          wasAbsent = false
        }
      } catch {
        // Detection can fail on video resize — skip frame
      }
    }

    animationFrameId = requestAnimationFrame(detectLoop)
  }

  // ── Public API ─────────────────────────────────────

  async function start(video: HTMLVideoElement): Promise<void> {
    videoElement = video
    if (!detector) await initialize()
    if (!detector) return

    isRunning.value = true
    absenceStart = null
    wasAbsent = false
    lastDetectionTime = 0
    animationFrameId = requestAnimationFrame(detectLoop)
  }

  function stop(): void {
    isRunning.value = false
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    videoElement = null
    absenceStart = null
    wasAbsent = false
  }

  onUnmounted(() => {
    stop()
    detector?.close()
    detector = null
  })

  return {
    status,
    faceCount,
    error,
    isRunning,
    lastFrameHash,
    start,
    stop,
    setEventCallback,
    initialize,
    captureFrameHash,
  }
}
