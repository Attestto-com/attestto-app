<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useExam } from '../composables/useExam'
import { useMastery } from '../composables/useMastery'
import { useCamera } from '../composables/useCamera'
import { useFaceDetection } from '../composables/useFaceDetection'
import { useLivenessChallenge } from '../composables/useLivenessChallenge'
import { useFaceIdentity } from '../composables/useFaceIdentity'
import { useLockdown } from '../composables/useLockdown'
import { useVoiceDetection } from '../composables/useVoiceDetection'
import { initStation, stationSign, getStationVerificationMethod, getStationPublicKey, destroyStation } from '../composables/useStationKey'
import { scheduleReviewReminder, requestPermission } from '../composables/useNotifications'
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
const liveness = useLivenessChallenge(face.blendshapes)
const identity = useFaceIdentity()
const lockdown = useLockdown()
const voice = useVoiceDetection()

// Video element ref for camera + face detection binding
const videoRef = ref<HTMLVideoElement | null>(null)

// Anomaly overlay state
const anomalyVisible = ref(false)
const anomalyMessage = ref('')
const anomalySeverity = ref<'warning' | 'critical' | 'terminal'>('warning')

// Evidence export state
const exporting = ref(false)
const exportingPdf = ref(false)
const anchorTx = ref('')
const stationDid = ref('')

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

  if (event.type === 'face-blocked') {
    // Multiple faces → immediate block (pliego B7)
    exam.addIncident('face-multiple', 'terminal')
    showAnomaly('Se detectaron multiples personas. Examen detenido por seguridad.', 'terminal')
    return
  }

  if (event.type === 'face-multiple') {
    multipleFaceCount.value++
    exam.addIncident('face-multiple', 'critical')
    showAnomaly(`Se detectaron multiples personas en la camara (${multipleFaceCount.value}x).`, 'critical')
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
  // Start watching blendshapes for liveness (watcher activates when liveness.start() is called)
  liveness.startWatching()
}

function handleStartLiveness() {
  // Start face detection to get blendshapes
  if (videoRef.value) {
    face.start(videoRef.value)
  }
  liveness.start()
}

// Watch liveness result — when passed, capture reference selfie
watch(
  () => liveness.result.value,
  async (result) => {
    if (result?.passed && videoRef.value) {
      exam.recordEvent('liveness-passed', {
        durationMs: result.durationMs,
        steps: result.steps.length,
      })
      // Capture reference selfie for continuous identity verification
      const hash = await identity.captureReference(() => face.captureReferenceFrame())
      exam.recordEvent('reference-selfie-captured', { hash })
    }
  },
)

function handleReject() {
  cleanup()
  router.back()
}

async function handleStartExam() {
  // Face detection should already be running from liveness challenge
  if (videoRef.value && !face.isRunning.value) {
    await face.start(videoRef.value)
  }

  // Start continuous identity verification (pliego B3, B6, B8)
  identity.startChecking(() => {
    exam.addIncident('face-mismatch', 'terminal')
    exam.recordEvent('identity-mismatch', { timestamp: Date.now() })
    showAnomaly('Se detecto un cambio de identidad. Examen detenido por seguridad.', 'terminal')
  })

  // Activate lockdown (fullscreen + keyboard blocking)
  await lockdown.activate()

  // Start voice detection
  await voice.start()

  // Start the exam session
  await exam.startSession(mastery.value.weakTopics)

  // Initialize station key for this session (after session exists)
  const stationInfo = initStation(exam.session.value!.id)
  stationDid.value = stationInfo.stationDid
  exam.recordEvent('station-initialized', { stationDid: stationInfo.stationDid })

  // Wire per-answer signing with station key
  exam.setSignFunction(stationSign)

  // Record session start in hash chain
  exam.recordEvent('session-start', { timestamp: Date.now() })
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
  identity.stopChecking()
  lockdown.deactivate()
  exam.recordEvent('session-end', { timestamp: Date.now() })
  exam.setPhase('result')
}

async function handleFinish() {
  const result = exam.getResult()
  if (result) {
    updateFromResult(result)
    // Request notification permission + schedule review reminders
    await requestPermission()
    scheduleReviewReminder()
  }
}

async function handleExportEvidence() {
  exporting.value = true
  try {
    const { buildEvidenceBundle, downloadEvidence } = await import('../composables/useEvidenceExport')
    const result = exam.getResult()
    if (!result) throw new Error('No exam result')

    const bundle = buildEvidenceBundle(
      exam.session.value?.id ?? 'unknown',
      result,
    )
    await downloadEvidence(bundle, result.chainHead)
  } catch {
    // Silent fail — evidence export is best-effort
  } finally {
    exporting.value = false
  }
}

async function handleExportPdf() {
  exportingPdf.value = true
  try {
    const { generateEvidencePdf } = await import('../composables/useEvidencePdf')
    const result = exam.getResult()
    if (!result) throw new Error('No exam result')

    const { useVaultStore } = await import('@/stores/vault')
    const vault = useVaultStore()

    generateEvidencePdf(result, {
      sessionId: exam.session.value?.id ?? 'unknown',
      userDid: vault.did ?? 'unknown',
      stationDid: stationDid.value || undefined,
      anchorTx: anchorTx.value || undefined,
      vcId: undefined,
    })
  } catch {
    // Silent fail — PDF export is best-effort
  } finally {
    exportingPdf.value = false
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
  identity.reset()
  liveness.cleanup()
  camera.stop()
  if (lockdown.active.value) lockdown.deactivate()
  destroyStation()
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
      :liveness-active="liveness.active.value"
      :liveness-step-label="liveness.stepLabel.value"
      :liveness-step-icon="liveness.stepIcon.value"
      :liveness-progress="liveness.progress.value"
      :liveness-passed="liveness.result.value?.passed ?? false"
      @start="handleStartExam"
      @back="handleReject"
      @video-mounted="onVideoMounted"
      @start-liveness="handleStartLiveness"
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
      :session-id="exam.session.value?.id"
      :user-did="''"
      @answer="handleAnswer"
      @next="handleNextQuestion"
    />

    <ResultScreen
      v-else-if="exam.phase.value === 'result'"
      :result="exam.getResult()!"
      @finish="handleFinish"
      @home="handleBackToHome"
    />

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

</style>
