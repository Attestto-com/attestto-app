/**
 * Integration tests for useMastery composable.
 * Exercises the actual composable against a polyfilled localStorage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ExamResult } from '../../modules/cr-driving/src/types'
import { MACRO_CATEGORIES, MIN_QUESTIONS_PER_CATEGORY } from '../../modules/cr-driving/src/composables/useCategoryMap'

// Polyfill localStorage before useMastery module init runs.
// vi.hoisted runs before all imports, ensuring localStorage is available
// when the composable's module-level loadAndDecay() executes.
const { _store } = vi.hoisted(() => {
  const _store = new Map<string, string>()
  const _localStorage = {
    getItem: (key: string) => _store.get(key) ?? null,
    setItem: (key: string, value: string) => { _store.set(key, value) },
    removeItem: (key: string) => { _store.delete(key) },
    clear: () => { _store.clear() },
    get length() { return _store.size },
    key: (i: number) => [..._store.keys()][i] ?? null,
  }
  ;(globalThis as any).localStorage = _localStorage
  return { _store }
})

import { useMastery, CONTENT_VERSION } from '../../modules/cr-driving/src/composables/useMastery'

function freshMastery() {
  _store.clear()
  const m = useMastery()
  // Reset to clean state
  m.mastery.value = {
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
  return m
}

function makeResult(overrides: Partial<ExamResult> = {}): ExamResult {
  return {
    passed: true,
    score: 90,
    correct: 9,
    wrong: 1,
    total: 10,
    durationSeconds: 300,
    categoryBreakdown: [
      { category: 'Leyes y reglamento', correct: 9, total: 10, percent: 90 },
    ],
    weakTopics: [],
    chainHead: '0'.repeat(64),
    incidents: [],
    ...overrides,
  }
}

describe('useMastery integration', () => {
  beforeEach(() => {
    _store.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with empty state', () => {
    const m = freshMastery()
    expect(m.allGreen.value).toBe(false)
    expect(m.canIssueVC.value).toBe(false)
    expect(m.pendingLawChanges.value).toEqual([])
    expect(m.unlockedCount.value).toBe(0)
  })

  it('updateFromResult accumulates category scores', () => {
    const m = freshMastery()
    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: 'Leyes y reglamento', correct: 8, total: 10, percent: 80 },
      ],
    }))

    const cats = m.getCategoryProgress()
    const leyes = cats.find((c) => c.category === 'Leyes y reglamento')!
    expect(leyes.correct).toBe(8)
    expect(leyes.total).toBe(10)
    expect(leyes.percent).toBe(80)
  })

  it('updateFromResult accumulates across multiple calls', () => {
    const m = freshMastery()

    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: 'Leyes y reglamento', correct: 8, total: 10, percent: 80 },
      ],
    }))
    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: 'Leyes y reglamento', correct: 10, total: 10, percent: 100 },
      ],
    }))

    const cats = m.getCategoryProgress()
    const leyes = cats.find((c) => c.category === 'Leyes y reglamento')!
    expect(leyes.correct).toBe(18)
    expect(leyes.total).toBe(20)
    expect(leyes.percent).toBe(90)
  })

  it('updateFromResult increments totalAttempts', () => {
    const m = freshMastery()
    m.updateFromResult(makeResult())
    m.updateFromResult(makeResult())
    expect(m.mastery.value.totalAttempts).toBe(2)
  })

  it('updateFromResult updates lastScore', () => {
    const m = freshMastery()
    m.updateFromResult(makeResult({ score: 85 }))
    expect(m.mastery.value.lastScore).toBe(85)
    m.updateFromResult(makeResult({ score: 95 }))
    expect(m.mastery.value.lastScore).toBe(95)
  })

  it('streak increments on consecutive days', () => {
    const m = freshMastery()

    vi.setSystemTime(new Date('2026-04-10T10:00:00Z'))
    m.updateFromResult(makeResult())
    expect(m.mastery.value.streak).toBe(1)

    vi.setSystemTime(new Date('2026-04-11T10:00:00Z'))
    m.updateFromResult(makeResult())
    expect(m.mastery.value.streak).toBe(2)

    vi.setSystemTime(new Date('2026-04-12T10:00:00Z'))
    m.updateFromResult(makeResult())
    expect(m.mastery.value.streak).toBe(3)
  })

  it('streak resets on gap > 1 day', () => {
    const m = freshMastery()

    vi.setSystemTime(new Date('2026-04-10T10:00:00Z'))
    m.updateFromResult(makeResult())
    expect(m.mastery.value.streak).toBe(1)

    vi.setSystemTime(new Date('2026-04-12T10:00:00Z'))
    m.updateFromResult(makeResult())
    expect(m.mastery.value.streak).toBe(1) // reset
  })

  it('streak stays same on same day', () => {
    const m = freshMastery()

    vi.setSystemTime(new Date('2026-04-10T10:00:00Z'))
    m.updateFromResult(makeResult())
    expect(m.mastery.value.streak).toBe(1)

    vi.setSystemTime(new Date('2026-04-10T18:00:00Z'))
    m.updateFromResult(makeResult())
    expect(m.mastery.value.streak).toBe(2)
  })

  it('allGreen requires all 9 categories at min questions AND 90%+', () => {
    const m = freshMastery()
    const now = new Date().toISOString()

    // Fill 8 of 9 categories directly (bypass mapToMacroCategory)
    for (let i = 0; i < 8; i++) {
      m.mastery.value.categoryScores[MACRO_CATEGORIES[i]] = {
        correct: 10, total: 10, lastPracticed: now, contentVersion: CONTENT_VERSION,
      }
    }
    // Trigger recalculate via updateFromResult on a mapped category
    m.updateFromResult(makeResult({ categoryBreakdown: [] }))
    expect(m.allGreen.value).toBe(false) // missing 9th

    // Add 9th but below minimum
    m.mastery.value.categoryScores[MACRO_CATEGORIES[8]] = {
      correct: 5, total: 5, lastPracticed: now, contentVersion: CONTENT_VERSION,
    }
    m.updateFromResult(makeResult({ categoryBreakdown: [] }))
    expect(m.allGreen.value).toBe(false) // only 5 questions, need 10

    // Bring 9th to minimum
    m.mastery.value.categoryScores[MACRO_CATEGORIES[8]] = {
      correct: 10, total: 10, lastPracticed: now, contentVersion: CONTENT_VERSION,
    }
    m.updateFromResult(makeResult({ categoryBreakdown: [] }))
    expect(m.allGreen.value).toBe(true) // now 10/10 at 100%
  })

  it('allGreen is false when a category is below 90%', () => {
    const m = freshMastery()
    const now = new Date().toISOString()

    // Fill all 9 at 100%
    for (const cat of MACRO_CATEGORIES) {
      m.mastery.value.categoryScores[cat] = {
        correct: 10, total: 10, lastPracticed: now, contentVersion: CONTENT_VERSION,
      }
    }
    m.updateFromResult(makeResult({ categoryBreakdown: [] }))
    expect(m.allGreen.value).toBe(true)

    // Drop one below 90%
    m.mastery.value.categoryScores[MACRO_CATEGORIES[0]].correct = 5
    m.updateFromResult(makeResult({ categoryBreakdown: [] }))
    expect(m.allGreen.value).toBe(false) // 5/10 = 50%
  })

  it('canIssueVC is true only when allGreen and no pending law changes', () => {
    const m = freshMastery()
    const now = new Date().toISOString()

    // Fill all 9 at 100%
    for (const cat of MACRO_CATEGORIES) {
      m.mastery.value.categoryScores[cat] = {
        correct: 10, total: 10, lastPracticed: now, contentVersion: CONTENT_VERSION,
      }
    }
    m.updateFromResult(makeResult({ categoryBreakdown: [] }))
    expect(m.canIssueVC.value).toBe(true)

    m.mastery.value.pendingLawChanges.push('Leyes y reglamento')
    expect(m.canIssueVC.value).toBe(false)
  })

  it('unlockedCount tracks categories meeting min + 90%', () => {
    const m = freshMastery()
    expect(m.unlockedCount.value).toBe(0)

    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: MACRO_CATEGORIES[0], correct: 10, total: 10, percent: 100 },
      ],
    }))
    expect(m.unlockedCount.value).toBe(1)

    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: MACRO_CATEGORIES[1], correct: 10, total: 10, percent: 100 },
      ],
    }))
    expect(m.unlockedCount.value).toBe(2)
  })

  it('getTopCategories returns top N by percent descending', () => {
    const m = freshMastery()
    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: 'Leyes y reglamento', correct: 5, total: 10, percent: 50 },
        { category: 'Señales y semáforos', correct: 9, total: 10, percent: 90 },
        { category: 'Velocidad y frenado', correct: 7, total: 10, percent: 70 },
      ],
    }))

    const top = m.getTopCategories(2)
    expect(top).toHaveLength(2)
    expect(top[0].category).toBe('Señales y semáforos')
    expect(top[0].percent).toBe(90)
    expect(top[1].category).toBe('Velocidad y frenado')
  })

  it('getAllCategories returns all 9 macro-categories sorted by percent', () => {
    const m = freshMastery()
    const all = m.getAllCategories()
    expect(all).toHaveLength(9)
    expect(all.every((c) => c.percent === 0)).toBe(true)
    expect(all.every((c) => c.isGreen === false)).toBe(true)
  })

  it('getCategoryProgress returns all 9 with progress info', () => {
    const m = freshMastery()
    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: 'Leyes y reglamento', correct: 8, total: 10, percent: 80 },
      ],
    }))

    const progress = m.getCategoryProgress()
    expect(progress).toHaveLength(9)
    const leyes = progress.find((c) => c.category === 'Leyes y reglamento')!
    expect(leyes.correct).toBe(8)
    expect(leyes.total).toBe(10)
    expect(leyes.minReached).toBe(true)
    expect(leyes.unlocked).toBe(false) // 80% < 90%
  })

  it('getCategoryGap calculates gap to 90% threshold', () => {
    const m = freshMastery()
    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: 'Leyes y reglamento', correct: 8, total: 10, percent: 80 },
        { category: 'Señales y semáforos', correct: 10, total: 10, percent: 100 },
      ],
    }))

    const gaps = m.getCategoryGap()
    const leyes = gaps.find((g) => g.category === 'Leyes y reglamento')!
    expect(leyes.gap).toBe(10) // 90 - 80
    expect(leyes.isGreen).toBe(false)

    const senales = gaps.find((g) => g.category === 'Señales y semáforos')!
    expect(senales.gap).toBe(0)
    expect(senales.isGreen).toBe(true)
  })

  it('getBelowThresholdCategories returns categories below 90% or under min', () => {
    const m = freshMastery()
    const below = m.getBelowThresholdCategories()
    expect(below).toHaveLength(9) // all below since fresh

    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: MACRO_CATEGORIES[0], correct: 10, total: 10, percent: 100 },
      ],
    }))
    expect(m.getBelowThresholdCategories()).toHaveLength(8)
  })

  it('getOverallAccuracy aggregates across all categories', () => {
    const m = freshMastery()
    expect(m.getOverallAccuracy()).toBe(0)

    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: 'Leyes y reglamento', correct: 8, total: 10, percent: 80 },
        { category: 'Señales y semáforos', correct: 10, total: 10, percent: 100 },
      ],
    }))
    expect(m.getOverallAccuracy()).toBe(90)
  })

  it('getDecayRate returns rate based on renewalCount', () => {
    const m = freshMastery()
    expect(m.getDecayRate()).toBe(10) // first-timer

    m.mastery.value.renewalCount = 1
    expect(m.getDecayRate()).toBe(5) // 1st renewal

    m.mastery.value.renewalCount = 2
    expect(m.getDecayRate()).toBe(2) // veteran

    m.mastery.value.renewalCount = 5
    expect(m.getDecayRate()).toBe(2) // still veteran
  })

  it('acknowledgeLawChange removes from pending list', () => {
    const m = freshMastery()
    m.mastery.value.pendingLawChanges = ['Leyes y reglamento', 'Señales y semáforos']

    m.acknowledgeLawChange('Leyes y reglamento')
    expect(m.mastery.value.pendingLawChanges).toEqual(['Señales y semáforos'])

    m.acknowledgeLawChange('Señales y semáforos')
    expect(m.mastery.value.pendingLawChanges).toEqual([])
  })

  it('acknowledgeLawChange is noop for non-existent category', () => {
    const m = freshMastery()
    m.mastery.value.pendingLawChanges = ['Leyes y reglamento']
    m.acknowledgeLawChange('Nonexistent')
    expect(m.mastery.value.pendingLawChanges).toEqual(['Leyes y reglamento'])
  })

  it('updateFromResult clears pending law change when category practiced', () => {
    const m = freshMastery()
    m.mastery.value.pendingLawChanges = ['Leyes y reglamento']

    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: 'Leyes y reglamento', correct: 10, total: 10, percent: 100 },
      ],
    }))
    expect(m.mastery.value.pendingLawChanges).not.toContain('Leyes y reglamento')
  })

  it('CONTENT_VERSION is YYYY-MM-DD format', () => {
    expect(CONTENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('MIN_QUESTIONS_PER_CATEGORY is 10', () => {
    expect(MIN_QUESTIONS_PER_CATEGORY).toBe(10)
  })

  it('persists to localStorage on updateFromResult', () => {
    const m = freshMastery()
    m.updateFromResult(makeResult())

    const saved = _store.get('cr-driving:mastery')
    expect(saved).toBeDefined()
    const parsed = JSON.parse(saved!)
    expect(parsed.totalAttempts).toBe(1)
  })

  it('persists to localStorage on acknowledgeLawChange', () => {
    const m = freshMastery()
    m.mastery.value.pendingLawChanges = ['Leyes y reglamento']
    m.acknowledgeLawChange('Leyes y reglamento')

    const saved = _store.get('cr-driving:mastery')
    const parsed = JSON.parse(saved!)
    expect(parsed.pendingLawChanges).toEqual([])
  })

  it('canRetry is true with no prior attempts', () => {
    const m = freshMastery()
    expect(m.canRetry()).toBe(true)
  })

  it('maps raw question categories to macro-categories in updateFromResult', () => {
    const m = freshMastery()

    m.updateFromResult(makeResult({
      categoryBreakdown: [
        { category: 'Velocidad y frenado', correct: 9, total: 10, percent: 90 },
      ],
    }))

    const cats = m.getCategoryProgress()
    const velocidad = cats.find((c) => c.category === 'Velocidad y frenado')!
    expect(velocidad.correct).toBe(9)
    expect(velocidad.total).toBe(10)
  })
})
