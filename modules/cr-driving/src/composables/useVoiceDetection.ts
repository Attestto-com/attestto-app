/**
 * useVoiceDetection — Web Audio API voice activity detection.
 *
 * Detects speech during exam (someone reading aloud, another person talking).
 * Uses AudioContext + AnalyserNode to monitor RMS volume levels.
 * Fires events when sustained speech is detected.
 */
import { ref, onUnmounted } from 'vue'

export interface VoiceEvent {
  type: 'voice-detected' | 'voice-stopped'
  data?: Record<string, unknown>
  timestamp: number
}

export function useVoiceDetection() {
  const isListening = ref(false)
  const voiceActive = ref(false)
  const error = ref<string | null>(null)

  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let mediaStreamSource: MediaStreamAudioSourceNode | null = null
  let checkInterval: ReturnType<typeof setInterval> | null = null
  let onEvent: ((event: VoiceEvent) => void) | null = null

  // Tuning
  const RMS_THRESHOLD = 0.02 // volume threshold for "speech"
  const SUSTAINED_MS = 2000 // must be above threshold for 2s to trigger
  let aboveThresholdSince: number | null = null

  function setEventCallback(cb: (event: VoiceEvent) => void): void {
    onEvent = cb
  }

  async function start(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })

      audioContext = new AudioContext()
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8

      mediaStreamSource = audioContext.createMediaStreamSource(stream)
      mediaStreamSource.connect(analyser)

      isListening.value = true

      // Check RMS every 200ms
      const dataArray = new Float32Array(analyser.fftSize)
      checkInterval = setInterval(() => {
        if (!analyser) return
        analyser.getFloatTimeDomainData(dataArray)

        // Calculate RMS
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i]
        }
        const rms = Math.sqrt(sum / dataArray.length)

        const now = Date.now()

        if (rms > RMS_THRESHOLD) {
          if (!aboveThresholdSince) aboveThresholdSince = now

          if (!voiceActive.value && now - aboveThresholdSince >= SUSTAINED_MS) {
            voiceActive.value = true
            onEvent?.({
              type: 'voice-detected',
              data: { rms, durationMs: now - aboveThresholdSince },
              timestamp: now,
            })
          }
        } else {
          if (voiceActive.value) {
            voiceActive.value = false
            onEvent?.({ type: 'voice-stopped', timestamp: now })
          }
          aboveThresholdSince = null
        }
      }, 200)
    } catch (err) {
      error.value = `Error al acceder al microfono: ${err}`
    }
  }

  function stop(): void {
    isListening.value = false
    voiceActive.value = false
    aboveThresholdSince = null

    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = null
    }
    if (mediaStreamSource) {
      mediaStreamSource.disconnect()
      mediaStreamSource = null
    }
    if (audioContext) {
      audioContext.close()
      audioContext = null
    }
    analyser = null
  }

  onUnmounted(() => stop())

  return {
    isListening,
    voiceActive,
    error,
    start,
    stop,
    setEventCallback,
  }
}
