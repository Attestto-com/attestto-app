<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSigningSession } from '../composables/useSigningSession'
import { signDocument, generateAuditPdf } from '../composables/useDocumentSigner'
import RiskLevelIndicator from '../components/RiskLevelIndicator.vue'
import { CATEGORY_LABELS } from '../types'

const route = useRoute()
const router = useRouter()
const {
  session, pdfBytes, phase,
  updatePhase, setError, setSigningResult, loadSession,
} = useSigningSession()

const signing = ref(false)
const signError = ref('')
const signedRecord = ref<{
  pdfHash: string
  vcId: string
  anchorTx: string | null
  signedAt: string
} | null>(null)

onMounted(async () => {
  const sessionId = route.params.sessionId as string
  if (!session.value || session.value.id !== sessionId) {
    const loaded = await loadSession(sessionId)
    if (loaded) {
      session.value = loaded
    } else {
      setError('Sesion no encontrada')
    }
  }
})

async function handleSign() {
  if (!session.value || !pdfBytes.value) {
    signError.value = 'El PDF ya no esta en memoria. Sube el documento de nuevo.'
    return
  }

  signing.value = true
  signError.value = ''
  updatePhase('signing')

  try {
    const record = await signDocument(session.value, pdfBytes.value)

    setSigningResult({
      pdfHash: record.pdfHash,
      signature: record.signature,
      verificationMethod: record.verificationMethod,
      vcId: record.vcId,
      anchorTx: record.anchorTx,
    })

    signedRecord.value = {
      pdfHash: record.pdfHash,
      vcId: record.vcId,
      anchorTx: record.anchorTx,
      signedAt: record.signedAt,
    }

    // Generate audit trail PDF
    await generateAuditPdf(session.value, record)
  } catch (err) {
    signError.value = err instanceof Error ? err.message : 'Error al firmar'
    updatePhase('chat') // Go back to allow retry
  } finally {
    signing.value = false
  }
}

function goHome() {
  router.push('/home')
}

function goUpload() {
  router.push('/module/doc-signing/upload')
}
</script>

<template>
  <div class="page">
    <div class="header">
      <button class="back-btn" @click="router.back()">
        <span class="material-icons-outlined">arrow_back</span>
      </button>
      <h1 class="title">Firmar Documento</h1>
    </div>

    <!-- Pre-sign summary -->
    <template v-if="phase !== 'complete' && session?.analysis">
      <div class="sign-summary">
        <div class="summary-row">
          <span class="label">Documento</span>
          <span class="value">{{ session.fileName }}</span>
        </div>
        <div class="summary-row">
          <span class="label">Tipo</span>
          <span class="value">{{ CATEGORY_LABELS[session.analysis.documentType] }}</span>
        </div>
        <div class="summary-row">
          <span class="label">Riesgo</span>
          <RiskLevelIndicator :level="session.analysis.riskLevel" />
        </div>
        <div class="summary-row">
          <span class="label">Preguntas</span>
          <span class="value">{{ session.userAnswers.length }} / {{ session.analysis.questions.length }}</span>
        </div>
        <div v-if="session.recommendation" class="summary-row">
          <span class="label">Recomendacion</span>
          <span :class="['rec-badge', `rec-${session.recommendation}`]">
            {{ session.recommendation === 'sign' ? 'Firmar' : session.recommendation === 'review' ? 'Buscar revisor' : 'Buscar asesoria' }}
          </span>
        </div>
      </div>

      <div v-if="session.analysis.flaggedClauses.length > 0" class="warning-box">
        <span class="material-icons-outlined" style="color: var(--warning)">warning</span>
        <span>{{ session.analysis.flaggedClauses.length }} clausula(s) señalada(s). Revisa el analisis antes de firmar.</span>
      </div>

      <div v-if="signError" class="error-box">
        <span class="material-icons-outlined" style="color: var(--critical)">error</span>
        <span>{{ signError }}</span>
      </div>

      <div class="sign-method">
        <h3 class="method-title">Metodo de firma</h3>
        <div class="method-card active">
          <span class="material-icons-outlined" style="color: var(--primary)">fingerprint</span>
          <div>
            <span class="method-name">Attestto DID (Ed25519)</span>
            <span class="method-desc">Firma con tu identidad digital</span>
          </div>
        </div>
        <div class="method-card disabled">
          <span class="material-icons-outlined" style="color: var(--text-dim)">credit_card</span>
          <div>
            <span class="method-name" style="color: var(--text-dim)">Firma Digital CR (PKCS#11)</span>
            <span class="method-desc">Proximamente</span>
          </div>
        </div>
      </div>

      <button class="sign-btn" :disabled="signing" @click="handleSign">
        <q-spinner-dots v-if="signing" size="20px" color="white" />
        <span v-else class="material-icons-outlined">draw</span>
        {{ signing ? 'Firmando...' : 'Firmar con mi DID' }}
      </button>
    </template>

    <!-- Complete -->
    <template v-if="phase === 'complete' && signedRecord">
      <div class="complete-card">
        <span class="material-icons-outlined complete-icon">verified</span>
        <h2 class="complete-title">Documento firmado</h2>

        <div class="proof-section">
          <div class="proof-row">
            <span class="proof-label">Hash PDF</span>
            <span class="proof-value mono">{{ signedRecord.pdfHash.slice(0, 16) }}...</span>
          </div>
          <div class="proof-row">
            <span class="proof-label">VC ID</span>
            <span class="proof-value mono">{{ signedRecord.vcId.slice(0, 24) }}...</span>
          </div>
          <div class="proof-row">
            <span class="proof-label">Firmado</span>
            <span class="proof-value">{{ signedRecord.signedAt }}</span>
          </div>
          <div v-if="signedRecord.anchorTx" class="proof-row">
            <span class="proof-label">Solana TX</span>
            <span class="proof-value mono">{{ signedRecord.anchorTx.slice(0, 16) }}...</span>
          </div>
        </div>

        <p class="audit-note">El acta de firma se descargo automaticamente.</p>

        <div class="complete-actions">
          <button class="action-btn" @click="goUpload">Firmar otro documento</button>
          <button class="action-btn primary" @click="goHome">Ir al inicio</button>
        </div>
      </div>
    </template>

    <!-- No PDF in memory -->
    <template v-if="!pdfBytes && phase !== 'complete'">
      <div class="no-pdf">
        <span class="material-icons-outlined" style="font-size: 32px; color: var(--warning)">file_present</span>
        <p>El PDF ya no esta en memoria.</p>
        <button class="action-btn primary" @click="goUpload">Subir de nuevo</button>
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
  font-size: 18px;
  font-weight: 600;
  color: var(--text, #e8eaed);
}

.sign-summary {
  background: var(--bg-card, #1a1f2e);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #8b95a5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.value {
  font-size: 13px;
  color: var(--text, #e8eaed);
}

.rec-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
}

.rec-sign { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.rec-review { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.rec-legal-advice { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

.warning-box,
.error-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text, #e8eaed);
}

.warning-box { background: rgba(251, 191, 36, 0.08); }
.error-box { background: rgba(239, 68, 68, 0.08); }

.sign-method { display: flex; flex-direction: column; gap: 8px; }

.method-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted, #8b95a5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.method-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-card, #1a1f2e);
  border-radius: 10px;
  border: 2px solid transparent;
}

.method-card.active { border-color: var(--primary, #594FD3); }
.method-card.disabled { opacity: 0.5; }

.method-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #e8eaed);
  display: block;
}

.method-desc {
  font-size: 11px;
  color: var(--text-muted, #8b95a5);
}

.sign-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  background: var(--primary, #594FD3);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.sign-btn:disabled { opacity: 0.5; cursor: default; }

.complete-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 16px;
  text-align: center;
}

.complete-icon { font-size: 56px; color: #4ade80; }
.complete-title { font-size: 20px; color: var(--text, #e8eaed); }

.proof-section {
  width: 100%;
  background: var(--bg-card, #1a1f2e);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.proof-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.proof-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #8b95a5);
  text-transform: uppercase;
}

.proof-value {
  font-size: 12px;
  color: var(--text, #e8eaed);
}

.mono { font-family: 'JetBrains Mono', monospace; }

.audit-note {
  font-size: 12px;
  color: var(--text-muted, #8b95a5);
}

.complete-actions {
  display: flex;
  gap: 8px;
  width: 100%;
}

.action-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: var(--text, #e8eaed);
  background: var(--bg-card, #1a1f2e);
}

.action-btn.primary {
  background: var(--primary, #594FD3);
  color: white;
}

.no-pdf {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--text, #e8eaed);
}
</style>
