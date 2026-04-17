/**
 * Composable for on-device LLM inference via MediaPipe Web Worker.
 * Downloads Gemma on first use (user must opt in via Settings).
 * Caches via OPFS (Origin Private File System) for higher quota than Cache API.
 */

import { ref } from 'vue'

// Gemma 2B IT int4 — ~1.35 GB. Community mirror (public, no auth).
// Self-hosted CDN mirror planned for version-locking (R2/S3). stub-guard-ignore
const MODEL_URL = 'https://huggingface.co/alexdlov/gemma-2b-it-gpu-int4.bin/resolve/main/gemma-2b-it-gpu-int4.bin'
const MODEL_FILENAME = 'gemma-2b-it-gpu-int4.bin'
const OPT_IN_KEY = 'attestto-llm-enabled'

export type LlmStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'generating' | 'error' | 'unsupported'

const status = ref<LlmStatus>('idle')
const downloadProgress = ref(0) // 0-100
const errorMessage = ref('')
const enabled = ref(localStorage.getItem(OPT_IN_KEY) === 'true')
const modelCached = ref(false)
const cacheChecked = ref(false)

// Clean up any leftover data from previous caching attempts
cleanupLegacyCache()

async function checkModelCached(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    const file = await root.getFileHandle(MODEL_FILENAME)
    const f = await file.getFile()
    modelCached.value = f.size > 0
  } catch {
    modelCached.value = false
  }
  cacheChecked.value = true
}

async function cleanupLegacyCache(): Promise<void> {
  // Remove old Cache API data that may be consuming quota
  await caches.delete('attestto-llm-model-v1').catch(() => {})
  await checkModelCached()

  // Auto-init only if user opted in AND model is fully cached locally.
  // Skip auto-init when storage is tight — user can tap to retry manually.
  if (enabled.value && modelCached.value) {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((est) => {
        const free = (est.quota ?? 0) - (est.usage ?? 0)
        const MIN_BYTES = 500 * 1024 * 1024 // 500 MB headroom for cached model load
        if (free >= MIN_BYTES) {
          init().catch(() => {})
        } else {
          status.value = 'error'
          errorMessage.value = 'Almacenamiento insuficiente para cargar el modelo'
        }
      }).catch(() => {
        // Can't check storage — try anyway
        init().catch(() => {})
      })
    } else {
      init().catch(() => {})
    }
  }
}

const modelSize = '~1.35 GB'

let llmInstance: import('@mediapipe/tasks-genai').LlmInference | null = null

function supportsWebGpu(): boolean {
  return 'gpu' in navigator
}

/**
 * Download model with progress tracking, store in OPFS.
 * OPFS has much higher quota than Cache API (~60% of disk on Chrome).
 * Returns a Blob URL for the worker to load.
 */
async function ensureModelReady(): Promise<string> {
  // Check OPFS first
  try {
    const root = await navigator.storage.getDirectory()
    const fileHandle = await root.getFileHandle(MODEL_FILENAME)
    const file = await fileHandle.getFile()
    if (file.size > 0) {
      modelCached.value = true
      return URL.createObjectURL(file)
    }
  } catch {
    // File doesn't exist yet
  }

  // Request persistent storage (helps with quota)
  if (navigator.storage?.persist) {
    await navigator.storage.persist().catch(() => {})
  }

  status.value = 'downloading'
  downloadProgress.value = 0

  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`Error de descarga (${res.status})`)

  const contentLength = Number(res.headers.get('content-length') ?? 0)
  const reader = res.body?.getReader()
  if (!reader) throw new Error('ReadableStream no soportado')

  // Stream to OPFS file (avoids holding entire model in memory)
  const root = await navigator.storage.getDirectory()
  const fileHandle = await root.getFileHandle(MODEL_FILENAME, { create: true })
  const writable = await fileHandle.createWritable()
  let received = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      await writable.write(value)
      received += value.byteLength
      if (contentLength > 0) {
        downloadProgress.value = Math.round((received / contentLength) * 100)
      }
    }
    await writable.close()
  } catch (err) {
    await writable.abort()
    // Clean up partial file
    try { await root.removeEntry(MODEL_FILENAME) } catch {}
    throw err
  }

  downloadProgress.value = 100
  modelCached.value = true

  // Return blob URL for the worker
  const file = await fileHandle.getFile()
  return URL.createObjectURL(file)
}

/**
 * User opts in to on-device AI.
 */
function enable(): void {
  enabled.value = true
  localStorage.setItem(OPT_IN_KEY, 'true')
}

/**
 * User opts out. Stops worker, frees GPU, but keeps cached model.
 */
function disable(): void {
  enabled.value = false
  localStorage.removeItem(OPT_IN_KEY)
  destroy()
}

/**
 * Delete the cached model to free storage.
 */
async function deleteCache(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(MODEL_FILENAME)
  } catch {}
  // Also clean up legacy Cache API entries
  await caches.delete('attestto-llm-model-v1').catch(() => {})
  modelCached.value = false
  disable()
}

/**
 * Initialize MediaPipe LLM Inference directly (no worker).
 * Requires user opt-in via enable().
 */
async function init(): Promise<void> {
  if (status.value === 'ready' || status.value === 'loading' || status.value === 'downloading') return

  if (!enabled.value) return

  if (!supportsWebGpu()) {
    status.value = 'unsupported'
    errorMessage.value = 'WebGPU no disponible en este navegador'
    return
  }

  try {
    // Check available storage before attempting download
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      const free = (est.quota ?? 0) - (est.usage ?? 0)
      const MIN_BYTES = 1.5 * 1024 * 1024 * 1024 // 1.5 GB headroom
      if (free < MIN_BYTES) {
        status.value = 'error'
        errorMessage.value = `Almacenamiento insuficiente. Necesitas ~1.5 GB libres (disponible: ${Math.round(free / (1024 * 1024))} MB)`
        return
      }
    }

    // Try OPFS cache first, fall back to download
    let modelUrl: string
    try {
      modelUrl = await ensureModelReady()
    } catch (dlErr) {
      status.value = 'error'
      errorMessage.value = dlErr instanceof Error ? dlErr.message : 'Error descargando modelo'
      return
    }

    status.value = 'loading'

    const { FilesetResolver, LlmInference } = await import('@mediapipe/tasks-genai')

    const genaiFileset = await FilesetResolver.forGenAiTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm',
    )

    llmInstance = await LlmInference.createFromOptions(genaiFileset, {
      baseOptions: {
        modelAssetPath: modelUrl,
      },
      maxTokens: 2048,
      temperature: 0.7,
      topK: 40,
      randomSeed: Math.floor(Math.random() * 100000),
    })

    status.value = 'ready'
  } catch (err) {
    status.value = 'error'
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('quota') || msg.includes('QuotaExceededError')) {
      errorMessage.value = 'Almacenamiento insuficiente. Libera espacio o desactiva IA en Ajustes.'
    } else {
      errorMessage.value = msg
    }
    throw err
  }
}

/**
 * Generate a response from the on-device LLM.
 * Must call init() first.
 */
async function generate(prompt: string): Promise<string> {
  if (!llmInstance || status.value !== 'ready') {
    throw new Error('LLM no inicializado')
  }
  status.value = 'generating'
  try {
    const response = await llmInstance.generateResponse(prompt)
    status.value = 'ready'
    return response
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : String(err)
    throw err
  }
}

/**
 * Clean up and free GPU memory.
 */
async function destroy(): Promise<void> {
  if (llmInstance) {
    llmInstance.close()
    llmInstance = null
  }
  status.value = 'idle'
}

export function useLlm() {
  return {
    status,
    downloadProgress,
    errorMessage,
    enabled,
    modelCached,
    cacheChecked,
    modelSize,
    init,
    generate,
    destroy,
    enable,
    disable,
    deleteCache,
    supportsWebGpu,
  }
}
