<template>
  <div class="page-root min-h-screen px-4 py-6">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button class="back-btn" @click="router.push('/cr-medical')">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="text-lg font-bold text-white">Dictamen emitido</h1>
    </div>

    <!-- Loading -->
    <div v-if="!draft" class="flex flex-col items-center justify-center py-20">
      <p class="text-muted">Dictamen no encontrado.</p>
      <button class="btn-primary mt-4 px-6 py-2 rounded-xl" @click="router.push('/cr-medical')">
        Volver al inicio
      </button>
    </div>

    <!-- Success state -->
    <template v-else>
      <!-- Success badge -->
      <div class="success-card rounded-2xl p-6 mb-6 text-center">
        <div class="success-icon mx-auto mb-3">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="var(--success)" opacity="0.15"/>
            <path stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/>
          </svg>
        </div>
        <h2 class="text-xl font-bold text-white mb-1">Dictamen firmado y emitido</h2>
        <p class="text-muted text-sm">
          La credencial verificable ha sido almacenada y se está anclando en la cadena de bloques.
        </p>
      </div>

      <!-- Patient summary -->
      <div class="info-card rounded-xl p-4 mb-4">
        <p class="text-xs text-muted uppercase tracking-wide mb-2">Paciente</p>
        <p class="text-white font-semibold">{{ draft.patient.nombre }} {{ draft.patient.apellidos }}</p>
        <p class="text-muted text-sm">Cédula: {{ draft.patient.cedula }}</p>
      </div>

      <!-- Result + categories -->
      <div class="info-card rounded-xl p-4 mb-4">
        <p class="text-xs text-muted uppercase tracking-wide mb-2">Resultado</p>
        <div class="flex items-center gap-2 mb-2">
          <span :class="resultBadgeClass" class="px-3 py-1 rounded-full text-sm font-bold">
            {{ resultLabel }}
          </span>
        </div>
        <p class="text-muted text-sm">
          Categorías: <span class="text-white">{{ draft.approvedCategories.join(', ') || '—' }}</span>
        </p>
        <p v-if="draft.restrictions.length" class="text-muted text-sm mt-1">
          Restricciones: <span class="text-white">{{ draft.restrictions.join(', ') }}</span>
        </p>
      </div>

      <!-- Dates -->
      <div class="info-card rounded-xl p-4 mb-4">
        <div class="flex justify-between text-sm">
          <span class="text-muted">Fecha de examen</span>
          <span class="text-white">{{ formatDate(draft.examDate) }}</span>
        </div>
        <div class="flex justify-between text-sm mt-2">
          <span class="text-muted">Válido hasta</span>
          <span class="text-white">{{ formatDate(draft.expiresAt) }}</span>
        </div>
      </div>

      <!-- Doctor info -->
      <div class="info-card rounded-xl p-4 mb-4">
        <p class="text-xs text-muted uppercase tracking-wide mb-2">Emisor</p>
        <p class="text-white text-sm font-medium">Dr. {{ draft.doctor.nombre }} {{ draft.doctor.apellidos }}</p>
        <p class="text-muted text-xs">Colegiado #{{ draft.doctor.numeroColegiado }}</p>
        <p v-if="draft.doctor.especialidad" class="text-muted text-xs">{{ draft.doctor.especialidad }}</p>
      </div>

      <!-- Anchor status -->
      <div class="info-card rounded-xl p-4 mb-6">
        <div class="flex items-center gap-2">
          <div v-if="draft.status === 'anchored'" class="flex items-center gap-2">
            <svg width="16" height="16" fill="var(--success)" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
            </svg>
            <span class="text-sm" style="color: var(--success)">Anclado en Solana</span>
          </div>
          <div v-else class="flex items-center gap-2">
            <div class="anchor-spinner"></div>
            <span class="text-muted text-sm">Anclando en cadena de bloques…</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-3">
        <button class="btn-primary w-full rounded-xl py-3 font-semibold" @click="router.push('/cr-medical')">
          Volver al panel
        </button>
        <button class="btn-secondary w-full rounded-xl py-3 font-semibold" @click="router.push('/cr-medical/historial')">
          Ver historial
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDictamenStore } from '../stores/dictamen.store'

const router = useRouter()
const route = useRoute()
const store = useDictamenStore()

const draftId = route.params.draftId as string
const draft = computed(() => store.drafts.find((d) => d.draftId === draftId) ?? null)

const resultLabel = computed(() => {
  switch (draft.value?.results.overallResult) {
    case 'pass': return 'APTO'
    case 'conditional': return 'APTO CONDICIONAL'
    case 'fail': return 'NO APTO'
    default: return '—'
  }
})

const resultBadgeClass = computed(() => {
  switch (draft.value?.results.overallResult) {
    case 'pass': return 'badge-pass'
    case 'conditional': return 'badge-conditional'
    case 'fail': return 'badge-fail'
    default: return 'badge-neutral'
  }
})

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return iso }
}
</script>

<style scoped>
.page-root { background: var(--bg-base); color: var(--text-primary); }
.text-muted { color: var(--text-muted); }
.back-btn { color: var(--text-muted); background: none; border: none; cursor: pointer; }

.success-card { background: rgba(74, 222, 128, 0.05); border: 1px solid rgba(74, 222, 128, 0.15); }
.info-card { background: var(--bg-card); border: 1px solid var(--border-subtle, rgba(255,255,255,0.06)); }

.badge-pass { background: rgba(74, 222, 128, 0.15); color: var(--success); }
.badge-conditional { background: rgba(250, 204, 21, 0.15); color: #facc15; }
.badge-fail { background: rgba(239, 68, 68, 0.15); color: var(--critical); }
.badge-neutral { background: rgba(255,255,255,0.05); color: var(--text-muted); }

.btn-primary { background: var(--primary); color: white; border: none; cursor: pointer; }
.btn-secondary { background: var(--bg-card); color: var(--text-muted); border: 1px solid var(--border-subtle, rgba(255,255,255,0.06)); cursor: pointer; }

.anchor-spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--text-muted);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
