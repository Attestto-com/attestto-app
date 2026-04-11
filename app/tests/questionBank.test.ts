import { describe, it, expect } from 'vitest'

describe('Question Bank Logic', () => {
  describe('option shuffling', () => {
    function shuffle<T>(arr: T[]): T[] {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }

    it('shuffled options preserve correct answer mapping', () => {
      const original = {
        options: ['Wrong A', 'Correct', 'Wrong B', 'Wrong C'],
        correct: 1,
      }

      // Simulate option shuffle logic from useQuestionBank
      const indices = original.options.map((_, i) => i)
      const shuffledIndices = shuffle(indices)
      const shuffled = {
        options: shuffledIndices.map((i) => original.options[i]),
        correct: shuffledIndices.indexOf(original.correct),
      }

      // The correct answer text should match
      expect(shuffled.options[shuffled.correct]).toBe('Correct')
    })

    it('shuffle preserves all options', () => {
      const options = ['A', 'B', 'C', 'D']
      const shuffled = shuffle(options)
      expect(shuffled).toHaveLength(4)
      expect(shuffled.sort()).toEqual(['A', 'B', 'C', 'D'])
    })
  })

  describe('weak topic selection', () => {
    it('weakFocused=true selects 100% from weak topics', () => {
      const seedCount = 5
      const weakFocused = true
      const weakRatio = weakFocused ? 1.0 : 0.3
      const weakCount = Math.floor(seedCount * weakRatio)
      expect(weakCount).toBe(5)
    })

    it('weakFocused=false selects 30% from weak topics', () => {
      const seedCount = 10
      const weakFocused = false
      const weakRatio = weakFocused ? 1.0 : 0.3
      const weakCount = Math.floor(seedCount * weakRatio)
      expect(weakCount).toBe(3)
    })
  })

  describe('question deduplication', () => {
    it('deduplicates by first 60 chars of question text', () => {
      const questions = [
        { question: 'A'.repeat(80), id: '1' },
        { question: 'A'.repeat(80), id: '2' }, // duplicate
        { question: 'B'.repeat(80), id: '3' },
      ]

      const seen = new Set<string>()
      const unique = questions.filter((q) => {
        const key = q.question.slice(0, 60)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      expect(unique).toHaveLength(2)
      expect(unique[0].id).toBe('1')
      expect(unique[1].id).toBe('3')
    })
  })
})
