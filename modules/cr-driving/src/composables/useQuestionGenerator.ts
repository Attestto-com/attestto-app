import type { ExamQuestion } from '../types'

const LLM_URL = import.meta.env.VITE_LLM_URL ?? ''

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

/**
 * Generate exam questions from manual content using an LLM API.
 * Falls back gracefully — caller should use seed bank if this fails.
 *
 * The API endpoint is configurable via VITE_LLM_URL.
 * Expected: POST with body, returns { questions: RawGeneratedQuestion[] }
 */
export async function generateQuestions(
  request: GenerateRequest,
): Promise<ExamQuestion[]> {
  if (!LLM_URL) {
    throw new Error('LLM no disponible — configure VITE_LLM_URL')
  }

  const res = await fetch(`${LLM_URL}/api/generate-questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      license_type: request.licenseType,
      categories: request.categories,
      count: request.count,
      difficulty: request.difficulty,
      context: request.context,
    }),
  })

  if (!res.ok) {
    throw new Error(`LLM error (${res.status})`)
  }

  const data = (await res.json()) as { questions: RawGeneratedQuestion[] }

  return data.questions.map((q, i) => ({
    id: `llm-${Date.now()}-${i}`,
    category: q.category,
    question: q.question,
    options: q.options,
    correct: q.correct,
    why: q.why,
    licenses: [request.licenseType === 'B' ? 'B' : request.licenseType],
  }))
}

/**
 * Load manual chapter content for LLM context.
 * Returns a truncated string suitable for prompt injection.
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
