import { describe, it, expect } from 'vitest'

/**
 * Pure logic tests for exam session scoring, category breakdown, and hash chain.
 * Tests the algorithms without Vue reactivity or async question loading.
 */

interface ExamAnswer {
  questionId: string
  selected: number
  correct: boolean
  timestamp: number
}

interface CategoryBreakdown {
  category: string
  correct: number
  total: number
  percent: number
}

function computeResult(
  answers: ExamAnswer[],
  questions: { id: string; category: string; correct: number }[],
  passThreshold: number,
  startedAt: number,
) {
  const correct = answers.filter((a) => a.correct).length
  const total = answers.length
  const wrong = total - correct

  const catMap = new Map<string, { correct: number; total: number }>()
  for (let i = 0; i < answers.length; i++) {
    const q = questions[i]
    const a = answers[i]
    const cat = q.category
    const entry = catMap.get(cat) ?? { correct: 0, total: 0 }
    entry.total++
    if (a.correct) entry.correct++
    catMap.set(cat, entry)
  }

  const categoryBreakdown: CategoryBreakdown[] = Array.from(catMap.entries()).map(
    ([category, { correct: c, total: t }]) => ({
      category,
      correct: c,
      total: t,
      percent: Math.round((c / t) * 100),
    }),
  )

  const weakTopics = categoryBreakdown
    .filter((c) => c.percent < 70)
    .sort((a, b) => a.percent - b.percent)
    .map((c) => c.category)

  const durationSeconds = Math.floor((Date.now() - startedAt) / 1000)

  return {
    passed: total > 0 ? correct / total >= passThreshold : false,
    score: total > 0 ? Math.round((correct / total) * 100) : 0,
    correct,
    wrong,
    total,
    durationSeconds,
    categoryBreakdown,
    weakTopics,
  }
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

describe('Exam scoring', () => {
  const questions = [
    { id: 'q1', category: 'Señales y semáforos', correct: 0 },
    { id: 'q2', category: 'Señales y semáforos', correct: 1 },
    { id: 'q3', category: 'Velocidad y frenado', correct: 2 },
    { id: 'q4', category: 'Velocidad y frenado', correct: 3 },
    { id: 'q5', category: 'Leyes y reglamento', correct: 0 },
  ]

  it('calculates score correctly for all correct', () => {
    const answers: ExamAnswer[] = questions.map((q) => ({
      questionId: q.id, selected: q.correct, correct: true, timestamp: Date.now(),
    }))
    const result = computeResult(answers, questions, 0.8, Date.now() - 60000)
    expect(result.score).toBe(100)
    expect(result.passed).toBe(true)
    expect(result.correct).toBe(5)
    expect(result.wrong).toBe(0)
  })

  it('calculates score correctly for all wrong', () => {
    const answers: ExamAnswer[] = questions.map((q) => ({
      questionId: q.id, selected: (q.correct + 1) % 4, correct: false, timestamp: Date.now(),
    }))
    const result = computeResult(answers, questions, 0.8, Date.now())
    expect(result.score).toBe(0)
    expect(result.passed).toBe(false)
    expect(result.correct).toBe(0)
    expect(result.wrong).toBe(5)
  })

  it('80% threshold: 4/5 passes', () => {
    const answers: ExamAnswer[] = [
      { questionId: 'q1', selected: 0, correct: true, timestamp: Date.now() },
      { questionId: 'q2', selected: 1, correct: true, timestamp: Date.now() },
      { questionId: 'q3', selected: 2, correct: true, timestamp: Date.now() },
      { questionId: 'q4', selected: 3, correct: true, timestamp: Date.now() },
      { questionId: 'q5', selected: 1, correct: false, timestamp: Date.now() },
    ]
    const result = computeResult(answers, questions, 0.8, Date.now())
    expect(result.score).toBe(80)
    expect(result.passed).toBe(true)
  })

  it('80% threshold: 3/5 fails', () => {
    const answers: ExamAnswer[] = [
      { questionId: 'q1', selected: 0, correct: true, timestamp: Date.now() },
      { questionId: 'q2', selected: 1, correct: true, timestamp: Date.now() },
      { questionId: 'q3', selected: 2, correct: true, timestamp: Date.now() },
      { questionId: 'q4', selected: 0, correct: false, timestamp: Date.now() },
      { questionId: 'q5', selected: 1, correct: false, timestamp: Date.now() },
    ]
    const result = computeResult(answers, questions, 0.8, Date.now())
    expect(result.score).toBe(60)
    expect(result.passed).toBe(false)
  })

  it('computes category breakdown', () => {
    const answers: ExamAnswer[] = [
      { questionId: 'q1', selected: 0, correct: true, timestamp: Date.now() },
      { questionId: 'q2', selected: 0, correct: false, timestamp: Date.now() },
      { questionId: 'q3', selected: 2, correct: true, timestamp: Date.now() },
      { questionId: 'q4', selected: 3, correct: true, timestamp: Date.now() },
      { questionId: 'q5', selected: 0, correct: true, timestamp: Date.now() },
    ]
    const result = computeResult(answers, questions, 0.8, Date.now())
    const senales = result.categoryBreakdown.find((c) => c.category === 'Señales y semáforos')
    expect(senales?.correct).toBe(1)
    expect(senales?.total).toBe(2)
    expect(senales?.percent).toBe(50)

    const velocidad = result.categoryBreakdown.find((c) => c.category === 'Velocidad y frenado')
    expect(velocidad?.correct).toBe(2)
    expect(velocidad?.total).toBe(2)
    expect(velocidad?.percent).toBe(100)
  })

  it('identifies weak topics (< 70%)', () => {
    const answers: ExamAnswer[] = [
      { questionId: 'q1', selected: 0, correct: true, timestamp: Date.now() },
      { questionId: 'q2', selected: 0, correct: false, timestamp: Date.now() }, // Señales: 50%
      { questionId: 'q3', selected: 2, correct: true, timestamp: Date.now() },
      { questionId: 'q4', selected: 3, correct: true, timestamp: Date.now() }, // Velocidad: 100%
      { questionId: 'q5', selected: 1, correct: false, timestamp: Date.now() }, // Leyes: 0%
    ]
    const result = computeResult(answers, questions, 0.8, Date.now())
    expect(result.weakTopics).toContain('Señales y semáforos')
    expect(result.weakTopics).toContain('Leyes y reglamento')
    expect(result.weakTopics).not.toContain('Velocidad y frenado')
  })

  it('weak topics sorted by percent ascending', () => {
    const answers: ExamAnswer[] = [
      { questionId: 'q1', selected: 0, correct: true, timestamp: Date.now() },
      { questionId: 'q2', selected: 0, correct: false, timestamp: Date.now() }, // Señales: 50%
      { questionId: 'q3', selected: 0, correct: false, timestamp: Date.now() },
      { questionId: 'q4', selected: 0, correct: false, timestamp: Date.now() }, // Velocidad: 0%
      { questionId: 'q5', selected: 1, correct: false, timestamp: Date.now() }, // Leyes: 0%
    ]
    const result = computeResult(answers, questions, 0.8, Date.now())
    // 0% categories first, then 50%
    expect(result.weakTopics.indexOf('Señales y semáforos')).toBeGreaterThan(0)
  })
})

describe('Hash chain (SHA-256)', () => {
  it('produces 64-char hex string', async () => {
    const hash = await sha256('test')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('same input produces same hash', async () => {
    const h1 = await sha256('identical')
    const h2 = await sha256('identical')
    expect(h1).toBe(h2)
  })

  it('different input produces different hash', async () => {
    const h1 = await sha256('input1')
    const h2 = await sha256('input2')
    expect(h1).not.toBe(h2)
  })

  it('chain is tamper-evident: changing one link changes all subsequent', async () => {
    let head = '0'.repeat(64)

    // Build a 3-link chain
    const heads: string[] = []
    for (const payload of ['answer1', 'answer2', 'answer3']) {
      head = await sha256(JSON.stringify({ prev: head, payload }))
      heads.push(head)
    }

    // Rebuild with tampered first answer
    let tamperedHead = '0'.repeat(64)
    const tamperedHeads: string[] = []
    for (const payload of ['TAMPERED', 'answer2', 'answer3']) {
      tamperedHead = await sha256(JSON.stringify({ prev: tamperedHead, payload }))
      tamperedHeads.push(tamperedHead)
    }

    // All heads differ
    expect(tamperedHeads[0]).not.toBe(heads[0])
    expect(tamperedHeads[1]).not.toBe(heads[1])
    expect(tamperedHeads[2]).not.toBe(heads[2])
  })
})
