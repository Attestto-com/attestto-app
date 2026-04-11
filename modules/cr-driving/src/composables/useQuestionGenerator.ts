import type { ExamQuestion } from '../types'
import type { LlmHandle } from '@attestto/module-sdk'

interface GenerateRequest {
  licenseType: string
  categories: string[]
  count: number
  difficulty: 'easy' | 'medium' | 'hard'
  /** Manual chapter content for context */
  context?: string
}

interface RawGeneratedQuestion {
  question: string
  options: string[]
  correct: number
  why: string
  category: string
}

function buildPrompt(request: GenerateRequest): string {
  const diffLabel =
    request.difficulty === 'easy' ? 'basica'
    : request.difficulty === 'hard' ? 'avanzada'
    : 'intermedia'

  return `Eres un generador de preguntas para el examen teorico de conducir de Costa Rica (COSEVI).

REGLAS ESTRICTAS:
- Genera exactamente ${request.count} preguntas nuevas y UNICAS sobre: ${request.categories.join(', ')}
- Dificultad: ${diffLabel}
- Cada pregunta debe evaluar COMPRENSION del concepto, no memoria textual
- Reformula usando situaciones practicas, escenarios de conduccion real, o aplicacion de la ley
- Las 4 opciones deben ser plausibles — no pongas opciones obviamente incorrectas
- La explicacion ("why") debe enseñar el concepto, no solo decir cual es correcta
- Responde SOLO con un JSON array valido, sin texto adicional

CONTEXTO DEL MANUAL:
${request.context ?? 'No disponible'}

FORMATO DE RESPUESTA (JSON array):
[
  {
    "question": "pregunta aqui",
    "options": ["opcion A", "opcion B", "opcion C", "opcion D"],
    "correct": 0,
    "why": "explicacion educativa",
    "category": "${request.categories[0] ?? 'General'}"
  }
]

Genera ${request.count} preguntas:`
}

/**
 * Parse LLM response text into structured questions.
 * Handles common LLM output quirks (markdown fences, trailing text).
 */
function parseResponse(text: string, licenseType: string): ExamQuestion[] {
  // Extract JSON array from response (handle markdown fences)
  let json = text.trim()
  const fenceStart = json.indexOf('```')
  if (fenceStart >= 0) {
    const afterFence = json.indexOf('\n', fenceStart)
    const fenceEnd = json.indexOf('```', afterFence)
    json = json.slice(afterFence + 1, fenceEnd >= 0 ? fenceEnd : undefined).trim()
  }

  // Find the array bounds
  const arrStart = json.indexOf('[')
  const arrEnd = json.lastIndexOf(']')
  if (arrStart < 0 || arrEnd < 0) return []

  json = json.slice(arrStart, arrEnd + 1)

  const parsed = JSON.parse(json) as RawGeneratedQuestion[]
  if (!Array.isArray(parsed)) return []

  return parsed
    .filter((q) =>
      q.question &&
      Array.isArray(q.options) &&
      q.options.length >= 3 &&
      typeof q.correct === 'number' &&
      q.correct >= 0 &&
      q.correct < q.options.length &&
      q.why,
    )
    .map((q, i) => ({
      id: `llm-${Date.now()}-${i}`,
      category: q.category || 'General',
      question: q.question,
      options: q.options.slice(0, 4),
      correct: q.correct,
      why: q.why,
      licenses: [licenseType],
    }))
}

// Module context LLM handle — set by the module on install
let llmHandle: LlmHandle | null = null

export function setLlmHandle(handle: LlmHandle): void {
  llmHandle = handle
}

export function getLlmStatus(): { available: boolean; status: string; supported: boolean } {
  if (!llmHandle) return { available: false, status: 'no-handle', supported: false }
  return {
    available: llmHandle.status() === 'ready',
    status: llmHandle.status(),
    supported: llmHandle.supported,
  }
}

/**
 * Generate exam questions using the on-device LLM (MediaPipe + Gemma).
 * Falls back gracefully — caller should use seed bank if this fails.
 */
export async function generateQuestions(
  request: GenerateRequest,
): Promise<ExamQuestion[]> {
  if (!llmHandle || !llmHandle.supported) {
    throw new Error('LLM no disponible en este dispositivo')
  }

  // Initialize LLM if not ready
  if (llmHandle.status() !== 'ready') {
    await llmHandle.init()
  }

  if (llmHandle.status() !== 'ready') {
    throw new Error('LLM no pudo inicializar')
  }

  const prompt = buildPrompt(request)
  const response = await llmHandle.generate(prompt)

  return parseResponse(response, request.licenseType)
}

/**
 * Load manual chapter content for LLM context.
 * Returns a truncated string suitable for prompt context.
 */
export async function loadManualContext(
  licenseType: string,
  categories: string[],
): Promise<string> {
  const manualFile =
    licenseType === 'A'
      ? '../../content/manuals/moto.json'
      : licenseType === 'PRO'
        ? '../../content/manuals/transporte-publico.json'
        : '../../content/manuals/automovil.json'

  try {
    const mod = await import(/* @vite-ignore */ manualFile)
    const data = mod.default ?? mod

    // Extract chapters matching requested categories
    const chapters = (data.chapters ?? []).filter(
      (ch: { title: string }) =>
        categories.length === 0 ||
        categories.some((cat) =>
          ch.title.toLowerCase().includes(cat.toLowerCase()),
        ),
    )

    // Build context string, truncate to ~4000 chars for prompt size
    const context = chapters
      .map((ch: { title: string; sections?: { title: string; content: string }[] }) => {
        const sections = (ch.sections ?? [])
          .map((s) => `${s.title}: ${s.content}`)
          .join('\n')
        return `## ${ch.title}\n${sections}`
      })
      .join('\n\n')

    return context.slice(0, 4000)
  } catch {
    return ''
  }
}
