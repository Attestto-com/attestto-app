/**
 * useSpacedRepetition — SM-2 algorithm for per-question scheduling.
 *
 * Tracks individual question performance and calculates optimal
 * review intervals using the SuperMemo SM-2 algorithm.
 *
 * SM-2 formula:
 *   EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 *   where q = quality of response (0-5), EF = ease factor (min 1.3)
 *
 * Intervals:
 *   rep 1 → 1 day
 *   rep 2 → 6 days
 *   rep n → prev_interval * EF
 *
 * If quality < 3 → reset repetitions to 0 (relearn)
 */

const STORAGE_KEY = 'cr-driving:sm2'

export interface QuestionSM2 {
  questionId: string
  repetitions: number
  easeFactor: number
  intervalDays: number
  nextReviewDate: string // ISO date
  lastReviewDate: string // ISO date
  quality: number // last quality rating (0-5)
}

type SM2Store = Record<string, QuestionSM2>

function load(): SM2Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function save(store: SM2Store): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

/**
 * Map a boolean correct/incorrect to SM-2 quality (0-5).
 * correct = 4 (correct with some effort)
 * incorrect = 1 (remembered incorrectly)
 */
function qualityFromAnswer(correct: boolean): number {
  return correct ? 4 : 1
}

/**
 * Record an answer and update SM-2 state for that question.
 */
export function recordAnswer(questionId: string, correct: boolean): QuestionSM2 {
  const store = load()
  const quality = qualityFromAnswer(correct)
  const today = new Date().toISOString().slice(0, 10)

  const existing = store[questionId] ?? {
    questionId,
    repetitions: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    nextReviewDate: today,
    lastReviewDate: '',
    quality: 0,
  }

  // SM-2 algorithm
  if (quality >= 3) {
    // Correct: advance interval
    if (existing.repetitions === 0) {
      existing.intervalDays = 1
    } else if (existing.repetitions === 1) {
      existing.intervalDays = 6
    } else {
      existing.intervalDays = Math.round(existing.intervalDays * existing.easeFactor)
    }
    existing.repetitions++
  } else {
    // Incorrect: reset to relearn
    existing.repetitions = 0
    existing.intervalDays = 1
  }

  // Update ease factor (min 1.3)
  existing.easeFactor = Math.max(
    1.3,
    existing.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  )

  existing.quality = quality
  existing.lastReviewDate = today

  // Calculate next review date
  const next = new Date()
  next.setDate(next.getDate() + existing.intervalDays)
  existing.nextReviewDate = next.toISOString().slice(0, 10)

  store[questionId] = existing
  save(store)

  return existing
}

/**
 * Get questions that are due for review (nextReviewDate <= today).
 */
export function getDueQuestions(): QuestionSM2[] {
  const store = load()
  const today = new Date().toISOString().slice(0, 10)

  return Object.values(store)
    .filter((q) => q.nextReviewDate <= today)
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate))
}

/**
 * Get count of questions due for review.
 */
export function getDueCount(): number {
  return getDueQuestions().length
}

/**
 * Get the next review date across all tracked questions.
 * Returns null if no questions are tracked.
 */
export function getNextReviewDate(): string | null {
  const store = load()
  const dates = Object.values(store).map((q) => q.nextReviewDate)
  if (!dates.length) return null
  return dates.sort()[0]
}

/**
 * Check if a specific question has been seen before.
 */
export function hasBeenSeen(questionId: string): boolean {
  const store = load()
  return questionId in store
}

/**
 * Get SM-2 state for a specific question.
 */
export function getQuestionState(questionId: string): QuestionSM2 | null {
  const store = load()
  return store[questionId] ?? null
}

/**
 * Get all tracked question IDs sorted by priority (due first, then by ease factor ascending).
 */
export function getPriorityQuestionIds(): string[] {
  const store = load()
  const today = new Date().toISOString().slice(0, 10)

  return Object.values(store)
    .sort((a, b) => {
      // Due questions first
      const aDue = a.nextReviewDate <= today ? 0 : 1
      const bDue = b.nextReviewDate <= today ? 0 : 1
      if (aDue !== bDue) return aDue - bDue
      // Then by ease factor (harder questions first)
      return a.easeFactor - b.easeFactor
    })
    .map((q) => q.questionId)
}
