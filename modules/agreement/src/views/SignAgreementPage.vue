<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAgreementSession } from '../composables/useAgreementSession'
import { signAgreement, generateAuditPdf } from '../composables/useAgreementSigner'
import { AGREEMENT_TYPE_LABELS, AGREEMENT_DEFAULT_RISK, RISK_LABELS } from '../types'

const route = useRoute()
const router = useRouter()
const { session, phase, draft, updatePhase, setError, setSigningResult, loadSession } = useAgreementSession()

const signing = ref(false)
const signError = ref('')
const signedRecord = ref<{ agreementHash: string; vcId: string; anchorTx: string | null; signedAt: string } | null>(null)

onMounted(async () => {
  const sessionId = route.params.sessionId as string
  if (!session.value || session.value.id !== sessionId) {
    const loaded = await loadSession(sessionId)
    if (loaded) { session.value = loaded } else { setError('Sesion no encontrada') }
  }
})

async function handleSign() {
  if (!session.value || !draft.value) return
  signing.value = true
  signError.value = ''
  updatePhase('signing')

  try {
    const record = await signAgreement(session.value)
    setSigningResult({
      agreementHash: record.agreementHash,
      signature: record.signature,
      vcId: record.vcId,
      anchorTx: record.anchorTx,
    })
    signedRecord.value = {
      agreementHash: record.agreementHash,
      vcId: record.vcId,
      anchorTx: record.anchorTx,
      signedAt: record.signedAt,
    }
    await generateAuditPdf(session.value, record)
  } catch (err) {
    signError.value = err instanceof Error ? err.message : 'Error al firmar'
    updatePhase('draft')
  } finally {
    signing.value = false
  }
}

const riskColors: Record<string, string> = { low: '#4ade80', medium: '#fbbf24', high: '#f97316', critical: '#ef4444' }
</script>

<template>
  <div class="page">
    <div class="header">
      <button class="back-btn" @click="router.back()"><span class="material-icons-outlined">arrow_back</span></button>
      <h1 class="title">Firmar Acuerdo</h1>
    </div>

    <!-- Pre-sign -->
    <template v-if="phase !== 'complete' && draft">
      <div class="sign-summary">
        <div class="row"><span class="label">Tipo</span><span class="value">{{ AGREEMENT_TYPE_LABELS[draft.type] }}</span></div>
        <div class="row"><span class="label">Riesgo</span><span class="risk" :style="{ color: riskColors[AGREEMENT_DEFAULT_RISK[draft.type]] }">{{ RISK_LABELS[AGREEMENT_DEFAULT_RISK[draft.type]] }}</span></div>
        <div class="row"><span class="label">Partes</span><span class="value">{{ draft.parties.map(p => p.name).join(', ') || 'No identificadas' }}</span></div>
        <div class="row"><span class="label">Terminos</span><span class="value">{{ draft.terms.length }}</span></div>
        <div v-if="draft.ambiguities.length > 0" class="row"><span class="label">Ambiguedades</span><span class="value" style="color: #fbbf24">{{ draft.ambiguities.length }}</span></div>
      </div>

      <div v-if="signError" class="error-box">
        <span class="material-icons-outlined" style="color: #ef4444">error</span>
        <span>{{ signError }}</span>
      </div>

      <div class="sign-method">
        <div class="method-card active">
          <span class="material-icons-outlined" style="color: var(--primary)">fingerprint</span>
          <div><span class="method-name">Attestto DID (Ed25519)</span><span class="method-desc">Firma con tu identidad digital</span></div>
        </div>
      </div>

      <button class="sign-btn" :disabled="signing" @click="handleSign">
        <q-spinner-dots v-if="signing" size="20px" color="white" />
        <span v-else class="material-icons-outlined">draw</span>
        {{ signing ? 'Firmando...' : 'Firmar acuerdo' }}
      </button>
    </template>

    <!-- Complete -->
    <template v-if="phase === 'complete' && signedRecord">
      <div class="complete-card">
        <span class="material-icons-outlined" style="font-size: 56px; color: #4ade80">verified</span>
        <h2 class="complete-title">Acuerdo firmado</h2>

        <div class="proof-section">
          <div class="proof-row"><span class="proof-label">Hash</span><span class="proof-value mono">{{ signedRecord.agreementHash.slice(0, 16) }}...</span></div>
          <div class="proof-row"><span class="proof-label">VC ID</span><span class="proof-value mono">{{ signedRecord.vcId.slice(0, 24) }}...</span></div>
          <div class="proof-row"><span class="proof-label">Firmado</span><span class="proof-value">{{ signedRecord.signedAt }}</span></div>
          <div v-if="signedRecord.anchorTx" class="proof-row"><span class="proof-label">Solana</span><span class="proof-value mono">{{ signedRecord.anchorTx.slice(0, 16) }}...</span></div>
        </div>

        <p class="audit-note">El acta de acuerdo se descargo automaticamente.</p>

        <div class="complete-actions">
          <button class="action-btn" @click="router.push('/module/agreement/input')">Crear otro acuerdo</button>
          <button class="action-btn primary" @click="router.push('/home')">Ir al inicio</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 16px; max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.header { display: flex; align-items: center; gap: 12px; }
.back-btn { background: none; border: none; color: var(--text, #e8eaed); cursor: pointer; padding: 4px; }
.title { font-size: 18px; font-weight: 600; color: var(--text, #e8eaed); }
.sign-summary { background: var(--bg-card, #1a1f2e); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; justify-content: space-between; align-items: center; }
.label { font-size: 12px; font-weight: 600; color: var(--text-muted, #8b95a5); text-transform: uppercase; letter-spacing: 0.5px; }
.value { font-size: 13px; color: var(--text, #e8eaed); }
.risk { font-size: 12px; font-weight: 700; text-transform: uppercase; }
.error-box { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; background: rgba(239,68,68,0.08); font-size: 13px; color: var(--text, #e8eaed); }
.sign-method { display: flex; flex-direction: column; gap: 8px; }
.method-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-card, #1a1f2e); border-radius: 10px; border: 2px solid var(--primary, #594FD3); }
.method-name { font-size: 13px; font-weight: 600; color: var(--text, #e8eaed); display: block; }
.method-desc { font-size: 11px; color: var(--text-muted, #8b95a5); }
.sign-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 24px; background: var(--primary, #594FD3); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; }
.sign-btn:disabled { opacity: 0.5; cursor: default; }
.complete-card { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px 16px; text-align: center; }
.complete-title { font-size: 20px; color: var(--text, #e8eaed); }
.proof-section { width: 100%; background: var(--bg-card, #1a1f2e); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.proof-row { display: flex; justify-content: space-between; align-items: center; }
.proof-label { font-size: 11px; font-weight: 600; color: var(--text-muted, #8b95a5); text-transform: uppercase; }
.proof-value { font-size: 12px; color: var(--text, #e8eaed); }
.mono { font-family: 'JetBrains Mono', monospace; }
.audit-note { font-size: 12px; color: var(--text-muted, #8b95a5); }
.complete-actions { display: flex; gap: 8px; width: 100%; }
.action-btn { flex: 1; padding: 10px 16px; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--text, #e8eaed); background: var(--bg-card, #1a1f2e); }
.action-btn.primary { background: var(--primary, #594FD3); color: white; }
</style>
