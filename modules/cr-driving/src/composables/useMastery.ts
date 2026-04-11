import { ref, computed } from 'vue'
import type { MasteryState, CategoryScore, ExamResult } from '../types'
import { mapToMacroCategory, MACRO_CATEGORIES, MIN_QUESTIONS_PER_CATEGORY } from './useCategoryMap'

const STORAGE_KEY = 'cr-driving:mastery'
const GREEN_THRESHOLD = 90 // percent — all categories must reach this for VC issuance

/**
 * Decay rate per month based on renewal count.
 * First-timers forget faster. Experienced drivers retain longer.
 */
const DECAY_RATES: Record<number, number> = {
  0: 10, // first-timer: -10%/month
  1: 5,  // 1st renewal: -5%/month
}
const DEFAULT_DECAY = 2 // 2nd+ renewal: -2%/month

/** Current content version — bump when law changes are merged */
export const CONTENT_VERSION = '2026-04-10'

const mastery = ref<MasteryState>(loadAndDecay())

function loadMastery(): MasteryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    totalAttempts: 0,
    lastScore: 0,
    lastAttemptDate: '',
    streak: 0,
    categoryScores: {},
    weakTopics: [],
    renewalCount: 0,
    allGreen: false,
    pendingLawChanges: [],
  }
}

/**
 * Load mastery and apply time-based decay + law change resets.
 * Called once on composable init (app open).
 */
function loadAndDecay(): MasteryState {
  const m = loadMastery()
  const now = Date.now()
  const decayRate = DECAY_RATES[m.renewalCount] ?? DEFAULT_DECAY
  const decayPerMs = decayRate / (30 * 24 * 60 * 60 * 1000) // per millisecond

  // Apply decay to each category
  for (const [cat, score] of Object.entries(m.categoryScores)) {
    if (!score.lastPracticed) continue

    const lastPracticed = new Date(score.lastPracticed).getTime()
    const elapsedMs = now - lastPracticed
    if (elapsedMs <= 0) continue

    const decayPercent = elapsedMs * decayPerMs
    const currentPct = score.total > 0 ? (score.correct / score.total) * 100 : 0
    const decayedPct = Math.max(0, currentPct - decayPercent)

    // Adjust correct count to reflect decayed percentage
    if (score.total > 0) {
      score.correct = Math.round((decayedPct / 100) * score.total)
    }

    // Check for law change: if content version doesn't match, reset to 0
    if (score.contentVersion && score.contentVersion !== CONTENT_VERSION) {
      score.correct = 0
      score.total = 0
      if (!m.pendingLawChanges.includes(cat)) {
        m.pendingLawChanges.push(cat)
      }
    }
  }

  // Recalculate weak topics and allGreen
  recalculate(m)
  saveMastery(m)
  return m
}

function recalculate(m: MasteryState): void {
  // Build status for all 9 macro-categories
  const categorized = MACRO_CATEGORIES.map((cat) => {
    const s = m.categoryScores[cat]
    const total = s?.total ?? 0
    const correct = s?.correct ?? 0
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    const minReached = total >= MIN_QUESTIONS_PER_CATEGORY
    return { cat, pct, total, minReached }
  })

  m.weakTopics = categorized
    .filter((c) => !c.minReached || c.pct < GREEN_THRESHOLD)
    .sort((a, b) => a.pct - b.pct)
    .map((c) => c.cat)

  // allGreen requires ALL 9 macro-categories with min questions AND >= 90%
  m.allGreen = categorized.every((c) => c.minReached && c.pct >= GREEN_THRESHOLD)
}

function saveMastery(m?: MasteryState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m ?? mastery.value))
}

export function useMastery() {
  const allGreen = computed(() => mastery.value.allGreen)
  const pendingLawChanges = computed(() => mastery.value.pendingLawChanges)
  const canIssueVC = computed(() => mastery.value.allGreen && mastery.value.pendingLawChanges.length === 0)

  function updateFromResult(result: ExamResult): void {
    const m = mastery.value
    const today = new Date().toISOString().slice(0, 10)

    m.totalAttempts++
    m.lastScore = result.score

    // Streak
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
    if (m.lastAttemptDate === yesterday || m.lastAttemptDate === today) {
      m.streak++
    } else if (m.lastAttemptDate !== today) {
      m.streak = 1
    }
    m.lastAttemptDate = today

    // Update category scores (mapped to macro-categories)
    for (const cat of result.categoryBreakdown) {
      const macroName = mapToMacroCategory(cat.category)
      const existing = m.categoryScores[macroName] ?? {
        correct: 0,
        total: 0,
        lastPracticed: '',
        contentVersion: CONTENT_VERSION,
      }
      existing.correct += cat.correct
      existing.total += cat.total
      existing.lastPracticed = new Date().toISOString()
      existing.contentVersion = CONTENT_VERSION
      m.categoryScores[macroName] = existing

      // Clear pending law change if user practiced this category
      const idx = m.pendingLawChanges.indexOf(macroName)
      if (idx >= 0) m.pendingLawChanges.splice(idx, 1)
    }

    recalculate(m)
    saveMastery()
  }

  function canRetry(): boolean {
    if (!mastery.value.lastAttemptDate) return true
    const last = new Date(mastery.value.lastAttemptDate).getTime()
    const cooldown = 24 * 60 * 60 * 1000
    return Date.now() - last >= cooldown
  }

  function getTopCategories(limit = 3): { category: string; percent: number }[] {
    return Object.entries(mastery.value.categoryScores)
      .map(([category, { correct, total }]) => ({
        category,
        percent: total > 0 ? Math.round((correct / total) * 100) : 0,
      }))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, limit)
  }

  function getAllCategories(): { category: string; percent: number; isGreen: boolean; total: number; correct: number }[] {
    return MACRO_CATEGORIES.map((category) => {
      const s = mastery.value.categoryScores[category]
      const correct = s?.correct ?? 0
      const total = s?.total ?? 0
      const percent = total > 0 ? Math.round((correct / total) * 100) : 0
      const minReached = total >= MIN_QUESTIONS_PER_CATEGORY
      return { category, percent, isGreen: minReached && percent >= GREEN_THRESHOLD, total, correct }
    }).sort((a, b) => a.percent - b.percent)
  }

  function getCategoryProgress(): { category: string; correct: number; total: number; percent: number; minReached: boolean; unlocked: boolean }[] {
    return MACRO_CATEGORIES.map((category) => {
      const s = mastery.value.categoryScores[category]
      const correct = s?.correct ?? 0
      const total = s?.total ?? 0
      const percent = total > 0 ? Math.round((correct / total) * 100) : 0
      const minReached = total >= MIN_QUESTIONS_PER_CATEGORY
      return { category, correct, total, percent, minReached, unlocked: minReached && percent >= GREEN_THRESHOLD }
    })
  }

  const unlockedCount = computed(() =>
    MACRO_CATEGORIES.filter((cat) => {
      const s = mastery.value.categoryScores[cat]
      if (!s || s.total < MIN_QUESTIONS_PER_CATEGORY) return false
      return Math.round((s.correct / s.total) * 100) >= GREEN_THRESHOLD
    }).length,
  )

  function getCategoryGap(): { category: string; percent: number; gap: number; isGreen: boolean }[] {
    return Object.entries(mastery.value.categoryScores)
      .map(([category, { correct, total }]) => {
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0
        const gap = Math.max(0, GREEN_THRESHOLD - percent)
        return { category, percent, gap, isGreen: percent >= GREEN_THRESHOLD }
      })
      .sort((a, b) => b.gap - a.gap)
  }

  function getBelowThresholdCategories(): string[] {
    return MACRO_CATEGORIES.filter((cat) => {
      const s = mastery.value.categoryScores[cat]
      if (!s || s.total < MIN_QUESTIONS_PER_CATEGORY) return true
      return Math.round((s.correct / s.total) * 100) < GREEN_THRESHOLD
    })
  }

  function getOverallAccuracy(): number {
    const entries = Object.values(mastery.value.categoryScores)
    if (!entries.length) return 0
    const totalCorrect = entries.reduce((s, e) => s + e.correct, 0)
    const totalQ = entries.reduce((s, e) => s + e.total, 0)
    return totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0
  }

  function getDecayRate(): number {
    return DECAY_RATES[mastery.value.renewalCount] ?? DEFAULT_DECAY
  }

  /** Acknowledge a law change for a category (user has been notified) */
  function acknowledgeLawChange(category: string): void {
    const idx = mastery.value.pendingLawChanges.indexOf(category)
    if (idx >= 0) mastery.value.pendingLawChanges.splice(idx, 1)
    saveMastery()
  }

  return {
    mastery,
    allGreen,
    pendingLawChanges,
    canIssueVC,
    updateFromResult,
    canRetry,
    getTopCategories,
    getAllCategories,
    getCategoryProgress,
    getCategoryGap,
    getBelowThresholdCategories,
    getOverallAccuracy,
    unlockedCount,
    getDecayRate,
    acknowledgeLawChange,
  }
}
