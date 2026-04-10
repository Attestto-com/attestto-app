<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useExam } from '../composables/useExam'
import { useMastery } from '../composables/useMastery'
import ConsentScreen from '../components/ConsentScreen.vue'
import PreExamScreen from '../components/PreExamScreen.vue'
import QuestionScreen from '../components/QuestionScreen.vue'
import ResultScreen from '../components/ResultScreen.vue'
import AnomalyOverlay from '../components/AnomalyOverlay.vue'

const router = useRouter()
const exam = useExam()
const { mastery, updateFromResult } = useMastery()

const anomalyVisible = ref(false)
const anomalyMessage = ref('')
const anomalySeverity = ref<'warning' | 'critical' | 'terminal'>('warning')

// Timer
const timeRemaining = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

function startTimer() {
  timeRemaining.value = exam.config.value.timeLimitMinutes * 60
  timerInterval = setInterval(() => {
    if (anomalyVisible.value) return // pause during anomaly
    timeRemaining.value--
    if (timeRemaining.value <= 0) {
      clearInterval(timerInterval!)
      exam.setPhase('result')
    }
  }, 1000)
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval)
}

async function handleConsent() {
  exam.setPhase('pre-exam')
}

function handleReject() {
  router.back()
}

async function handleStartExam() {
  await exam.startSession(mastery.value.weakTopics)
  startTimer()
}

function handleAnswer(selected: number) {
  exam.submitAnswer(selected)
}

function handleNextQuestion() {
  exam.nextQuestion()
}

function handleFinish() {
  stopTimer()
  const result = exam.getResult()
  if (result) {
    updateFromResult(result)
  }
}

function handleBackToHome() {
  exam.reset()
  router.push('/home')
}

onUnmounted(() => {
  stopTimer()
})
</script>

<template>
  <div class="exam-container">
    <ConsentScreen
      v-if="exam.phase.value === 'consent'"
      @accept="handleConsent"
      @reject="handleReject"
    />

    <PreExamScreen
      v-else-if="exam.phase.value === 'pre-exam'"
      @start="handleStartExam"
      @back="handleReject"
    />

    <QuestionScreen
      v-else-if="exam.phase.value === 'in-progress'"
      :question="exam.currentQuestion.value!"
      :question-number="exam.questionNumber.value"
      :total-questions="exam.totalQuestions.value"
      :progress="exam.progress.value"
      :score="exam.score.value"
      :time-remaining="timeRemaining"
      :feedback-visible="exam.feedbackVisible.value"
      :last-answer="exam.lastAnswer.value"
      @answer="handleAnswer"
      @next="handleNextQuestion"
    />

    <ResultScreen
      v-else-if="exam.phase.value === 'result'"
      :result="exam.getResult()!"
      @finish="handleFinish"
      @home="handleBackToHome"
      @credential="exam.setPhase('credential')"
    />

    <div v-else-if="exam.phase.value === 'credential'" class="credential-screen">
      <!-- Credential issued screen -->
      <div class="celebration">
        <div class="credential-card">
          <h2>CREDENCIAL VERIFICABLE</h2>
          <div class="vc-field"><span>Tipo:</span> Prueba Teorica</div>
          <div class="vc-field"><span>Vehiculo:</span> Automovil B1</div>
          <div class="vc-field"><span>Score:</span> {{ exam.getResult()?.score }}%</div>
          <div class="vc-field"><span>Fecha:</span> {{ new Date().toISOString().slice(0, 10) }}</div>
          <div class="vc-field"><span>Emisor:</span> Attestto</div>

          <div class="qr-placeholder">
            <q-icon name="qr_code_2" size="100px" color="grey-6" />
            <div class="qr-label">verify.attestto.com</div>
          </div>

          <div class="proof-hash">
            {{ exam.getResult()?.chainHead.slice(0, 8) }}...{{ exam.getResult()?.chainHead.slice(-8) }}
          </div>
        </div>

        <button class="action-btn primary" @click="handleBackToHome">
          Volver al inicio
        </button>
      </div>
    </div>

    <AnomalyOverlay
      v-if="anomalyVisible"
      :message="anomalyMessage"
      :severity="anomalySeverity"
      :incident-count="exam.incidents.value.length"
      @dismiss="anomalyVisible = false"
    />
  </div>
</template>

<style scoped>
.exam-container {
  min-height: 100dvh;
  background: var(--bg-base);
}

.credential-screen {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-md);
}

.celebration {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  width: 100%;
  max-width: 400px;
}

.credential-card {
  background: var(--bg-card);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  width: 100%;
  text-align: center;
}

.credential-card h2 {
  font-size: 16px;
  letter-spacing: 1px;
  margin-bottom: var(--space-lg);
  color: var(--success);
}

.vc-field {
  display: flex;
  justify-content: space-between;
  padding: var(--space-xs) 0;
  font-size: 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.vc-field span {
  color: var(--text-muted);
}

.qr-placeholder {
  margin: var(--space-lg) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.qr-label {
  font-size: 12px;
  color: var(--text-muted);
}

.proof-hash {
  font-family: monospace;
  font-size: 12px;
  color: var(--text-muted);
}

.action-btn {
  width: 100%;
  padding: var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.action-btn.primary {
  background: var(--primary);
  color: white;
}
</style>
