/**
 * Composable for on-device LLM inference via MediaPipe Web Worker.
 * Downloads Gemma on first use (user must opt in via Settings).
 * Caches via OPFS (Origin Private File System) for higher quota than Cache API.
 */

import { ref } from 'vue'

// Gemma 2B IT int4 — ~1.35 GB. Community mirror (public, no auth).
// TODO: Host on own CDN (R2/S3) for production to lock version and avoid third-party dependency.
const MODEL_URL = 'https://huggingface.co/alexdlov/gemma-2b-it-gpu-int4.bin/resolve/main/gemma-2b-it-gpu-int4.bin'
const MODEL_FILENAME = 'gemma-2b-it-gpu-int4.bin'
const OPT_IN_KEY = 'attestto-llm-enabled'

export type LlmStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'generating' | 'error' | 'unsupported'

const status = ref<LlmStatus>('idle')
const downloadProgress = ref(0) // 0-100
const errorMessage = ref('')
const enabled = ref(localStorage.getItem(OPT_IN_KEY) === 'true')
const modelCached = ref(false)

// Check if model exists in OPFS on load
checkModelCached()

async function checkModelCached(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    const file = await root.getFileHandle(MODEL_FILENAME)
    const f = await file.getFile()
    modelCached.value = f.size > 0
  } catch {
    modelCached.value = false
  }
}

const modelSize = '~1.35 GB'

let worker: Worker | null = null
let messageId = 0
const pending = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>()

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
 * Initialize the LLM worker and load the model.
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
    const modelBlobUrl = await ensureModelReady()

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
    await sendMessage('init', { modelUrl: modelBlobUrl })
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
    enabled,
    modelCached,
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
