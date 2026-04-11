import type { ExamQuestion, ExamConfig } from '../types'
import { generateQuestions, loadManualContext } from './useQuestionGenerator'

// Lazy-loaded question banks
let seedQuestions: ExamQuestion[] | null = null
let understandingQuestions: ExamQuestion[] | null = null
let byLicenseQuestions: ExamQuestion[] | null = null

function mapSeedQuestion(raw: {
  id: number
  chapter: number
  topic: string
  question: string
  options: string[]
  correct: number
  correct_text: string
  explanation: string
}): ExamQuestion {
  return {
    id: `seed-${raw.id}`,
    category: raw.topic,
    question: raw.question,
    options: raw.options,
    correct: raw.correct,
    why: raw.explanation,
    licenses: ['B'],
  }
}

function mapUnderstandingQuestion(
  raw: {
    q: string
    options: string[]
    answer: number
    answer_text: string
    why: string
  },
  topic: string,
  index: number,
): ExamQuestion {
  return {
    id: `und-${index}`,
    category: topic,
    question: raw.q,
    options: raw.options,
    correct: raw.answer,
    why: raw.why,
    licenses: ['ALL'],
  }
}

function mapByLicenseQuestion(
  raw: {
    id: string
    licenses: string[]
    q: string
    options: string[]
    answer: number
    answer_text: string
    why: string
  },
  section: string,
): ExamQuestion {
  return {
    id: raw.id,
    category: section,
    question: raw.q,
    options: raw.options,
    correct: raw.answer,
    why: raw.why,
    licenses: raw.licenses,
  }
}

async function loadAllQuestions(): Promise<void> {
  if (seedQuestions && understandingQuestions && byLicenseQuestions) return

  const [seedMod, undMod, byLicMod] = await Promise.all([
    import('../../content/questions/seed-automovil-40.json'),
    import('../../content/questions/understanding-78.json'),
    import('../../content/questions/by-license.json'),
  ])

  const seedData = seedMod.default ?? seedMod
  seedQuestions = seedData.questions.map(mapSeedQuestion)

  const undData = undMod.default ?? undMod
  understandingQuestions = []
  let idx = 0
  for (const topic of undData.topics) {
    for (const q of topic.questions) {
      understandingQuestions.push(mapUnderstandingQuestion(q, topic.topic, idx++))
    }
  }

  const byLicData = byLicMod.default ?? byLicMod
  byLicenseQuestions = []
  for (const section of byLicData.sections) {
    for (const q of section.questions) {
      byLicenseQuestions.push(mapByLicenseQuestion(q, section.section))
    }
  }
}

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Try to generate fresh questions via on-device LLM (MediaPipe + Gemma).
 * Returns null if LLM is unavailable or WebGPU not supported.
 */
async function tryLlmQuestions(
  config: ExamConfig,
  weakTopics: string[],
): Promise<ExamQuestion[] | null> {
  try {
    const categories = weakTopics.length > 0 ? weakTopics : ['General']
    const context = await loadManualContext(config.licenseType, categories)

    const questions = await generateQuestions({
      licenseType: config.licenseType,
      categories,
      count: Math.min(config.questionCount, 10),
      difficulty: 'medium',
      context: context || undefined,
    })

    return questions.length > 0 ? questions : null
  } catch {
    return null
  }
}

/**
 * Select questions for an exam session.
 * Tries LLM-generated questions first (~15), fills remainder from seed banks.
 * Falls back entirely to seed banks if LLM unavailable.
 */
export async function selectQuestions(
  config: ExamConfig,
  weakTopics: string[] = [],
  weakFocused: boolean = false,
): Promise<ExamQuestion[]> {
  await loadAllQuestions()

  // Only use LLM for longer sessions (10+ questions) — skip for quick/micro modes
  const llmQuestions = config.questionCount >= 10
    ? await tryLlmQuestions(config, weakTopics)
    : null
  const llmCount = llmQuestions?.length ?? 0
  const seedCount = config.questionCount - llmCount

  const all = [
    ...(seedQuestions ?? []),
    ...(understandingQuestions ?? []),
    ...(byLicenseQuestions ?? []),
  ]

  // Filter by license type
  const forLicense = all.filter(
    (q) =>
      q.licenses.includes('ALL') ||
      q.licenses.includes(config.licenseType) ||
      q.licenses.includes(`${config.licenseType}+A`),
  )

  // Deduplicate by question text (some overlap between banks)
  const seen = new Set<string>()
  const unique: ExamQuestion[] = []
  for (const q of forLicense) {
    const key = q.question.slice(0, 60)
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(q)
    }
  }

  // Prioritize weak topics
  const weak = unique.filter((q) =>
    weakTopics.some((t) => q.category.toLowerCase().includes(t.toLowerCase())),
  )
  const rest = unique.filter(
    (q) => !weakTopics.some((t) => q.category.toLowerCase().includes(t.toLowerCase())),
  )

  // weakFocused: 100% from weak topics (micro-quiz), otherwise 30%
  const weakRatio = weakFocused ? 1.0 : 0.3
  const weakCount = Math.min(Math.floor(seedCount * weakRatio), weak.length)
  const restCount = seedCount - weakCount

  const seedSelected = [...shuffle(weak).slice(0, weakCount), ...shuffle(rest).slice(0, restCount)]

  // Merge LLM + seed, shuffle final mix
  const combined = [...(llmQuestions ?? []), ...seedSelected]

  // Shuffle option order for seed questions to prevent answer memorization
  const withShuffledOptions = combined.map((q) => {
    if (q.id.startsWith('llm-')) return q // LLM questions are already unique
    const indices = q.options.map((_, i) => i)
    const shuffledIndices = shuffle(indices)
    return {
      ...q,
      options: shuffledIndices.map((i) => q.options[i]),
      correct: shuffledIndices.indexOf(q.correct),
    }
  })

  return shuffle(withShuffledOptions).slice(0, config.questionCount)
}

export function getDefaultConfig(): ExamConfig {
  return {
    questionCount: 40,
    timeLimitMinutes: 40,
    passThreshold: 0.8,
    maxRetries: 0, // unlimited per day
    cooldownHours: 24,
    licenseType: 'B',
  }
}
