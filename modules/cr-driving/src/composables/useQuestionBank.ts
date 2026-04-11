import type { ExamQuestion, ExamConfig } from '../types'
import { generateQuestions, loadManualContext } from './useQuestionGenerator'
import { mapToMacroCategory } from './useCategoryMap'

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

  // Try LLM for any session with 5+ questions when available
  const llmQuestions = config.questionCount >= 5
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

  // Track recently asked questions to avoid repetition within session
  const recentKey = 'cr-driving:recent-questions'
  const recentRaw = sessionStorage.getItem(recentKey)
  const recentIds = new Set<string>(recentRaw ? JSON.parse(recentRaw) : [])

  // Separate into not-recently-asked (preferred) and recently-asked (fallback)
  const fresh = unique.filter((q) => !recentIds.has(q.id))
  const pool = fresh.length >= seedCount ? fresh : unique // fall back to all if too few fresh

  // Sort by category weakness — least mastered categories first
  const weakSet = new Set(weakTopics.map((t) => t.toLowerCase()))
  const scored = pool.map((q) => {
    const catLower = q.category.toLowerCase()
    const isWeak = weakTopics.some((t) => catLower.includes(t.toLowerCase()))
    // Priority: weak topics first, then alphabetical spread
    return { q, priority: isWeak ? 0 : 1 }
  })

  if (weakFocused) {
    // Micro-quiz: take weak first, fill with rest if not enough
    scored.sort((a, b) => a.priority - b.priority)
  } else {
    // Practice: 30% weak, 70% mixed
    scored.sort(() => Math.random() - 0.5)
  }

  const seedSelected = shuffle(scored.map((s) => s.q)).slice(0, seedCount)

  // Record which questions were asked
  const askedIds = seedSelected.map((q) => q.id)
  const updatedRecent = [...recentIds, ...askedIds].slice(-200) // keep last 200
  sessionStorage.setItem(recentKey, JSON.stringify(updatedRecent))

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

  // Map raw categories to macro-categories for mastery tracking
  const withMacroCategories = shuffle(withShuffledOptions)
    .slice(0, config.questionCount)
    .map((q) => ({ ...q, category: mapToMacroCategory(q.category) }))

  return withMacroCategories
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
