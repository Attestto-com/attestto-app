<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSigningSession } from '../composables/useSigningSession'
import { extractTextFromPdf, analyzeDocument, buildManualAnalysis, getLlmStatus } from '../composables/usePdfAnalyzer'
import DocumentSummaryCard from '../components/DocumentSummaryCard.vue'
import FlaggedClausesPanel from '../components/FlaggedClausesPanel.vue'
import PreSigningChat from '../components/PreSigningChat.vue'
import ManualClassificationForm from '../components/ManualClassificationForm.vue'
import type { DocumentCategory } from '../types'

const route = useRoute()
const router = useRouter()
const {
  session, pdfBytes, phase, analysis,
  updatePhase, setError, setExtractedText, setAnalysis,
  addChatMessage, addUserAnswer, getNextQuestion, setRecommendation,
  loadSession,
} = useSigningSession()

const showManualFallback = ref(false)

onMounted(async () => {
  const sessionId = route.params.sessionId as string

  // If session not in memory, try to load from storage
  if (!session.value || session.value.id !== sessionId) {
    const loaded = await loadSession(sessionId)
    if (loaded) {
      session.value = loaded
      // If session was already past upload, show where it left off
      if (loaded.phase !== 'upload') return
    } else {
      setError('Sesion no encontrada. Sube el documento de nuevo.')
      return
    }
  }

  // Only start extraction if we're at upload phase with PDF bytes in memory
  if (session.value.phase === 'upload' && pdfBytes.value) {
    await runAnalysis()
  } else if (session.value.phase === 'upload' && !pdfBytes.value) {
    setError('El PDF ya no esta en memoria. Sube el documento de nuevo.')
  }
})

async function runAnalysis() {
  if (!pdfBytes.value) return

  // Step 1: Extract text
  updatePhase('extracting')
  try {
    const text = await extractTextFromPdf(pdfBytes.value)
    setExtractedText(text)

    if (!text.trim()) {
      showManualFallback.value = true
      updatePhase('summary')
      return
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Error al extraer texto del PDF')
    return
  }

  // Step 2: LLM Analysis
  const llm = getLlmStatus()
  if (!llm.supported || !llm.available) {
    showManualFallback.value = true
    updatePhase('summary')
    return
  }

  updatePhase('analyzing')
  try {
    const result = await analyzeDocument(session.value!.extractedText)
    if (result) {
      setAnalysis(result)
      updatePhase('summary')
    } else {
      showManualFallback.value = true
      updatePhase('summary')
    }
  } catch {
    showManualFallback.value = true
    updatePhase('summary')
  }
}

function handleManualClassify(category: DocumentCategory, summary: string) {
  const manual = buildManualAnalysis(category, summary)
  setAnalysis(manual)
  showManualFallback.value = false
}

function goToChat() {
  updatePhase('chat')
  // Add first question as assistant message
  const next = getNextQuestion()
  if (next) {
    addChatMessage({
      id: `q-${next.id}`,
      role: 'assistant',
      text: next.text,
      timestamp: Date.now(),
      questionId: next.id,
    })
  }
}

function handleAnswer(text: string) {
  if (!session.value) return

  const currentQ = getNextQuestion()
  if (!currentQ) return

  // Add user answer
  addChatMessage({
    id: `a-${currentQ.id}`,
    role: 'user',
    text,
    timestamp: Date.now(),
  })
  addUserAnswer({
    questionId: currentQ.id,
    answer: text,
    timestamp: Date.now(),
  })

  // Get next question or finish
  const next = getNextQuestion()
  if (next) {
    setTimeout(() => {
      addChatMessage({
        id: `q-${next.id}`,
        role: 'assistant',
        text: next.text,
        timestamp: Date.now(),
        questionId: next.id,
      })
    }, 500)
  } else {
    // All questions answered — compute recommendation
    setRecommendation()
    setTimeout(() => {
      const rec = session.value!.recommendation
      const recText = rec === 'sign'
        ? 'Basandome en tus respuestas, puedes proceder a firmar.'
        : rec === 'review'
          ? 'Te recomiendo que un revisor de confianza revise este documento antes de firmar. Puedes proceder si lo deseas.'
          : 'Este documento requiere asesoria legal. Puedes proceder bajo tu responsabilidad.'
      addChatMessage({
        id: 'rec',
        role: 'assistant',
        text: recText,
        timestamp: Date.now(),
      })
    }, 800)
  }
}

const allQuestionsAnswered = computed(() => {
  if (!session.value?.analysis) return false
  return session.value.userAnswers.length >= session.value.analysis.questions.length
})

const nextQuestionText = computed(() => {
  const q = getNextQuestion()
  return q?.text ?? null
})

function goToSign() {
  router.push(`/module/doc-signing/sign/${session.value!.id}`)
}
</script>

<template>
  <div class="page">
    <div class="header">
      <button class="back-btn" @click="router.push('/module/doc-signing/upload')">
        <span class="material-icons-outlined">arrow_back</span>
      </button>
      <h1 class="title">{{ session?.fileName ?? 'Documento' }}</h1>
    </div>

    <!-- Loading states -->
    <div v-if="phase === 'extracting' || phase === 'analyzing'" class="loading-state">
      <q-spinner-dots size="32px" color="primary" />
      <p class="loading-text">
        {{ phase === 'extracting' ? 'Extrayendo texto del PDF...' : 'Analizando documento con IA...' }}
      </p>
    </div>

    <!-- Error -->
    <div v-else-if="phase === 'error'" class="error-state">
      <span class="material-icons-outlined" style="font-size: 32px; color: var(--critical)">error</span>
      <p>{{ session?.error ?? 'Error desconocido' }}</p>
      <button class="action-btn" @click="router.push('/module/doc-signing/upload')">
        Volver a subir
      </button>
    </div>

    <!-- Summary phase -->
    <template v-else-if="phase === 'summary'">
      <ManualClassificationForm
        v-if="showManualFallback && !analysis"
        @classify="handleManualClassify"
      />

      <template v-if="analysis">
        <DocumentSummaryCard :analysis="analysis" />

        <div class="section-spacing">
          <h3 class="section-label">Clausulas señaladas</h3>
          <FlaggedClausesPanel :clauses="analysis.flaggedClauses" />
        </div>

        <button class="action-btn primary" @click="goToChat">
          <span class="material-icons-outlined">chat</span>
          Continuar — {{ analysis.questions.length }} preguntas
        </button>
      </template>
    </template>

    <!-- Chat phase -->
    <template v-else-if="phase === 'chat'">
      <PreSigningChat
        :messages="session?.chatMessages ?? []"
        :current-question="allQuestionsAnswered ? null : nextQuestionText"
        @answer="handleAnswer"
      />

      <div v-if="allQuestionsAnswered && session?.recommendation" class="recommendation-bar">
        <button class="action-btn primary" @click="goToSign">
          <span class="material-icons-outlined">draw</span>
          Firmar documento
        </button>
      </div>
    </template>

    <!-- Already complete -->
    <template v-else-if="phase === 'complete'">
      <div class="complete-state">
        <span class="material-icons-outlined" style="font-size: 48px; color: #4ade80">verified</span>
        <p>Documento firmado</p>
        <p class="meta-text">{{ session?.signedAt }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text, #e8eaed);
  cursor: pointer;
  padding: 4px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text, #e8eaed);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
}

.loading-text {
  font-size: 14px;
  color: var(--text-muted, #8b95a5);
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  text-align: center;
  color: var(--text, #e8eaed);
}

.section-spacing {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted, #8b95a5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: var(--text, #e8eaed);
  background: var(--bg-card, #1a1f2e);
}

.action-btn.primary {
  background: var(--primary, #594FD3);
  color: white;
}

.recommendation-bar {
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.complete-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--text, #e8eaed);
}

.meta-text {
  font-size: 12px;
  color: var(--text-muted, #8b95a5);
}
</style>
