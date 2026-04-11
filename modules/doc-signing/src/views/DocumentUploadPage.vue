<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSigningSession } from '../composables/useSigningSession'
import { getLlmStatus } from '../composables/usePdfAnalyzer'
import RiskLevelIndicator from '../components/RiskLevelIndicator.vue'
import type { RiskLevel } from '../types'

const router = useRouter()
const { createSession, loadSessionIndex } = useSigningSession()
const fileInput = ref<HTMLInputElement | null>(null)
const recentSessions = ref<{ id: string; fileName: string; phase: string; riskLevel: string | null; createdAt: number; signedAt: string | null }[]>([])

const llmStatus = getLlmStatus()

onMounted(async () => {
  recentSessions.value = await loadSessionIndex()
})

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const bytes = new Uint8Array(reader.result as ArrayBuffer)
    const session = createSession(file.name, bytes)
    router.push(`/module/doc-signing/analysis/${session.id}`)
  }
  reader.readAsArrayBuffer(file)
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files[0]
  if (!file || file.type !== 'application/pdf') return

  const reader = new FileReader()
  reader.onload = () => {
    const bytes = new Uint8Array(reader.result as ArrayBuffer)
    const session = createSession(file.name, bytes)
    router.push(`/module/doc-signing/analysis/${session.id}`)
  }
  reader.readAsArrayBuffer(file)
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const phaseLabels: Record<string, string> = {
  upload: 'Subido',
  extracting: 'Extrayendo...',
  analyzing: 'Analizando...',
  summary: 'Analizado',
  chat: 'En preguntas',
  signing: 'Firmando...',
  anchoring: 'Anclando...',
  complete: 'Firmado',
  error: 'Error',
}
</script>

<template>
  <div class="page">
    <div class="header">
      <button class="back-btn" @click="router.back()">
        <span class="material-icons-outlined">arrow_back</span>
      </button>
      <h1 class="title">Firma Inteligente</h1>
      <span
        :class="['llm-chip', llmStatus.available ? 'llm-ready' : 'llm-off']"
      >
        {{ llmStatus.available ? 'IA lista' : llmStatus.supported ? 'IA inactiva' : 'Sin IA' }}
      </span>
    </div>

    <div
      class="upload-zone"
      @click="triggerFileInput"
      @drop="handleDrop"
      @dragover="handleDragOver"
    >
      <span class="material-icons-outlined upload-icon">upload_file</span>
      <p class="upload-text">Selecciona o arrastra un PDF</p>
      <p class="upload-hint">El archivo se analiza localmente — nada se sube a un servidor</p>
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf"
        style="display: none"
        @change="handleFileSelect"
      />
    </div>

    <div v-if="recentSessions.length > 0" class="recent-section">
      <h2 class="section-title">Sesiones recientes</h2>
      <div
        v-for="s in recentSessions"
        :key="s.id"
        class="session-card"
        @click="router.push(`/module/doc-signing/analysis/${s.id}`)"
      >
        <span class="material-icons-outlined session-icon">
          {{ s.phase === 'complete' ? 'check_circle' : s.phase === 'error' ? 'error' : 'pending_actions' }}
        </span>
        <div class="session-info">
          <span class="session-name">{{ s.fileName }}</span>
          <span class="session-date">{{ formatDate(s.createdAt) }}</span>
        </div>
        <div class="session-badges">
          <RiskLevelIndicator v-if="s.riskLevel" :level="s.riskLevel as RiskLevel" />
          <span class="phase-badge">{{ phaseLabels[s.phase] ?? s.phase }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text, #e8eaed);
  cursor: pointer;
  padding: 4px;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text, #e8eaed);
  flex: 1;
}

.llm-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.llm-ready {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.llm-off {
  background: rgba(139, 149, 165, 0.15);
  color: #8b95a5;
}

.upload-zone {
  border: 2px dashed rgba(89, 79, 211, 0.4);
  border-radius: 16px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}

.upload-zone:hover {
  border-color: var(--primary, #594FD3);
}

.upload-icon {
  font-size: 48px;
  color: var(--primary, #594FD3);
}

.upload-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text, #e8eaed);
  margin: 8px 0 4px;
}

.upload-hint {
  font-size: 12px;
  color: var(--text-muted, #8b95a5);
}

.recent-section {
  margin-top: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted, #8b95a5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.session-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--bg-card, #1a1f2e);
  border-radius: 10px;
  margin-bottom: 8px;
  cursor: pointer;
}

.session-icon {
  font-size: 20px;
  color: var(--text-muted, #8b95a5);
}

.session-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.session-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text, #e8eaed);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.session-date {
  font-size: 11px;
  color: var(--text-dim, #5a6577);
}

.session-badges {
  display: flex;
  gap: 6px;
  align-items: center;
}

.phase-badge {
  font-size: 11px;
  color: var(--text-muted, #8b95a5);
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 6px;
  border-radius: 6px;
}
</style>
