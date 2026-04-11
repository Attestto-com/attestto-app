<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { selectQuestions, getDefaultConfig } from '../composables/useQuestionBank'
import { getLlmStatus } from '../composables/useQuestionGenerator'
import { useMastery } from '../composables/useMastery'
import { MACRO_CATEGORIES, MIN_QUESTIONS_PER_CATEGORY } from '../composables/useCategoryMap'
import type { ExamQuestion } from '../types'

const router = useRouter()
const { mastery, updateFromResult, getCategoryProgress, unlockedCount } = useMastery()
const activeTab = ref<'attestto' | 'cosevi'>('attestto')

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
const catProgress = computed(() => getCategoryProgress())

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
    <!-- Phase: Pick mode -->
    <template v-if="phase === 'pick'">
      <header class="practice-header">
        <q-btn flat round icon="arrow_back" color="white" @click="router.back()" />
        <span>Examen Teorico</span>
      </header>

      <!-- Mode tabs -->
      <div class="mode-tabs">
        <button :class="['mode-tab', activeTab === 'attestto' && 'active']" @click="activeTab = 'attestto'">
          Attestto
        </button>
        <button :class="['mode-tab', activeTab === 'cosevi' && 'active']" @click="activeTab = 'cosevi'">
          COSEVI
        </button>
      </div>

      <!-- Attestto: perpetual competency -->
      <div v-if="activeTab === 'attestto'" class="pick-screen">
        <div class="mode-desc">
          <h3>Competencia perpetua</h3>
          <p>90% en las 9 categorias con minimo {{ MIN_QUESTIONS_PER_CATEGORY }} preguntas cada una para generar tu credencial.</p>
        </div>

        <div class="cat-progress-grid">
          <div class="cat-unlock-count">{{ unlockedCount }} de {{ MACRO_CATEGORIES.length }} categorias desbloqueadas</div>
          <div v-for="cat in catProgress" :key="cat.category" class="cat-prog-row">
            <span class="cat-prog-name">{{ cat.category }}</span>
            <div class="cat-prog-bar-bg">
              <div class="cat-prog-bar-fill" :style="{ width: `${cat.minReached ? cat.percent : (cat.total / MIN_QUESTIONS_PER_CATEGORY) * 100}%`, background: cat.unlocked ? 'var(--success)' : cat.total > 0 ? 'var(--primary)' : 'var(--bg-elevated)' }" />
              <div v-if="cat.minReached" class="cat-prog-marker" />
            </div>
            <span class="cat-prog-stat">
              <template v-if="!cat.minReached">{{ cat.total }}/{{ MIN_QUESTIONS_PER_CATEGORY }}</template>
              <template v-else>{{ cat.percent }}%</template>
            </span>
          </div>
        </div>

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
            <span class="pick-label">Sesion</span>
            <span v-if="llm.available" class="pick-ai">IA</span>
          </button>
        </div>

        <div class="llm-status">
          <div v-if="llm.available" class="llm-ready">
            <span class="llm-dot green" /> IA local activa
          </div>
          <div v-else-if="llm.status === 'loading' || llm.status === 'downloading'" class="llm-loading">
            <q-spinner-dots size="12px" color="primary" /> Cargando IA...
          </div>
          <div v-else class="llm-off">
            <span class="llm-dot gray" /> Banco estatico (141 preguntas)
          </div>
        </div>
      </div>

      <!-- COSEVI: legacy 40-question exam -->
      <div v-else class="pick-screen">
        <div class="mode-desc">
          <h3>Examen COSEVI</h3>
          <p>40 preguntas, 40 minutos, proctorizado. Resultado pasa/no pasa al 80%.</p>
        </div>

        <div class="cosevi-info">
          <div class="cosevi-row"><span>Preguntas</span><span>40</span></div>
          <div class="cosevi-row"><span>Tiempo</span><span>40 min</span></div>
          <div class="cosevi-row"><span>Aprobacion</span><span>80%</span></div>
          <div class="cosevi-row"><span>Proctorizado</span><span>Si</span></div>
          <div class="cosevi-row"><span>Resultado</span><span>Pasa / No pasa</span></div>
        </div>

        <button class="cosevi-start-btn" @click="router.push('/module/cr-driving/exam')">
          Iniciar examen COSEVI
        </button>

        <p class="cosevi-hint">Este es el formato oficial que usa COSEVI actualmente. El modelo Attestto (pestaña izquierda) es nuestra propuesta de mejora.</p>
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

.mode-tabs {
  display: flex;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 3px;
  margin-bottom: var(--space-md);
}

.mode-tab {
  flex: 1;
  padding: var(--space-sm);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-tab.active {
  background: var(--primary);
  color: white;
}

.pick-screen {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.mode-desc h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
}

.mode-desc p {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.cat-progress-grid {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.cat-unlock-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-sm);
}

.cat-prog-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 4px 0;
}

.cat-prog-name {
  width: 110px;
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-prog-bar-bg {
  flex: 1;
  height: 5px;
  background: var(--bg-elevated);
  border-radius: 3px;
  position: relative;
}

.cat-prog-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.cat-prog-marker {
  position: absolute;
  left: 90%;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: var(--text-muted);
  opacity: 0.3;
}

.cat-prog-stat {
  width: 36px;
  text-align: right;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.pick-options {
  display: flex;
  gap: var(--space-md);
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
  flex: 1;
  position: relative;
}

.pick-btn:active { background: var(--bg-elevated); }
.pick-btn-accent { border-color: var(--primary); }

.pick-count {
  font-size: 28px;
  font-weight: 700;
}

.pick-label {
  font-size: 11px;
  color: var(--text-muted);
}

.cosevi-info {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.cosevi-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.cosevi-row:last-child { border-bottom: none; }
.cosevi-row span:first-child { color: var(--text-muted); }

.cosevi-start-btn {
  width: 100%;
  padding: var(--space-md);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.cosevi-hint {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  opacity: 0.7;
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
