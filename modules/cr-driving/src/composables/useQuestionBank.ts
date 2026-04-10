import type { ExamQuestion, ExamConfig } from '../types'

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
 * Select questions for an exam session.
 * Prioritizes weak categories, then fills with shuffled pool.
 */
export async function selectQuestions(
  config: ExamConfig,
  weakTopics: string[] = [],
): Promise<ExamQuestion[]> {
  await loadAllQuestions()

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

  // Take ~30% from weak topics, rest random
  const weakCount = Math.min(Math.floor(config.questionCount * 0.3), weak.length)
  const restCount = config.questionCount - weakCount

  const selected = [...shuffle(weak).slice(0, weakCount), ...shuffle(rest).slice(0, restCount)]

  return shuffle(selected).slice(0, config.questionCount)
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
