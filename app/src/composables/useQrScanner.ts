import { ref, onUnmounted } from 'vue'
import QrScanner from 'qr-scanner'

export function useQrScanner() {
  const result = ref<string | null>(null)
  const scanning = ref(false)
  const error = ref<string | null>(null)

  let scanner: QrScanner | null = null

  async function start(videoEl: HTMLVideoElement): Promise<void> {
    if (scanner) stop()

    error.value = null
    result.value = null
    scanning.value = true

    scanner = new QrScanner(
      videoEl,
      (scanResult) => {
        result.value = scanResult.data
        scanning.value = false
        stop()
      },
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
      },
    )

    try {
      await scanner.start()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Error al iniciar camara'
      scanning.value = false
    }
  }

  function stop() {
    if (scanner) {
      scanner.stop()
      scanner.destroy()
      scanner = null
    }
    scanning.value = false
  }

  function reset() {
    result.value = null
    error.value = null
  }

  onUnmounted(() => stop())

  return { result, scanning, error, start, stop, reset }
}
