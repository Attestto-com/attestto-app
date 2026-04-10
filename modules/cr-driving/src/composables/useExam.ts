import { ref, computed } from 'vue'
import type { ExamSession, ExamAnswer, ExamConfig, ExamResult, ExamIncident } from '../types'
import { selectQuestions, getDefaultConfig } from './useQuestionBank'

const session = ref<ExamSession | null>(null)
const feedbackVisible = ref(false)
const lastAnswer = ref<{ selected: number; correct: number; isCorrect: boolean } | null>(null)

export function useExam() {
  const config = ref<ExamConfig>(getDefaultConfig())

  const phase = computed(() => session.value?.phase ?? 'consent')
  const currentQuestion = computed(() => {
    if (!session.value || session.value.currentIndex >= session.value.questions.length) return null
    return session.value.questions[session.value.currentIndex]
  })
  const progress = computed(() => {
    if (!session.value) return 0
    return session.value.currentIndex / session.value.questions.length
  })
  const questionNumber = computed(() => (session.value?.currentIndex ?? 0) + 1)
  const totalQuestions = computed(() => session.value?.questions.length ?? 0)
  const score = computed(() => session.value?.score ?? 0)
  const incidents = computed(() => session.value?.incidents ?? [])

  async function startSession(weakTopics: string[] = []): Promise<void> {
    const questions = await selectQuestions(config.value, weakTopics)

    session.value = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      config: config.value,
      questions,
      answers: [],
      phase: 'in-progress',
      currentIndex: 0,
      score: 0,
      incidents: [],
      chainHead: '0'.repeat(64),
    }
  }

  function setPhase(p: ExamSession['phase']): void {
    if (session.value) session.value.phase = p
  }

  function submitAnswer(selected: number): void {
    if (!session.value || !currentQuestion.value) return

    const q = currentQuestion.value
    const isCorrect = selected === q.correct

    const answer: ExamAnswer = {
      questionId: q.id,
      selected,
      correct: isCorrect,
      timestamp: Date.now(),
    }

    session.value.answers.push(answer)
    if (isCorrect) session.value.score++

    // Update chain head (simplified — real version uses SHA-256)
    session.value.chainHead = simpleHash(session.value.chainHead + JSON.stringify(answer))

    // Show feedback
    lastAnswer.value = { selected, correct: q.correct, isCorrect }
    feedbackVisible.value = true
  }

  function nextQuestion(): void {
    if (!session.value) return
    feedbackVisible.value = false
    lastAnswer.value = null
    session.value.currentIndex++

    if (session.value.currentIndex >= session.value.questions.length) {
      session.value.phase = 'result'
    }
  }

  function addIncident(type: ExamIncident['type'], severity: ExamIncident['severity']): void {
    if (!session.value) return
    const existing = session.value.incidents.find((i) => i.type === type)
    if (existing) {
      existing.count++
      existing.timestamp = Date.now()
    } else {
      session.value.incidents.push({ type, severity, timestamp: Date.now(), count: 1 })
    }
  }

  function getResult(): ExamResult | null {
    if (!session.value) return null
    const s = session.value
    const correct = s.answers.filter((a) => a.correct).length
    const total = s.answers.length
    const wrong = total - correct

    // Category breakdown
    const catMap = new Map<string, { correct: number; total: number }>()
    for (let i = 0; i < s.answers.length; i++) {
      const q = s.questions[i]
      const a = s.answers[i]
      const cat = q.category
      const entry = catMap.get(cat) ?? { correct: 0, total: 0 }
      entry.total++
      if (a.correct) entry.correct++
      catMap.set(cat, entry)
    }

    const categoryBreakdown = Array.from(catMap.entries()).map(([category, { correct: c, total: t }]) => ({
      category,
      correct: c,
      total: t,
      percent: Math.round((c / t) * 100),
    }))

    const weakTopics = categoryBreakdown
      .filter((c) => c.percent < 70)
      .sort((a, b) => a.percent - b.percent)
      .map((c) => c.category)

    const durationSeconds = Math.floor((Date.now() - s.startedAt) / 1000)

    return {
      passed: correct / total >= s.config.passThreshold,
      score: Math.round((correct / total) * 100),
      correct,
      wrong,
      total,
      durationSeconds,
      categoryBreakdown,
      weakTopics,
      chainHead: s.chainHead,
      incidents: s.incidents,
    }
  }

  function reset(): void {
    session.value = null
    feedbackVisible.value = false
    lastAnswer.value = null
  }

  return {
    session,
    config,
    phase,
    currentQuestion,
    progress,
    questionNumber,
    totalQuestions,
    score,
    incidents,
    feedbackVisible,
    lastAnswer,
    startSession,
    setPhase,
    submitAnswer,
    nextQuestion,
    addIncident,
    getResult,
    reset,
  }
}

function simpleHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(16, '0')
}
