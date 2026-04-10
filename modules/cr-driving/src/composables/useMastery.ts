import { ref } from 'vue'
import type { MasteryState, ExamResult } from '../types'

const STORAGE_KEY = 'cr-driving:mastery'

const mastery = ref<MasteryState>(loadMastery())

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
  }
}

function saveMastery(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mastery.value))
}

export function useMastery() {
  function updateFromResult(result: ExamResult): void {
    const m = mastery.value
    m.totalAttempts++
    m.lastScore = result.score

    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10)

    if (m.lastAttemptDate === yesterday || m.lastAttemptDate === today) {
      m.streak++
    } else if (m.lastAttemptDate !== today) {
      m.streak = 1
    }
    m.lastAttemptDate = today

    // Update category scores (cumulative)
    for (const cat of result.categoryBreakdown) {
      const existing = m.categoryScores[cat.category] ?? { correct: 0, total: 0 }
      existing.correct += cat.correct
      existing.total += cat.total
      m.categoryScores[cat.category] = existing
    }

    // Recalculate weak topics
    m.weakTopics = Object.entries(m.categoryScores)
      .map(([cat, { correct, total }]) => ({ cat, pct: Math.round((correct / total) * 100) }))
      .filter((c) => c.pct < 70)
      .sort((a, b) => a.pct - b.pct)
      .map((c) => c.cat)

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
        percent: Math.round((correct / total) * 100),
      }))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, limit)
  }

  function getOverallAccuracy(): number {
    const entries = Object.values(mastery.value.categoryScores)
    if (!entries.length) return 0
    const totalCorrect = entries.reduce((s, e) => s + e.correct, 0)
    const totalQ = entries.reduce((s, e) => s + e.total, 0)
    return totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0
  }

  return {
    mastery,
    updateFromResult,
    canRetry,
    getTopCategories,
    getOverallAccuracy,
  }
}
