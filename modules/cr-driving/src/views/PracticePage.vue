<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { selectQuestions, getDefaultConfig } from '../composables/useQuestionBank'
import { useMastery } from '../composables/useMastery'
import type { ExamQuestion } from '../types'

const router = useRouter()
const { mastery } = useMastery()

const loading = ref(true)
const questions = ref<ExamQuestion[]>([])
const currentIndex = ref(0)
const score = ref(0)
const answered = ref(false)
const selectedOption = ref<number | null>(null)

const current = computed(() => questions.value[currentIndex.value] ?? null)
const done = computed(() => currentIndex.value >= questions.value.length && questions.value.length > 0)

async function loadQuestions() {
  loading.value = true
  const config = { ...getDefaultConfig(), questionCount: 10 }
  questions.value = await selectQuestions(config, mastery.value.weakTopics)
  loading.value = false
}

function selectAnswer(index: number) {
  if (answered.value) return
  selectedOption.value = index
  answered.value = true
  if (index === current.value?.correct) score.value++
}

function next() {
  answered.value = false
  selectedOption.value = null
  currentIndex.value++
}

function restart() {
  currentIndex.value = 0
  score.value = 0
  answered.value = false
  selectedOption.value = null
  loadQuestions()
}

function optionClass(index: number): string {
  if (!answered.value) return ''
  if (index === current.value?.correct) return 'correct'
  if (index === selectedOption.value) return 'wrong'
  return 'dimmed'
}

loadQuestions()
</script>

<template>
  <q-page class="practice-page" padding>
    <header class="practice-header">
      <q-btn flat round icon="arrow_back" color="white" @click="router.back()" />
      <span>Modo Practica</span>
      <span class="practice-score">{{ score }}/{{ currentIndex }}</span>
    </header>

    <div v-if="loading" class="loading-state">
      <q-spinner size="48px" color="primary" />
      <p>Cargando preguntas...</p>
    </div>

    <template v-else-if="!done && current">
      <div class="progress-info">{{ currentIndex + 1 }} / {{ questions.length }}</div>

      <div class="question-card">
        <div class="category-tag">{{ current.category }}</div>
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
        <button class="next-btn" @click="next">Siguiente</button>
      </div>
    </template>

    <div v-else-if="done" class="done-state">
      <h2>Practica terminada</h2>
      <div class="done-score">{{ score }}/{{ questions.length }}</div>
      <div class="done-percent">{{ Math.round((score / questions.length) * 100) }}%</div>
      <button class="restart-btn" @click="restart">Practicar otra vez</button>
      <button class="home-btn" @click="router.push('/home')">Volver al inicio</button>
    </div>
  </q-page>
</template>

<style scoped>
.practice-page {
  padding-bottom: 40px;
}

.practice-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
  font-size: 18px;
  font-weight: 600;
}

.practice-score {
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

.category-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-sm);
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
  margin-bottom: var(--space-md);
}

.next-btn {
  width: 100%;
  padding: var(--space-sm);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.done-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
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

.restart-btn, .home-btn {
  width: 100%;
  max-width: 300px;
  padding: var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.restart-btn {
  background: var(--primary);
  color: white;
}

.home-btn {
  background: transparent;
  color: var(--text-muted);
}
</style>
