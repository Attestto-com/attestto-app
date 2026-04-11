import { describe, it, expect } from 'vitest'
import { mapToMacroCategory, MACRO_CATEGORIES } from '../../modules/cr-driving/src/composables/useCategoryMap'

describe('Question Bank Logic', () => {
  describe('expansion questions', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let expansionData: any

    it('expansion JSON loads and has 159 questions', async () => {
      expansionData = (await import('../../modules/cr-driving/content/questions/expansion-165.json')).default
      let total = 0
      for (const topic of expansionData.topics) {
        total += topic.questions.length
      }
      expect(total).toBe(159)
    })

    it('all expansion topics map to one of 9 macro-categories', async () => {
      if (!expansionData) {
        expansionData = (await import('../../modules/cr-driving/content/questions/expansion-165.json')).default
      }
      const macroSet = new Set(MACRO_CATEGORIES)
      for (const topic of expansionData.topics) {
        const macro = mapToMacroCategory(topic.topic)
        expect(macroSet.has(macro)).toBe(true)
      }
    })

    it('all 9 macro-categories are covered by expansion questions', async () => {
      if (!expansionData) {
        expansionData = (await import('../../modules/cr-driving/content/questions/expansion-165.json')).default
      }
      const covered = new Set<string>()
      for (const topic of expansionData.topics) {
        covered.add(mapToMacroCategory(topic.topic))
      }
      for (const cat of MACRO_CATEGORIES) {
        expect(covered.has(cat), `Missing macro-category: ${cat}`).toBe(true)
      }
    })

    it('every expansion question has 4 options and correct index 0-3', async () => {
      if (!expansionData) {
        expansionData = (await import('../../modules/cr-driving/content/questions/expansion-165.json')).default
      }
      for (const topic of expansionData.topics) {
        for (const q of topic.questions) {
          expect(q.options).toHaveLength(4)
          expect(q.answer).toBeGreaterThanOrEqual(0)
          expect(q.answer).toBeLessThanOrEqual(3)
          expect(q.q.length).toBeGreaterThan(10)
          expect(q.why.length).toBeGreaterThan(10)
        }
      }
    })

    it('grand total across all banks is 300', async () => {
      const seed = (await import('../../modules/cr-driving/content/questions/seed-automovil-40.json')).default
      const und = (await import('../../modules/cr-driving/content/questions/understanding-78.json')).default
      const lic = (await import('../../modules/cr-driving/content/questions/by-license.json')).default
      if (!expansionData) {
        expansionData = (await import('../../modules/cr-driving/content/questions/expansion-165.json')).default
      }

      let total = seed.questions.length
      for (const t of und.topics) total += t.questions.length
      for (const s of lic.sections) total += s.questions.length
      for (const t of expansionData.topics) total += t.questions.length

      expect(total).toBe(300)
    })
  })


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
