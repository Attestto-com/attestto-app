<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAgreementSession } from '../composables/useAgreementSession'
import { getLlmStatus } from '../composables/useConversationAnalyzer'
import type { ConversationSource } from '../types'
import { SOURCE_LABELS, AGREEMENT_TYPE_LABELS } from '../types'

const router = useRouter()
const { createSession, loadSessionIndex } = useAgreementSession()

const text = ref('')
const source = ref<ConversationSource>('whatsapp')
const recentSessions = ref<{ id: string; phase: string; agreementType: string | null; partySummary: string; createdAt: number }[]>([])

const llmStatus = getLlmStatus()
const sources = Object.entries(SOURCE_LABELS) as [ConversationSource, string][]

const placeholders: Record<ConversationSource, string> = {
  whatsapp: '[11/4/26, 14:05] Alice: entonces confirmamos $5,000 total?\n[11/4/26, 14:06] Bob: si, $5,000, mitad al inicio mitad al entregar...',
  email: 'De: alice@example.com\nPara: bob@example.com\nAsunto: Re: Propuesta de servicios\n\nHola Bob, confirmo los terminos...',
  voice_transcript: 'Alice: Bueno, entonces quedamos en cinco mil dolares por el proyecto completo.\nBob: Si, cinco mil, y la entrega seria para el quince de junio...',
  typed: 'Acordamos lo siguiente entre [nombre 1] y [nombre 2]:\n- Servicio: ...\n- Precio: ...\n- Plazo: ...',
  other: 'Pega aqui la conversacion o escribe los terminos acordados...',
}

onMounted(async () => {
  recentSessions.value = await loadSessionIndex()
})

function analyze() {
  if (text.value.trim().length < 50) return
  const session = createSession(text.value, source.value)
  router.push(`/module/agreement/draft/${session.id}`)
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="page">
    <div class="header">
      <button class="back-btn" @click="router.back()">
        <span class="material-icons-outlined">arrow_back</span>
      </button>
      <h1 class="title">Acuerdo Conversacional</h1>
      <span :class="['llm-chip', llmStatus.available ? 'llm-ready' : 'llm-off']">
        {{ llmStatus.available ? 'IA lista' : llmStatus.supported ? 'IA inactiva' : 'Sin IA' }}
      </span>
    </div>

    <div class="source-selector">
      <span class="source-label">Fuente de la conversacion</span>
      <div class="source-chips">
        <button
          v-for="[val, lbl] in sources"
          :key="val"
          :class="['source-chip', source === val && 'active']"
          @click="source = val"
        >{{ lbl }}</button>
      </div>
    </div>

    <textarea
      v-model="text"
      class="conversation-input"
      :placeholder="placeholders[source]"
      rows="12"
    />

    <div class="input-footer">
      <span class="char-count">{{ text.length }} caracteres</span>
      <span class="privacy-note">El texto se analiza localmente — nada se envia a un servidor</span>
    </div>

    <button class="analyze-btn" :disabled="text.trim().length < 50" @click="analyze">
      <span class="material-icons-outlined">psychology</span>
      Analizar conversacion
    </button>

    <div v-if="recentSessions.length > 0" class="recent-section">
      <h2 class="section-title">Acuerdos recientes</h2>
      <div
        v-for="s in recentSessions"
        :key="s.id"
        class="session-card"
        @click="router.push(`/module/agreement/draft/${s.id}`)"
      >
        <span class="material-icons-outlined session-icon">
          {{ s.phase === 'complete' ? 'check_circle' : s.phase === 'error' ? 'error' : 'pending_actions' }}
        </span>
        <div class="session-info">
          <span class="session-name">{{ s.partySummary || (s.agreementType ? AGREEMENT_TYPE_LABELS[s.agreementType as keyof typeof AGREEMENT_TYPE_LABELS] : 'Acuerdo') }}</span>
          <span class="session-date">{{ formatDate(s.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 16px; max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
.header { display: flex; align-items: center; gap: 12px; }
.back-btn { background: none; border: none; color: var(--text, #e8eaed); cursor: pointer; padding: 4px; }
.title { font-size: 20px; font-weight: 700; color: var(--text, #e8eaed); flex: 1; }
.llm-chip { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.llm-ready { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.llm-off { background: rgba(139, 149, 165, 0.15); color: #8b95a5; }
.source-selector { display: flex; flex-direction: column; gap: 6px; }
.source-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #8b95a5); }
.source-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.source-chip { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted, #8b95a5); border-radius: 16px; padding: 4px 12px; font-size: 12px; cursor: pointer; }
.source-chip.active { background: rgba(89,79,211,0.2); border-color: var(--primary, #594FD3); color: var(--primary, #594FD3); font-weight: 600; }
.conversation-input { background: var(--bg-card, #1a1f2e); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; color: var(--text, #e8eaed); font-size: 13px; font-family: 'JetBrains Mono', monospace; line-height: 1.6; resize: vertical; outline: none; }
.conversation-input:focus { border-color: var(--primary, #594FD3); }
.input-footer { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim, #5a6577); }
.char-count { font-family: 'JetBrains Mono', monospace; }
.analyze-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; background: var(--primary, #594FD3); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
.analyze-btn:disabled { opacity: 0.4; cursor: default; }
.recent-section { margin-top: 12px; }
.section-title { font-size: 13px; font-weight: 600; color: var(--text-muted, #8b95a5); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
.session-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-card, #1a1f2e); border-radius: 8px; margin-bottom: 6px; cursor: pointer; }
.session-icon { font-size: 18px; color: var(--text-muted, #8b95a5); }
.session-info { flex: 1; display: flex; flex-direction: column; }
.session-name { font-size: 13px; font-weight: 500; color: var(--text, #e8eaed); }
.session-date { font-size: 11px; color: var(--text-dim, #5a6577); }
</style>
