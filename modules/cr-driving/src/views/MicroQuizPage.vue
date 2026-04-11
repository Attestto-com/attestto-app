<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { selectQuestions, getDefaultConfig } from '../composables/useQuestionBank'
import { useMastery } from '../composables/useMastery'
import type { ExamQuestion, ExamResult } from '../types'

const router = useRouter()
const { mastery, updateFromResult, getAllCategories } = useMastery()

const loading = ref(true)
const questions = ref<ExamQuestion[]>([])
const currentIndex = ref(0)
const score = ref(0)
const answered = ref(false)
const selectedOption = ref<number | null>(null)
const answers = ref<{ category: string; correct: boolean }[]>([])
const masteryUpdated = ref(false)

const current = computed(() => questions.value[currentIndex.value] ?? null)
const done = computed(() => currentIndex.value >= questions.value.length && questions.value.length > 0)
const updatedCategories = computed(() => getAllCategories())

watch(done, (isDone) => {
  if (isDone && !masteryUpdated.value) {
    masteryUpdated.value = true
    const result = buildResult()
    if (result) updateFromResult(result)
  }
})

function buildResult(): ExamResult | null {
  if (!answers.value.length) return null

  const cats = new Map<string, { correct: number; total: number }>()
  for (const a of answers.value) {
    const existing = cats.get(a.category) ?? { correct: 0, total: 0 }
    existing.total++
    if (a.correct) existing.correct++
    cats.set(a.category, existing)
  }

  const categoryBreakdown = Array.from(cats.entries()).map(([category, { correct, total }]) => ({
    category,
    correct,
    total,
    percent: Math.round((correct / total) * 100),
  }))

  return {
    passed: score.value / questions.value.length >= 0.9,
    score: Math.round((score.value / questions.value.length) * 100),
    correct: score.value,
    wrong: questions.value.length - score.value,
    total: questions.value.length,
    durationSeconds: 0,
    categoryBreakdown,
    weakTopics: categoryBreakdown.filter((c) => c.percent < 70).map((c) => c.category),
    chainHead: '',
    incidents: [],
  }
}

async function loadQuestions() {
  loading.value = true
  const config = { ...getDefaultConfig(), questionCount: 5 }
  questions.value = await selectQuestions(config, mastery.value.weakTopics, true)
  loading.value = false
}

function selectAnswer(index: number) {
  if (answered.value || !current.value) return
  selectedOption.value = index
  answered.value = true
  const isCorrect = index === current.value.correct
  if (isCorrect) score.value++
  answers.value.push({ category: current.value.category, correct: isCorrect })
}

function next() {
  answered.value = false
  selectedOption.value = null
  currentIndex.value++
}

function optionClass(index: number): string {
  if (!answered.value) return ''
  if (index === current.value?.correct) return 'correct'
  if (index === selectedOption.value) return 'wrong'
  return 'dimmed'
}

function barColor(pct: number): string {
  if (pct >= 90) return 'var(--success)'
  if (pct >= 70) return 'var(--warning)'
  return 'var(--critical)'
}

loadQuestions()
</script>

<template>
  <q-page class="quiz-page" padding>
    <header class="quiz-header">
      <q-btn flat round icon="arrow_back" color="white" size="sm" @click="router.back()" />
      <span>Repaso rapido</span>
      <span class="quiz-score">{{ score }}/{{ currentIndex }}</span>
    </header>

    <div v-if="loading" class="loading-state">
      <q-spinner size="40px" color="primary" />
      <p>Cargando...</p>
    </div>

    <template v-else-if="!done && current">
      <div class="progress-info">{{ currentIndex + 1 }} / {{ questions.length }}</div>

      <div class="question-card">
        <div class="category-row">
          <div class="category-tag">{{ current.category }}</div>
          <span v-if="current.id.startsWith('llm-')" class="ai-badge">IA</span>
        </div>
        <p class="question-text">{{ current.question }}</p>
      </div>

      <div class="options">
        <button
          v-for="(opt, i) in current.options"
          :key="i"
          :class="['option-card', optionClass(i)]"
          @click="selectAnswer(i)"
        >
          {{ opt }}
        </button>
      </div>

      <div v-if="answered" class="why-card">
        <div class="why-header">&#128161; ¿Por que?</div>
        <p class="why-text">{{ current.why }}</p>
      </div>

      <div v-if="answered" class="next-bar">
        <button class="next-btn" @click="next">Siguiente</button>
      </div>
    </template>

    <div v-else-if="done" class="done-state">
      <h2>Repaso completado</h2>
      <div class="done-score">{{ score }}/{{ questions.length }}</div>
      <div class="done-percent">{{ Math.round((score / questions.length) * 100) }}%</div>

      <div class="mastery-update">
        <h3>Tu dominio actualizado</h3>
        <div v-for="cat in updatedCategories" :key="cat.category" class="cat-row">
          <span class="cat-label">{{ cat.category }}</span>
          <div class="cat-bar-bg">
            <div class="cat-bar-fill" :style="{ width: `${cat.percent}%`, background: barColor(cat.percent) }" />
            <div class="threshold-marker" />
          </div>
          <span class="cat-pct" :style="{ color: cat.isGreen ? 'var(--success)' : 'var(--text-muted)' }">
            {{ cat.percent }}%
          </span>
        </div>
      </div>

      <button class="home-btn" @click="router.push('/home')">Volver al inicio</button>
    </div>
  </q-page>
</template>

<style scoped>
.quiz-page {
  padding-bottom: 100px;
}

.quiz-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
  font-size: 17px;
  font-weight: 600;
}

.quiz-score {
  margin-left: auto;
  font-size: 14px;
  color: var(--text-muted);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  color: var(--text-muted);
}

.progress-info {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: var(--space-sm);
}

.question-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-md);
}

.category-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.category-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ai-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: rgba(89, 79, 211, 0.2);
  color: var(--primary);
}

.question-text {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.option-card {
  padding: var(--space-md);
  background: var(--bg-card);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.option-card.correct {
  border-color: var(--success);
  background: rgba(74, 222, 128, 0.1);
  color: var(--success);
}

.option-card.wrong {
  border-color: var(--warning);
  background: rgba(249, 115, 22, 0.1);
  color: var(--warning);
}

.option-card.dimmed { opacity: 0.4; }

.why-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  border-left: 3px solid var(--alert);
}

.why-header {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: var(--space-sm);
}

.why-text {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.next-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-md);
  padding-bottom: calc(var(--space-md) + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(transparent, var(--bg-base) 30%);
  z-index: 10;
}

.next-btn {
  width: 100%;
  padding: var(--space-md);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.done-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg) 0;
  text-align: center;
}

.done-score {
  font-size: 48px;
  font-weight: 700;
}

.done-percent {
  font-size: 20px;
  color: var(--text-muted);
}

.mastery-update {
  width: 100%;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.mastery-update h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-sm);
}

.cat-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 12px;
  padding: 3px 0;
}

.cat-label {
  width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
}

.cat-bar-bg {
  flex: 1;
  height: 6px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.cat-bar-fill {
  height: 100%;
  border-radius: 3px;
}

.threshold-marker {
  position: absolute;
  left: 90%;
  top: -1px;
  bottom: -1px;
  width: 2px;
  background: var(--text-muted);
  opacity: 0.4;
}

.cat-pct {
  width: 36px;
  text-align: right;
  font-weight: 600;
}

.home-btn {
  width: 100%;
  max-width: 300px;
  padding: var(--space-md);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
</style>
