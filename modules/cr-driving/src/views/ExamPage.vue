<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useExam } from '../composables/useExam'
import { useMastery } from '../composables/useMastery'
import { useCamera } from '../composables/useCamera'
import { useFaceDetection } from '../composables/useFaceDetection'
import { useLockdown } from '../composables/useLockdown'
import { useVoiceDetection } from '../composables/useVoiceDetection'
import ConsentScreen from '../components/ConsentScreen.vue'
import PreExamScreen from '../components/PreExamScreen.vue'
import QuestionScreen from '../components/QuestionScreen.vue'
import ResultScreen from '../components/ResultScreen.vue'
import AnomalyOverlay from '../components/AnomalyOverlay.vue'

const router = useRouter()
const exam = useExam()
const { mastery, updateFromResult } = useMastery()
const camera = useCamera()
const face = useFaceDetection()
const lockdown = useLockdown()
const voice = useVoiceDetection()

// Video element ref for camera + face detection binding
const videoRef = ref<HTMLVideoElement | null>(null)

// Anomaly overlay state
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
      finishExam()
    }
  }, 1000)
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
}

// ── Anomaly handling ─────────────────────────────────

function showAnomaly(message: string, severity: 'warning' | 'critical' | 'terminal') {
  anomalyMessage.value = message
  anomalySeverity.value = severity
  anomalyVisible.value = true
}

// Graduated response tracking
const multipleFaceCount = ref(0)

// Wire face detection events → anomaly overlay + hash chain
face.setEventCallback((event) => {
  exam.recordEvent(event.type, event.data)

  if (event.type === 'face-absent') {
    exam.addIncident('face-absent', 'warning')
    showAnomaly('No se detecta tu rostro. Asegurate de estar frente a la camara.', 'warning')
  }

  if (event.type === 'face-multiple') {
    multipleFaceCount.value++
    if (multipleFaceCount.value >= 3) {
      exam.addIncident('face-multiple', 'terminal')
      showAnomaly('Se detectaron multiples personas por tercera vez. Examen detenido.', 'terminal')
    } else if (multipleFaceCount.value >= 2) {
      exam.addIncident('face-multiple', 'critical')
      showAnomaly('Se detectaron multiples personas en la camara. Segunda advertencia.', 'critical')
    } else {
      exam.addIncident('face-multiple', 'warning')
      showAnomaly('Se detectaron multiples personas en la camara. Asegurate de estar solo.', 'warning')
    }
  }
})

// Wire lockdown events → hash chain
lockdown.setEventCallback((event) => {
  exam.recordEvent(event.type, event.data)

  if (event.type === 'focus-lost') {
    exam.addIncident('focus-lost', 'warning')
  }
  if (event.type === 'fullscreen-exit') {
    showAnomaly('Saliste de pantalla completa. El examen requiere pantalla completa.', 'warning')
  }
})

// Wire voice detection → hash chain
voice.setEventCallback((event) => {
  if (event.type === 'voice-detected') {
    exam.recordEvent('voice-detected', event.data)
    exam.addIncident('voice-detected', 'critical')
    showAnomaly('Se detecto actividad de voz. No se permite hablar durante el examen.', 'critical')
  }
})

// ── Phase handlers ───────────────────────────────────

async function handleConsent() {
  exam.setPhase('pre-exam')
  // Start camera for preview after consent
  await camera.start()
}

function handleReject() {
  cleanup()
  router.back()
}

async function handleStartExam() {
  // Start face detection on the video element
  if (videoRef.value) {
    await face.start(videoRef.value)
  }

  // Activate lockdown (fullscreen + keyboard blocking)
  await lockdown.activate()

  // Start voice detection
  await voice.start()

  // Record session start in hash chain
  exam.recordEvent('session-start', { timestamp: Date.now() })

  // Start the exam session
  await exam.startSession(mastery.value.weakTopics)
  startTimer()
}

function handleAnswer(selected: number) {
  exam.submitAnswer(selected)
}

function handleNextQuestion() {
  exam.nextQuestion()
}

function handleAnomalyDismiss() {
  anomalyVisible.value = false
  // Terminal = exam over
  if (anomalySeverity.value === 'terminal') {
    finishExam()
  }
}

function finishExam() {
  stopTimer()
  face.stop()
  voice.stop()
  lockdown.deactivate()
  exam.recordEvent('session-end', { timestamp: Date.now() })
  exam.setPhase('result')
}

function handleFinish() {
  const result = exam.getResult()
  if (result) {
    updateFromResult(result)
  }
}

function handleBackToHome() {
  cleanup()
  exam.reset()
  router.push('/home')
}

function cleanup() {
  stopTimer()
  face.stop()
  voice.stop()
  camera.stop()
  if (lockdown.active.value) lockdown.deactivate()
}

// Bind video element when it appears
function onVideoMounted(el: HTMLVideoElement) {
  videoRef.value = el
  camera.bindVideo(el)
}

// Auto-finish when all questions answered
watch(
  () => exam.phase.value,
  (phase) => {
    if (phase === 'result') {
      face.stop()
      voice.stop()
      lockdown.deactivate()
      stopTimer()
      // Keep camera running briefly for result screen, then stop
      setTimeout(() => camera.stop(), 2000)
    }
  },
)

onUnmounted(() => cleanup())
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
      :camera-active="camera.isActive.value"
      :face-status="face.status.value"
      @start="handleStartExam"
      @back="handleReject"
      @video-mounted="onVideoMounted"
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
      :face-status="face.status.value"
      :lockdown-active="lockdown.active.value"
      :voice-active="voice.voiceActive.value"
      :violation-count="lockdown.violationCount.value"
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
      @dismiss="handleAnomalyDismiss"
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
