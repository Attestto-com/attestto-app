/**
 * Composable for on-device LLM inference via MediaPipe Web Worker.
 * Downloads Gemma-3 1B on first use, caches via Cache API for offline access.
 */

import { ref } from 'vue'

// Model hosted on your CDN or served from /public — update URL when deploying
const MODEL_URL = '/models/gemma-3-1b-it-int4.bin'
const MODEL_CACHE_KEY = 'attestto-llm-model-v1'

export type LlmStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'generating' | 'error' | 'unsupported'

const status = ref<LlmStatus>('idle')
const downloadProgress = ref(0) // 0-100
const errorMessage = ref('')

let worker: Worker | null = null
let messageId = 0
const pending = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>()

function supportsWebGpu(): boolean {
  return 'gpu' in navigator
}

/**
 * Download model with progress tracking, cache for offline use.
 */
async function ensureModelCached(): Promise<string> {
  const cache = await caches.open(MODEL_CACHE_KEY)
  const cached = await cache.match(MODEL_URL)
  if (cached) return MODEL_URL

  status.value = 'downloading'
  downloadProgress.value = 0

  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`Model download failed (${res.status})`)

  const contentLength = Number(res.headers.get('content-length') ?? 0)
  const reader = res.body?.getReader()
  if (!reader) throw new Error('ReadableStream not supported')

  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    if (contentLength > 0) {
      downloadProgress.value = Math.round((received / contentLength) * 100)
    }
  }

  // Reconstruct response and cache it
  const blob = new Blob(chunks as BlobPart[])
  const cacheResponse = new Response(blob, {
    headers: { 'Content-Type': 'application/octet-stream' },
  })
  await cache.put(MODEL_URL, cacheResponse)
  downloadProgress.value = 100

  return MODEL_URL
}

/**
 * Initialize the LLM worker and load the model.
 * Call once — subsequent calls are no-ops if already ready.
 */
async function init(): Promise<void> {
  if (status.value === 'ready' || status.value === 'loading') return

  if (!supportsWebGpu()) {
    status.value = 'unsupported'
    errorMessage.value = 'WebGPU no disponible en este navegador'
    return
  }

  try {
    const modelUrl = await ensureModelCached()

    status.value = 'loading'

    worker = new Worker(
      new URL('./llmWorker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (e: MessageEvent) => {
      const { type, id, text, error } = e.data
      const p = pending.get(id)

      if (type === 'ready') {
        status.value = 'ready'
        p?.resolve('')
        pending.delete(id)
      } else if (type === 'result') {
        status.value = 'ready'
        p?.resolve(text)
        pending.delete(id)
      } else if (type === 'error') {
        status.value = 'error'
        errorMessage.value = error
        p?.reject(new Error(error))
        pending.delete(id)
      } else if (type === 'destroyed') {
        status.value = 'idle'
        p?.resolve('')
        pending.delete(id)
      }
    }

    // Wait for init to complete
    await sendMessage('init', { modelUrl })
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : String(err)
    throw err
  }
}

function sendMessage(type: string, data: Record<string, unknown> = {}): Promise<string> {
  if (!worker) return Promise.reject(new Error('Worker not initialized'))
  const id = ++messageId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker!.postMessage({ type, id, ...data })
  })
}

/**
 * Generate a response from the on-device LLM.
 * Must call init() first.
 */
async function generate(prompt: string): Promise<string> {
  if (status.value !== 'ready') {
    throw new Error('LLM no inicializado')
  }
  status.value = 'generating'
  return sendMessage('generate', { prompt })
}

/**
 * Clean up worker and free GPU memory.
 */
async function destroy(): Promise<void> {
  if (!worker) return
  try {
    await sendMessage('destroy')
  } finally {
    worker.terminate()
    worker = null
    status.value = 'idle'
  }
}

export function useLlm() {
  return {
    status,
    downloadProgress,
    errorMessage,
    init,
    generate,
    destroy,
    supportsWebGpu,
  }
}
