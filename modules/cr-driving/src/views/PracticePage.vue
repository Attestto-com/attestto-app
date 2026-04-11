<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { selectQuestions, getDefaultConfig } from '../composables/useQuestionBank'
import { getLlmStatus } from '../composables/useQuestionGenerator'
import { useMastery } from '../composables/useMastery'
import type { ExamQuestion } from '../types'

const router = useRouter()
const { mastery, updateFromResult } = useMastery()

const phase = ref<'pick' | 'quiz' | 'done'>('pick')
const loading = ref(false)
const questionCount = ref(0)
const questions = ref<ExamQuestion[]>([])
const currentIndex = ref(0)
const score = ref(0)
const answered = ref(false)
const selectedOption = ref<number | null>(null)
const answers = ref<{ category: string; correct: boolean }[]>([])
const lastCorrect = ref<boolean | null>(null)
const showConfetti = ref(false)

const current = computed(() => questions.value[currentIndex.value] ?? null)
const done = computed(() => currentIndex.value >= questions.value.length && questions.value.length > 0)
const llm = computed(() => getLlmStatus())

async function startWithCount(count: number) {
  questionCount.value = count
  loading.value = true
  phase.value = 'quiz'
  const config = { ...getDefaultConfig(), questionCount: count }
  questions.value = await selectQuestions(config, mastery.value.weakTopics)
  loading.value = false
}

function selectAnswer(index: number) {
  if (answered.value || !current.value) return
  selectedOption.value = index
  answered.value = true
  const isCorrect = index === current.value.correct
  if (isCorrect) score.value++
  lastCorrect.value = isCorrect
  if (isCorrect) {
    showConfetti.value = true
    setTimeout(() => { showConfetti.value = false }, 1500)
  }
  answers.value.push({ category: current.value.category, correct: isCorrect })

  // Update mastery immediately per question
  updateFromResult({
    passed: false,
    score: isCorrect ? 100 : 0,
    correct: isCorrect ? 1 : 0,
    wrong: isCorrect ? 0 : 1,
    total: 1,
    durationSeconds: 0,
    categoryBreakdown: [{ category: current.value.category, correct: isCorrect ? 1 : 0, total: 1, percent: isCorrect ? 100 : 0 }],
    weakTopics: [],
    chainHead: '',
    incidents: [],
  })
}

function next() {
  answered.value = false
  selectedOption.value = null
  lastCorrect.value = null
  currentIndex.value++
}

async function skipQuestion(reason: 'new' | 'mastered') {
  if (current.value) {
    const key = 'cr-driving:skips'
    const skips: Record<string, { new: number; mastered: number }> = JSON.parse(localStorage.getItem(key) ?? '{}')
    const cat = current.value.category
    if (!skips[cat]) skips[cat] = { new: 0, mastered: 0 }
    skips[cat][reason]++
    localStorage.setItem(key, JSON.stringify(skips))
  }

  answered.value = false
  selectedOption.value = null
  lastCorrect.value = null
  const config = { ...getDefaultConfig(), questionCount: 1 }
  const fresh = await selectQuestions(config, mastery.value.weakTopics)
  if (fresh.length > 0) {
    questions.value[currentIndex.value] = fresh[0]
  }
}

function restart() {
  currentIndex.value = 0
  score.value = 0
  answered.value = false
  selectedOption.value = null
  answers.value = []
  lastCorrect.value = null
  phase.value = 'pick'
}

function optionClass(index: number): string {
  if (!answered.value) return ''
  if (index === current.value?.correct) return 'correct'
  if (index === selectedOption.value) return 'wrong'
  return 'dimmed'
}
</script>

<template>
  <q-page class="practice-page" padding>
    <!-- Phase: Pick question count -->
    <template v-if="phase === 'pick'">
      <header class="practice-header">
        <q-btn flat round icon="arrow_back" color="white" @click="router.back()" />
        <span>Modo Practica</span>
      </header>

      <div class="pick-screen">
        <h2 class="pick-title">¿Cuantas preguntas?</h2>
        <p class="pick-hint">Cada respuesta actualiza tu dominio al instante</p>

        <div class="pick-options">
          <button class="pick-btn" @click="startWithCount(1)">
            <span class="pick-count">1</span>
            <span class="pick-label">Rapida</span>
          </button>
          <button class="pick-btn" @click="startWithCount(5)">
            <span class="pick-count">5</span>
            <span class="pick-label">Repaso</span>
          </button>
          <button class="pick-btn pick-btn-accent" @click="startWithCount(10)">
            <span class="pick-count">10</span>
            <span class="pick-label">Practica</span>
            <span v-if="llm.available" class="pick-ai">IA</span>
          </button>
        </div>

        <div class="llm-status">
          <div v-if="llm.available" class="llm-ready">
            <span class="llm-dot green" />
            IA local activa — preguntas unicas con Gemma
          </div>
          <div v-else-if="llm.status === 'loading' || llm.status === 'downloading'" class="llm-loading">
            <q-spinner-dots size="12px" color="primary" />
            Cargando modelo IA...
          </div>
          <div v-else-if="!llm.supported" class="llm-off">
            <span class="llm-dot gray" />
            IA no disponible (requiere WebGPU)
          </div>
          <div v-else class="llm-off">
            <span class="llm-dot gray" />
            Banco de preguntas (141) — activa IA en Ajustes para preguntas unicas
          </div>
        </div>
      </div>
    </template>

    <!-- Phase: Quiz -->
    <template v-else-if="phase === 'quiz'">
      <header class="practice-header">
        <q-btn flat round icon="arrow_back" color="white" @click="router.back()" />
        <span>Modo Practica</span>
        <span class="practice-score">{{ score }}/{{ currentIndex }}</span>
      </header>

      <div v-if="loading" class="loading-state">
        <q-spinner size="48px" color="primary" />
        <p>Generando preguntas...</p>
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
            v-show="!answered || i === current.correct || i === selectedOption"
            :class="['option-card', optionClass(i)]"
            @click="selectAnswer(i)"
          >
            <span :class="['radio', optionClass(i)]" />
            <span>{{ opt }}</span>
          </button>
        </div>

        <div v-if="!answered" class="skip-row">
          <button class="skip-btn" @click="skipQuestion('new')">Otra pregunta</button>
          <button class="skip-btn mastered" @click="skipQuestion('mastered')">Ya domino este tema</button>
        </div>

        <!-- Feedback banner -->
        <div v-if="answered" :class="['feedback-banner', lastCorrect ? 'fb-correct' : 'fb-wrong']">
          <span class="fb-icon">{{ lastCorrect ? '🎉' : '❌' }}</span>
          <span class="fb-text">{{ lastCorrect ? 'Correcto!' : 'Incorrecto' }}</span>
        </div>

        <!-- Confetti -->
        <div v-if="showConfetti" class="confetti-container">
          <span v-for="i in 20" :key="i" class="confetti-piece" :style="{ '--i': i }" />
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
        <h2>Practica terminada</h2>
        <div class="done-score">{{ score }}/{{ questions.length }}</div>
        <div class="done-percent">{{ Math.round((score / questions.length) * 100) }}%</div>
        <button class="restart-btn" @click="phase = 'pick'">Practicar otra vez</button>
        <button class="home-btn" @click="router.push('/home')">Volver al inicio</button>
      </div>
    </template>
  </q-page>
</template>

<style scoped>
.practice-page {
  padding-bottom: 100px;
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

.pick-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-xl) 0;
}

.pick-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: var(--space-xs);
}

.pick-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: var(--space-xl);
}

.pick-options {
  display: flex;
  gap: var(--space-md);
  width: 100%;
  justify-content: center;
}

.pick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-lg) var(--space-xl);
  background: var(--bg-card);
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  flex: 1;
  max-width: 120px;
}

.pick-btn:active {
  background: var(--bg-elevated);
}

.pick-btn-accent {
  border-color: var(--primary);
}

.pick-count {
  font-size: 32px;
  font-weight: 700;
}

.pick-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.pick-ai {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(74, 222, 128, 0.2);
  color: var(--success);
  position: absolute;
  top: 6px;
  right: 6px;
}

.pick-btn {
  position: relative;
}

.llm-status {
  margin-top: var(--space-lg);
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.llm-ready, .llm-loading, .llm-off {
  display: flex;
  align-items: center;
  gap: 6px;
}

.llm-ready { color: var(--success); }

.llm-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.llm-dot.green { background: var(--success); }
.llm-dot.gray { background: var(--text-muted); }

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  color: var(--text-muted);
}

.loading-hint {
  font-size: 12px;
  opacity: 0.6;
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
  color: #a5b4fc;
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
  letter-spacing: 0.5px;
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
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--bg-card);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  color: #fff;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.radio {
  width: 18px;
  height: 18px;
  min-width: 18px;
  border-radius: 50%;
  border: 2px solid var(--text-muted);
  margin-top: 2px;
  transition: all 0.15s;
}

.radio.correct {
  border-color: var(--success);
  background: var(--success);
  box-shadow: inset 0 0 0 3px var(--bg-card);
}

.radio.wrong {
  border-color: #f87171;
  background: #f87171;
  box-shadow: inset 0 0 0 3px var(--bg-card);
}

.skip-row {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
}

.skip-btn {
  flex: 1;
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  opacity: 0.5;
}

.skip-btn:active {
  opacity: 0.8;
}

.skip-btn.mastered {
  color: var(--text-muted);
}

.option-card.correct {
  border-color: var(--success);
  background: rgba(74, 222, 128, 0.12);
  color: #a7f3d0;
}

.option-card.wrong {
  border-color: #f87171;
  background: rgba(248, 113, 113, 0.12);
  color: #fca5a5;
}

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
  color: #cbd5e1;
  line-height: 1.5;
  margin-bottom: var(--space-md);
}

.next-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-sm) var(--space-md);
  padding-bottom: calc(var(--space-sm) + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(transparent, var(--bg-base) 20%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.regen-btn {
  width: 100%;
  padding: var(--space-sm);
  background: transparent;
  border: 1px solid rgba(165, 180, 252, 0.3);
  border-radius: var(--radius-md);
  color: #a5b4fc;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.regen-btn:disabled {
  opacity: 0.5;
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

/* ── Feedback banner ──────────────────────────── */

.feedback-banner {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
  font-weight: 700;
  font-size: 15px;
  animation: fb-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fb-correct {
  background: rgba(74, 222, 128, 0.15);
  color: var(--success);
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.fb-wrong {
  background: rgba(239, 68, 68, 0.15);
  color: var(--critical);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.fb-icon {
  font-size: 20px;
}

@keyframes fb-pop {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* ── Confetti ─────────────────────────────────── */

.confetti-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 100;
  overflow: hidden;
}

.confetti-piece {
  position: absolute;
  width: 8px;
  height: 8px;
  top: 40%;
  left: 50%;
  border-radius: 2px;
  animation: confetti-burst 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  --angle: calc(var(--i) * 18deg);
  --dist: calc(80px + var(--i) * 15px);
  --color-h: calc(var(--i) * 25);
  background: hsl(var(--color-h), 80%, 60%);
}

@keyframes confetti-burst {
  0% {
    transform: translate(0, 0) rotate(0deg) scale(1);
    opacity: 1;
  }
  100% {
    transform:
      translate(
        calc(cos(var(--angle)) * var(--dist)),
        calc(sin(var(--angle)) * var(--dist) + 120px)
      )
      rotate(720deg)
      scale(0);
    opacity: 0;
  }
}
</style>
