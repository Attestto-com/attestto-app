/**
 * useCamera — getUserMedia wrapper for PWA.
 * Front-facing camera for face detection and identity verification.
 */
import { ref, onUnmounted } from 'vue'

export function useCamera() {
  const isActive = ref(false)
  const stream = ref<MediaStream | null>(null)
  const error = ref<string | null>(null)

  let videoElement: HTMLVideoElement | null = null

  async function start(): Promise<void> {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      stream.value = mediaStream
      isActive.value = true

      if (videoElement) {
        videoElement.srcObject = mediaStream
        await videoElement.play()
      }
    } catch (err) {
      error.value = `Error al acceder a la camara: ${err}`
      isActive.value = false
    }
  }

  function stop(): void {
    if (stream.value) {
      stream.value.getTracks().forEach((t) => t.stop())
      stream.value = null
    }
    if (videoElement) {
      videoElement.srcObject = null
    }
    isActive.value = false
  }

  function bindVideo(el: HTMLVideoElement | null): void {
    videoElement = el
    if (el && stream.value) {
      el.srcObject = stream.value
      el.play()
    }
  }

  onUnmounted(() => stop())

  return { isActive, stream, error, start, stop, bindVideo }
}
