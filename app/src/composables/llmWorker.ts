/**
 * Web Worker for on-device LLM inference via MediaPipe.
 * Runs Gemma-3 1B locally — no backend, no API key, fully offline after first download.
 */

import { FilesetResolver, LlmInference } from '@mediapipe/tasks-genai'

let llm: LlmInference | null = null

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm'

self.onmessage = async (e: MessageEvent) => {
  const { type, id } = e.data

  if (type === 'init') {
    try {
      const fileset = await FilesetResolver.forGenAiTasks(WASM_CDN)

      llm = await LlmInference.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: e.data.modelUrl,
        },
        maxTokens: 2048,
        temperature: 0.7,
        topK: 40,
        randomSeed: Math.floor(Math.random() * 100000),
      })

      self.postMessage({ type: 'ready', id })
    } catch (err) {
      self.postMessage({
        type: 'error',
        id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }

  if (type === 'generate') {
    if (!llm) {
      self.postMessage({ type: 'error', id, error: 'LLM not initialized' })
      return
    }

    try {
      let result = ''
      await llm.generateResponse(e.data.prompt, (partial: string, done: boolean) => {
        result += partial
        if (done) {
          self.postMessage({ type: 'result', id, text: result })
        }
      })
    } catch (err) {
      self.postMessage({
        type: 'error',
        id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }

  if (type === 'destroy') {
    llm?.close()
    llm = null
    self.postMessage({ type: 'destroyed', id })
  }
}
