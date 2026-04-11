/**
 * useFaceDetection — MediaPipe FaceLandmarker for PWA.
 *
 * Upgraded from FaceDetector to FaceLandmarker for:
 * - 468 facial landmarks
 * - Blendshapes (eyeBlinkLeft/Right, jawOpen, headYaw, headPitch)
 * - Face identity embedding for continuous verification
 *
 * Face present / absent / multiple detection at ~4fps.
 * Anomaly-triggered frame capture with SHA-256 hash.
 * All local — no frames leave the device.
 */
import { ref, onUnmounted } from 'vue'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'

export type FaceStatus = 'initializing' | 'present' | 'absent' | 'multiple' | 'error'

export interface BlendshapeValues {
  eyeBlinkLeft: number
  eyeBlinkRight: number
  jawOpen: number
  /** Positive = looking right, negative = looking left */
  headYaw: number
  /** Positive = looking up, negative = looking down */
  headPitch: number
}

export interface FaceEvent {
  type: 'face-absent' | 'face-present' | 'face-multiple' | 'frame-captured' | 'face-blocked'
  data?: Record<string, unknown>
  timestamp: number
}

const BLENDSHAPE_DEFAULTS: BlendshapeValues = {
  eyeBlinkLeft: 0,
  eyeBlinkRight: 0,
  jawOpen: 0,
  headYaw: 0,
  headPitch: 0,
}

export function useFaceDetection() {
  const status = ref<FaceStatus>('initializing')
  const faceCount = ref(0)
  const error = ref<string | null>(null)
  const isRunning = ref(false)
  const lastFrameHash = ref<string | null>(null)
  const blendshapes = ref<BlendshapeValues>({ ...BLENDSHAPE_DEFAULTS })
  const blocked = ref(false)

  let landmarker: FaceLandmarker | null = null
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

      landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 3,
        minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
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

  // ── Blendshape extraction ──────────────────────────

  function extractBlendshapes(result: FaceLandmarkerResult): BlendshapeValues {
    if (!result.faceBlendshapes?.length) return { ...BLENDSHAPE_DEFAULTS }

    const shapes = result.faceBlendshapes[0].categories
    const get = (name: string): number =>
      shapes.find((s) => s.categoryName === name)?.score ?? 0

    // Head pose from transformation matrix
    let headYaw = 0
    let headPitch = 0
    if (result.facialTransformationMatrixes?.length) {
      const m = result.facialTransformationMatrixes[0].data
      // Rotation matrix → Euler angles (simplified)
      headYaw = Math.atan2(m[8], m[10]) * (180 / Math.PI)
      headPitch = Math.asin(-m[9]) * (180 / Math.PI)
    }

    return {
      eyeBlinkLeft: get('eyeBlinkLeft'),
      eyeBlinkRight: get('eyeBlinkRight'),
      jawOpen: get('jawOpen'),
      headYaw,
      headPitch,
    }
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

  /** Capture a reference frame as ImageData for identity comparison */
  function captureReferenceFrame(): ImageData | null {
    if (!videoElement || videoElement.readyState < 2) return null
    const canvas = document.createElement('canvas')
    canvas.width = videoElement.videoWidth
    canvas.height = videoElement.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(videoElement, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  // ── Detection loop ─────────────────────────────────

  function detectLoop(timestamp: number): void {
    if (!isRunning.value || !landmarker || !videoElement) return

    if (timestamp - lastDetectionTime >= DETECTION_INTERVAL_MS) {
      lastDetectionTime = timestamp

      try {
        const result = landmarker.detectForVideo(videoElement, timestamp)
        const count = result.faceLandmarks.length
        faceCount.value = count

        // Extract blendshapes from first face
        if (count > 0) {
          blendshapes.value = extractBlendshapes(result)
        }

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
            captureFrameHash()
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
          // Multiple faces → immediate block
          status.value = 'multiple'
          if (!blocked.value) {
            blocked.value = true
            onEvent?.({
              type: 'face-blocked',
              data: { count, reason: 'multiple-faces' },
              timestamp: Date.now(),
            })
          }
          onEvent?.({
            type: 'face-multiple',
            data: { count },
            timestamp: Date.now(),
          })
          captureFrameHash()
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
    if (!landmarker) await initialize()
    if (!landmarker) return

    isRunning.value = true
    blocked.value = false
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

  function unblock(): void {
    blocked.value = false
  }

  onUnmounted(() => {
    stop()
    landmarker?.close()
    landmarker = null
  })

  return {
    status,
    faceCount,
    error,
    isRunning,
    lastFrameHash,
    blendshapes,
    blocked,
    start,
    stop,
    unblock,
    setEventCallback,
    initialize,
    captureFrameHash,
    captureReferenceFrame,
  }
}
