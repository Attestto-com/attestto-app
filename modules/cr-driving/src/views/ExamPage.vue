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

// Credential issuance state
const issuedVc = ref<Record<string, unknown> | null>(null)
const signing = ref(false)
const signError = ref('')
const anchoring = ref(false)
const exporting = ref(false)
const anchorTx = ref('')
const anchorError = ref('')
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

function handleFinish() {
  const result = exam.getResult()
  if (result) {
    updateFromResult(result)
  }
}

async function handleIssueCredential() {
  signing.value = true
  signError.value = ''
  try {
    const { issueExamCredential } = await import('@/composables/useVcIssuer')
    const result = exam.getResult()
    if (!result) throw new Error('No exam result')

    const categories: Record<string, { correct: number; total: number; percentage: number }> = {}
    for (const cat of result.categoryBreakdown) {
      categories[cat.category] = { correct: cat.correct, total: cat.total, percentage: cat.percent }
    }

    const vc = await issueExamCredential(
      {
        score: result.score,
        passed: result.passed,
        chainHead: result.chainHead,
        totalQuestions: result.total,
        correctAnswers: result.correct,
        durationSeconds: result.durationSeconds,
        categories,
        incidentCount: result.incidents.length,
      },
      'B1',
      {
        sign: stationSign,
        getVerificationMethod: getStationVerificationMethod,
        getPublicKey: getStationPublicKey,
      },
    )

    issuedVc.value = vc as unknown as Record<string, unknown>

    // Store the signed VC in the vault
    const { useVaultStore } = await import('@/stores/vault')
    const vault = useVaultStore()
    vault.addCredential(vc)

    exam.setPhase('credential')
  } catch (e: unknown) {
    signError.value = e instanceof Error ? e.message : 'Error al firmar credencial'
  } finally {
    signing.value = false
  }
}

async function handleAnchor() {
  anchoring.value = true
  anchorError.value = ''
  try {
    const { anchorHash } = await import('@/composables/useAnchor')
    const { useVaultStore } = await import('@/stores/vault')
    const vault = useVaultStore()
    const result = exam.getResult()
    if (!result) throw new Error('No exam result')

    const anchorResult = await anchorHash(result.chainHead, vault.did ?? '')
    anchorTx.value = anchorResult.txSignature
  } catch (e: unknown) {
    anchorError.value = e instanceof Error ? e.message : 'Error de anclaje'
  } finally {
    anchoring.value = false
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

const exportingPdf = ref(false)

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
      vcId: (issuedVc.value as Record<string, unknown>)?.id as string | undefined,
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
      @credential="handleIssueCredential"
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

          <!-- Signature status -->
          <div class="vc-field">
            <span>Firma:</span>
            <span class="signed-badge">Ed25519</span>
          </div>

          <div class="qr-placeholder">
            <q-icon name="qr_code_2" size="100px" color="grey-6" />
            <div class="qr-label">verify.attestto.com</div>
          </div>

          <div class="proof-hash">
            {{ exam.getResult()?.chainHead.slice(0, 8) }}...{{ exam.getResult()?.chainHead.slice(-8) }}
          </div>

          <!-- Solana anchor section -->
          <div class="anchor-section">
            <div v-if="anchorTx" class="anchor-success">
              <q-icon name="verified" size="16px" color="positive" />
              <a
                :href="`https://explorer.solana.com/tx/${anchorTx}?cluster=devnet`"
                target="_blank"
                class="anchor-link"
              >
                {{ anchorTx.slice(0, 8) }}...{{ anchorTx.slice(-8) }}
              </a>
            </div>
            <button
              v-else
              class="anchor-btn"
              :disabled="anchoring"
              @click="handleAnchor"
            >
              <q-spinner-dots v-if="anchoring" size="14px" />
              <template v-else>Anclar a Solana</template>
            </button>
            <div v-if="anchorError" class="anchor-error">{{ anchorError }}</div>
          </div>
        </div>

        <button class="action-btn secondary" :disabled="exporting" @click="handleExportEvidence">
          <q-spinner-dots v-if="exporting" size="14px" />
          <template v-else>Exportar evidencia (JSON)</template>
        </button>

        <button class="action-btn secondary" :disabled="exportingPdf" @click="handleExportPdf">
          <q-spinner-dots v-if="exportingPdf" size="14px" />
          <template v-else>Exportar evidencia (PDF)</template>
        </button>

        <button class="action-btn primary" @click="handleBackToHome">
          Volver al inicio
        </button>
      </div>
    </div>

    <!-- Signing loading overlay -->
    <div v-if="signing" class="signing-overlay">
      <q-spinner-dots size="32px" color="primary" />
      <div>Firmando credencial...</div>
    </div>
    <div v-if="signError" class="sign-error-banner">{{ signError }}</div>

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

.signed-badge {
  color: var(--success) !important;
  font-weight: 600;
  font-size: 12px;
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

.anchor-section {
  margin-top: var(--space-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.anchor-btn {
  padding: 8px 20px;
  background: transparent;
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.anchor-btn:disabled {
  opacity: 0.5;
}

.anchor-success {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 12px;
}

.anchor-link {
  color: var(--primary);
  font-family: monospace;
  text-decoration: none;
}

.anchor-error {
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

.action-btn.secondary {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}

.action-btn.secondary:disabled {
  opacity: 0.5;
}

.action-btn.primary {
  background: var(--primary);
  color: white;
}

.signing-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  color: var(--text-primary);
  font-size: 14px;
  z-index: 9999;
}

.sign-error-banner {
  position: fixed;
  bottom: var(--space-md);
  left: var(--space-md);
  right: var(--space-md);
  padding: var(--space-sm);
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid var(--critical);
  border-radius: var(--radius-md);
  color: var(--critical);
  font-size: 13px;
  text-align: center;
  z-index: 9999;
}
</style>
