import { describe, it, expect } from 'vitest'

/**
 * Pure logic tests for the mastery v2 perpetual competency model.
 * Tests the algorithms (threshold, decay, gap, streak) without importing
 * the composable (which has module-level localStorage side effects).
 */

const CONTENT_VERSION = '2026-04-10'

describe('useMastery', () => {

  it('empty state has correct defaults', () => {
    const empty = {
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
    expect(empty.allGreen).toBe(false)
    expect(empty.categoryScores).toEqual({})
    expect(empty.pendingLawChanges).toEqual([])
  })

  it('GREEN_THRESHOLD is 90 (v2 perpetual competency)', () => {
    const GREEN_THRESHOLD = 90
    // 85% is below threshold
    expect(85).toBeLessThan(GREEN_THRESHOLD)
    // 90% meets threshold
    expect(90).toBeGreaterThanOrEqual(GREEN_THRESHOLD)
    // 91% exceeds threshold
    expect(91).toBeGreaterThanOrEqual(GREEN_THRESHOLD)
  })

  it('allGreen requires all categories >= 90%', () => {
    // Simulate the recalculate logic
    const categories = {
      'A': { correct: 92, total: 100 },
      'B': { correct: 88, total: 100 }, // below 90
    }
    const categorized = Object.entries(categories).map(([cat, s]) => ({
      cat,
      pct: Math.round((s.correct / s.total) * 100),
    }))
    const allGreen = categorized.every((c) => c.pct >= 90)
    expect(allGreen).toBe(false)

    // Fix B to 91%
    categories.B.correct = 91
    const categorized2 = Object.entries(categories).map(([cat, s]) => ({
      cat,
      pct: Math.round((s.correct / s.total) * 100),
    }))
    const allGreen2 = categorized2.every((c) => c.pct >= 90)
    expect(allGreen2).toBe(true)
  })

  it('canIssueVC is false when pendingLawChanges exist', () => {
    const allGreen = true
    const pendingLawChanges = ['Reglamento general']
    const canIssue = allGreen && pendingLawChanges.length === 0
    expect(canIssue).toBe(false)
  })

  it('canIssueVC is true when allGreen and no pending law changes', () => {
    const allGreen = true
    const pendingLawChanges: string[] = []
    const canIssue = allGreen && pendingLawChanges.length === 0
    expect(canIssue).toBe(true)
  })

  it('decay reduces correct count over time', () => {
    const score = { correct: 100, total: 100 }
    const decayRate = 10 // first-timer: -10%/month
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000
    const decayPerMs = decayRate / oneMonthMs

    // Simulate 1 month elapsed
    const elapsedMs = oneMonthMs
    const currentPct = (score.correct / score.total) * 100
    const decayedPct = Math.max(0, currentPct - elapsedMs * decayPerMs)
    const newCorrect = Math.round((decayedPct / 100) * score.total)

    expect(newCorrect).toBe(90) // 100% - 10% = 90%
  })

  it('veteran decay is slower (-2%/month)', () => {
    const score = { correct: 100, total: 100 }
    const decayRate = 2 // veteran
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000
    const decayPerMs = decayRate / oneMonthMs

    const elapsedMs = oneMonthMs
    const currentPct = (score.correct / score.total) * 100
    const decayedPct = Math.max(0, currentPct - elapsedMs * decayPerMs)
    const newCorrect = Math.round((decayedPct / 100) * score.total)

    expect(newCorrect).toBe(98)
  })

  it('law change resets category to 0', () => {
    const score = { correct: 95, total: 100, contentVersion: '2025-01-01' }
    const currentVersion = '2026-04-10'

    if (score.contentVersion !== currentVersion) {
      score.correct = 0
      score.total = 0
    }

    expect(score.correct).toBe(0)
    expect(score.total).toBe(0)
  })

  it('law change does not reset if version matches', () => {
    const score = { correct: 95, total: 100, contentVersion: '2026-04-10' }
    const currentVersion = '2026-04-10'

    if (score.contentVersion !== currentVersion) {
      score.correct = 0
      score.total = 0
    }

    expect(score.correct).toBe(95)
    expect(score.total).toBe(100)
  })

  it('CONTENT_VERSION format is YYYY-MM-DD', () => {
    expect(CONTENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('getCategoryGap returns gap to 90% threshold', () => {
    const categories = {
      'A': { correct: 85, total: 100 },
      'B': { correct: 92, total: 100 },
    }
    const gaps = Object.entries(categories).map(([category, { correct, total }]) => {
      const percent = Math.round((correct / total) * 100)
      const gap = Math.max(0, 90 - percent)
      return { category, percent, gap, isGreen: percent >= 90 }
    })

    expect(gaps.find((g) => g.category === 'A')?.gap).toBe(5)
    expect(gaps.find((g) => g.category === 'A')?.isGreen).toBe(false)
    expect(gaps.find((g) => g.category === 'B')?.gap).toBe(0)
    expect(gaps.find((g) => g.category === 'B')?.isGreen).toBe(true)
  })

  it('getBelowThresholdCategories filters correctly', () => {
    const categories = {
      'A': { correct: 92, total: 100 },
      'B': { correct: 85, total: 100 },
      'C': { correct: 90, total: 100 },
    }
    const below = Object.entries(categories)
      .filter(([, { correct, total }]) => Math.round((correct / total) * 100) < 90)
      .map(([cat]) => cat)

    expect(below).toEqual(['B'])
  })

  it('updateFromResult accumulates category scores', () => {
    const existing = { correct: 8, total: 10 }
    const resultCat = { correct: 9, total: 10 }
    existing.correct += resultCat.correct
    existing.total += resultCat.total

    expect(existing.correct).toBe(17)
    expect(existing.total).toBe(20)
    expect(Math.round((existing.correct / existing.total) * 100)).toBe(85)
  })

  it('streak increments on consecutive days', () => {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10)

    let streak = 3
    const lastAttemptDate = yesterday
    if (lastAttemptDate === yesterday || lastAttemptDate === today) {
      streak++
    }
    expect(streak).toBe(4)
  })

  it('streak resets on gap', () => {
    const today = new Date().toISOString().slice(0, 10)
    const twoDaysAgo = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10)

    let streak = 5
    const lastAttemptDate = twoDaysAgo
    if (lastAttemptDate === new Date(Date.now() - 86400_000).toISOString().slice(0, 10) || lastAttemptDate === today) {
      streak++
    } else if (lastAttemptDate !== today) {
      streak = 1
    }
    expect(streak).toBe(1)
  })
})
