<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAgreementSession } from '../composables/useAgreementSession'
import { analyzeConversation, buildManualDraft, getLlmStatus } from '../composables/useConversationAnalyzer'
import AgreementTermsCard from '../components/AgreementTermsCard.vue'
import AmbiguityWarnings from '../components/AmbiguityWarnings.vue'
import DraftEditor from '../components/DraftEditor.vue'
import type { AgreementType, AgreementDraft } from '../types'
import { AGREEMENT_TYPE_LABELS } from '../types'

const route = useRoute()
const router = useRouter()
const {
  session, phase, draft,
  updatePhase, setError, setDraft, setEditedDraft, loadSession,
} = useAgreementSession()

const showManualFallback = ref(false)
const isEditing = computed(() => session.value?.phase === 'editing')

onMounted(async () => {
  const sessionId = route.params.sessionId as string

  if (!session.value || session.value.id !== sessionId) {
    const loaded = await loadSession(sessionId)
    if (loaded) {
      session.value = loaded
      if (loaded.phase !== 'input') return
    } else {
      setError('Sesion no encontrada.')
      return
    }
  }

  if (session.value.phase === 'input') {
    await runAnalysis()
  }
})

async function runAnalysis() {
  if (!session.value) return

  const llm = getLlmStatus()
  if (!llm.supported || !llm.available) {
    showManualFallback.value = true
    updatePhase('draft')
    return
  }

  updatePhase('analyzing')
  try {
    const result = await analyzeConversation(
      session.value.conversationText,
      session.value.conversationSource,
    )
    if (result) {
      setDraft(result)
      updatePhase('draft')
    } else {
      showManualFallback.value = true
      updatePhase('draft')
    }
  } catch {
    showManualFallback.value = true
    updatePhase('draft')
  }
}

function handleManualCreate(type: AgreementType) {
  const manual = buildManualDraft(type)
  setDraft(manual)
  showManualFallback.value = false
  updatePhase('editing')
}

function startEditing() {
  updatePhase('editing')
}

function handleSaveEdit(edited: AgreementDraft) {
  setEditedDraft(edited)
  updatePhase('draft')
}

function cancelEdit() {
  updatePhase('draft')
}

function goToSign() {
  router.push(`/module/agreement/sign/${session.value!.id}`)
}
</script>

<template>
  <div class="page">
    <div class="header">
      <button class="back-btn" @click="router.push('/module/agreement/input')">
        <span class="material-icons-outlined">arrow_back</span>
      </button>
      <h1 class="title">Borrador del Acuerdo</h1>
    </div>

    <!-- Analyzing -->
    <div v-if="phase === 'analyzing'" class="loading-state">
      <q-spinner-dots size="32px" color="primary" />
      <p class="loading-text">Analizando conversacion con IA...</p>
    </div>

    <!-- Error -->
    <div v-else-if="phase === 'error'" class="error-state">
      <span class="material-icons-outlined" style="font-size: 32px; color: var(--critical)">error</span>
      <p>{{ session?.error ?? 'Error desconocido' }}</p>
      <button class="action-btn" @click="router.push('/module/agreement/input')">Volver al inicio</button>
    </div>

    <!-- Manual fallback -->
    <template v-else-if="showManualFallback && !draft">
      <div class="manual-fallback">
        <div class="manual-header">
          <span class="material-icons-outlined" style="color: var(--warning, #fbbf24)">psychology_alt</span>
          <span class="manual-title">Clasificacion manual</span>
        </div>
        <p class="manual-desc">La IA no esta disponible. Selecciona el tipo de acuerdo para crear un borrador vacio que puedes editar.</p>
        <div class="type-grid">
          <button
            v-for="[val, lbl] in Object.entries(AGREEMENT_TYPE_LABELS) as [AgreementType, string][]"
            :key="val"
            class="type-btn"
            @click="handleManualCreate(val)"
          >{{ lbl }}</button>
        </div>
      </div>
    </template>

    <!-- Draft view -->
    <template v-else-if="(phase === 'draft' || phase === 'editing') && draft">
      <template v-if="!isEditing">
        <AgreementTermsCard :draft="draft" />
        <AmbiguityWarnings :ambiguities="draft.ambiguities" :undiscussed-terms="draft.undiscussedTerms" />

        <div class="action-row">
          <button class="action-btn" @click="startEditing">
            <span class="material-icons-outlined">edit</span> Editar borrador
          </button>
          <button class="action-btn primary" @click="goToSign">
            <span class="material-icons-outlined">draw</span> Firmar acuerdo
          </button>
        </div>
      </template>

      <template v-else>
        <DraftEditor :draft="draft" @save="handleSaveEdit" @cancel="cancelEdit" />
      </template>
    </template>

    <!-- Complete -->
    <template v-else-if="phase === 'complete'">
      <div class="complete-state">
        <span class="material-icons-outlined" style="font-size: 48px; color: #4ade80">verified</span>
        <p>Acuerdo firmado</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page { padding: 16px; max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.header { display: flex; align-items: center; gap: 12px; }
.back-btn { background: none; border: none; color: var(--text, #e8eaed); cursor: pointer; padding: 4px; }
.title { font-size: 16px; font-weight: 600; color: var(--text, #e8eaed); flex: 1; }
.loading-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 20px; }
.loading-text { font-size: 14px; color: var(--text-muted, #8b95a5); }
.error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 20px; text-align: center; color: var(--text, #e8eaed); }
.manual-fallback { background: var(--bg-card, #1a1f2e); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.manual-header { display: flex; align-items: center; gap: 8px; }
.manual-title { font-size: 14px; font-weight: 600; color: var(--text, #e8eaed); }
.manual-desc { font-size: 12px; color: var(--text-muted, #8b95a5); }
.type-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.type-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--text, #e8eaed); border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
.type-btn:hover { border-color: var(--primary, #594FD3); }
.action-row { display: flex; gap: 8px; }
.action-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 16px; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--text, #e8eaed); background: var(--bg-card, #1a1f2e); }
.action-btn.primary { background: var(--primary, #594FD3); color: white; }
.complete-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; color: var(--text, #e8eaed); }
</style>
