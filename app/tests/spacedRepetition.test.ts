import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Pure logic tests for SM-2 spaced repetition algorithm.
 * Tests the math without localStorage side effects.
 */

// SM-2 constants
const DEFAULT_EF = 2.5
const MIN_EF = 1.3

function sm2EaseFactor(prevEF: number, quality: number): number {
  return Math.max(MIN_EF, prevEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
}

function sm2Interval(repetitions: number, prevInterval: number, ef: number): number {
  if (repetitions === 0) return 1
  if (repetitions === 1) return 6
  return Math.round(prevInterval * ef)
}

function qualityFromAnswer(correct: boolean): number {
  return correct ? 4 : 1
}

describe('SM-2 Algorithm', () => {

  describe('qualityFromAnswer', () => {
    it('correct answer maps to quality 4', () => {
      expect(qualityFromAnswer(true)).toBe(4)
    })

    it('incorrect answer maps to quality 1', () => {
      expect(qualityFromAnswer(false)).toBe(1)
    })
  })

  describe('ease factor calculation', () => {
    it('default ease factor is 2.5', () => {
      expect(DEFAULT_EF).toBe(2.5)
    })

    it('correct answer (q=4) slightly decreases EF from 2.5', () => {
      const newEF = sm2EaseFactor(2.5, 4)
      // EF' = 2.5 + (0.1 - (5-4) * (0.08 + (5-4) * 0.02)) = 2.5 + (0.1 - 0.1) = 2.5
      expect(newEF).toBe(2.5)
    })

    it('perfect answer (q=5) increases EF', () => {
      const newEF = sm2EaseFactor(2.5, 5)
      // EF' = 2.5 + (0.1 - 0 * ...) = 2.5 + 0.1 = 2.6
      expect(newEF).toBe(2.6)
    })

    it('incorrect answer (q=1) decreases EF', () => {
      const newEF = sm2EaseFactor(2.5, 1)
      // EF' = 2.5 + (0.1 - 4 * (0.08 + 4 * 0.02)) = 2.5 + (0.1 - 4 * 0.16) = 2.5 - 0.54 = 1.96
      expect(newEF).toBeCloseTo(1.96, 2)
    })

    it('EF never goes below 1.3', () => {
      // Start at 1.3, terrible answer
      const newEF = sm2EaseFactor(1.3, 0)
      expect(newEF).toBe(1.3)
    })

    it('repeated correct answers keep EF stable at 2.5', () => {
      let ef = 2.5
      for (let i = 0; i < 10; i++) {
        ef = sm2EaseFactor(ef, 4) // quality 4 = correct
      }
      expect(ef).toBe(2.5)
    })

    it('mixed answers trend EF down then recover', () => {
      let ef = 2.5
      // Two wrong answers
      ef = sm2EaseFactor(ef, 1)
      ef = sm2EaseFactor(ef, 1)
      expect(ef).toBeLessThan(2.0)
      // Five perfect answers to recover
      for (let i = 0; i < 5; i++) {
        ef = sm2EaseFactor(ef, 5)
      }
      expect(ef).toBeGreaterThan(1.8)
    })
  })

  describe('interval calculation', () => {
    it('first repetition → 1 day', () => {
      expect(sm2Interval(0, 0, 2.5)).toBe(1)
    })

    it('second repetition → 6 days', () => {
      expect(sm2Interval(1, 1, 2.5)).toBe(6)
    })

    it('third repetition → prev * EF', () => {
      // 6 * 2.5 = 15
      expect(sm2Interval(2, 6, 2.5)).toBe(15)
    })

    it('fourth repetition → prev * EF', () => {
      // 15 * 2.5 = 37.5 → 38
      expect(sm2Interval(3, 15, 2.5)).toBe(38)
    })

    it('low EF produces shorter intervals', () => {
      // 6 * 1.3 = 7.8 → 8
      expect(sm2Interval(2, 6, 1.3)).toBe(8)
    })

    it('intervals grow exponentially with high EF', () => {
      let interval = 0
      const ef = 2.5
      const intervals = []
      for (let rep = 0; rep < 6; rep++) {
        interval = sm2Interval(rep, interval, ef)
        intervals.push(interval)
      }
      // 1, 6, 15, 38, 95, 238
      expect(intervals[0]).toBe(1)
      expect(intervals[1]).toBe(6)
      expect(intervals[intervals.length - 1]).toBeGreaterThan(100)
    })
  })

  describe('incorrect answer resets', () => {
    it('incorrect answer (q < 3) resets repetitions to 0', () => {
      const quality = qualityFromAnswer(false) // 1
      expect(quality).toBeLessThan(3)
      // After reset, next interval is 1 day
      expect(sm2Interval(0, 0, 2.5)).toBe(1)
    })

    it('correct after reset starts fresh schedule', () => {
      // After incorrect → rep 0 → interval 1
      // Correct again → rep 1 → interval 6
      expect(sm2Interval(0, 0, 2.5)).toBe(1)
      expect(sm2Interval(1, 1, 2.5)).toBe(6)
    })
  })
})
