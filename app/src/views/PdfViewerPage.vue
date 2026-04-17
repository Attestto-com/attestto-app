<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVaultStore } from '@/stores/vault'
import { signPdf, extractSignature, verifySignature } from '@/composables/usePdfSigner'
import type { AttesttoPdfSignature, VerifyResult } from '@/composables/usePdfSigner'

const route = useRoute()
const router = useRouter()
const vault = useVaultStore()
const docId = route.params.id as string

const canvasEl = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const currentPage = ref(1)
const pageCount = ref(0)
const loading = ref(false)
const error = ref('')
const pdfBytes = ref<Uint8Array | null>(null)
const fileName = ref('')

// Signing state
const signing = ref(false)
const signed = ref(false)
const signedPdfBytes = ref<Uint8Array | null>(null)
const signatureInfo = ref<AttesttoPdfSignature | null>(null)
const verifyResult = ref<VerifyResult | null>(null)
const canSign = computed(() => vault.unlocked && !!pdfBytes.value && !signing.value)

let pdfDoc: any = null
let pdfjsLib: any = null

async function loadPdfJs() {
  if (pdfjsLib) return
  pdfjsLib = await import('pdfjs-dist')
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
  }
}

async function renderPage(pageNum: number) {
  if (!pdfDoc || !canvasEl.value) return
  loading.value = true

  try {
    const page = await pdfDoc.getPage(pageNum)
    const scale = 1.5
    const viewport = page.getViewport({ scale })

    const canvas = canvasEl.value
    const ctx = canvas.getContext('2d')!
    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({ canvasContext: ctx, viewport }).promise
    currentPage.value = pageNum
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al renderizar pagina'
  } finally {
    loading.value = false
  }
}

async function openPdf(bytes: Uint8Array) {
  loading.value = true
  error.value = ''

  try {
    await loadPdfJs()
    const loadingTask = pdfjsLib.getDocument({ data: bytes })
    pdfDoc = await loadingTask.promise
    pageCount.value = pdfDoc.numPages
    pdfBytes.value = bytes
    await renderPage(1)
    await checkSignature(bytes)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al abrir PDF'
  } finally {
    loading.value = false
  }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    const bytes = new Uint8Array(reader.result as ArrayBuffer)
    openPdf(bytes)
  }
  reader.readAsArrayBuffer(file)
}

function nextPage() {
  if (currentPage.value < pageCount.value) renderPage(currentPage.value + 1)
}

function prevPage() {
  if (currentPage.value > 1) renderPage(currentPage.value - 1)
}

async function checkSignature(bytes: Uint8Array) {
  signatureInfo.value = await extractSignature(bytes)
  if (signatureInfo.value) {
    verifyResult.value = await verifySignature(bytes)
  }
}

async function handleSign() {
  if (!pdfBytes.value || signing.value) return
  signing.value = true
  error.value = ''

  try {
    const result = await signPdf({
      pdfBytes: pdfBytes.value,
      fileName: fileName.value,
      mode: 'final',
    })

    signedPdfBytes.value = result.pdfBytes
    signatureInfo.value = result.signature
    signed.value = true

    // Re-render signed PDF
    await openPdf(result.pdfBytes)
    await checkSignature(result.pdfBytes)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al firmar'
  } finally {
    signing.value = false
  }
}

function downloadSigned() {
  const bytes = signedPdfBytes.value
  if (!bytes) return

  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const base = fileName.value.replace(/\.pdf$/i, '')
  a.download = `${base}-firmado.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

onBeforeUnmount(() => {
  if (pdfDoc) pdfDoc.destroy()
})
</script>

<template>
  <q-page class="pdf-page">
    <header class="pdf-header">
      <q-btn flat round icon="arrow_back" color="white" @click="router.back()" />
      <span class="pdf-title">{{ fileName || 'Documento' }}</span>
      <q-btn flat round icon="more_vert" color="white" />
    </header>

    <!-- PDF viewport -->
    <div class="pdf-viewport">
      <!-- Empty state: file picker -->
      <div v-if="!pdfBytes && !loading" class="pdf-placeholder" @click="fileInput?.click()">
        <q-icon name="upload_file" size="64px" color="grey-6" />
        <p>Seleccionar PDF</p>
        <p class="hint">o arrastra un archivo aqui</p>
        <input
          ref="fileInput"
          type="file"
          accept="application/pdf"
          class="hidden-input"
          @change="handleFileSelect"
        />
      </div>

      <!-- Canvas for rendered PDF -->
      <canvas
        v-show="pdfBytes"
        ref="canvasEl"
        class="pdf-canvas"
      />

      <!-- Loading -->
      <div v-if="loading" class="pdf-loading">
        <q-spinner-dots size="32px" color="primary" />
      </div>

      <!-- Error -->
      <div v-if="error" class="pdf-error">
        <q-icon name="error_outline" size="32px" color="negative" />
        <p>{{ error }}</p>
      </div>
    </div>

    <!-- Navigation bar -->
    <div v-if="pageCount > 0" class="pdf-nav">
      <q-btn flat round icon="chevron_left" color="white" :disable="currentPage <= 1" @click="prevPage" />
      <span class="page-indicator">{{ currentPage }} / {{ pageCount }}</span>
      <q-btn flat round icon="chevron_right" color="white" :disable="currentPage >= pageCount" @click="nextPage" />
    </div>

    <!-- Signature status -->
    <div v-if="verifyResult" class="sig-status" :class="verifyResult.valid ? 'sig-valid' : 'sig-invalid'">
      <q-icon :name="verifyResult.valid ? 'verified' : 'error_outline'" size="18px" />
      <div class="sig-info">
        <span class="sig-label">{{ verifyResult.valid ? 'Firma verificada' : 'Firma invalida' }}</span>
        <span class="sig-detail">{{ signatureInfo?.issuerName || signatureInfo?.issuer }}</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="pdf-actions">
      <button class="action-btn ai-btn" :disabled="!pdfBytes">
        <q-icon name="smart_toy" size="20px" />
        Explicar
      </button>
      <button
        v-if="!signed"
        class="action-btn sign-btn"
        :disabled="!canSign"
        @click="handleSign"
      >
        <q-spinner-dots v-if="signing" size="20px" color="white" />
        <q-icon v-else name="draw" size="20px" />
        {{ signing ? 'Firmando...' : 'Firmar' }}
      </button>
      <button
        v-if="signed"
        class="action-btn download-btn"
        @click="downloadSigned"
      >
        <q-icon name="download" size="20px" />
        Descargar
      </button>
    </div>
  </q-page>
</template>

<style scoped>
.pdf-page {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  padding: 0;
}

.pdf-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-xs);
}

.pdf-title {
  flex: 1;
  font-weight: 600;
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdf-viewport {
  flex: 1;
  margin: 0 var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  position: relative;
}

.pdf-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-xl);
}

.pdf-placeholder:active {
  opacity: 0.7;
}

.hint {
  font-size: 12px;
}

.hidden-input {
  display: none;
}

.pdf-canvas {
  max-width: 100%;
  height: auto;
}

.pdf-loading {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pdf-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  color: var(--text-muted);
  font-size: 13px;
}

.pdf-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-xs) 0;
}

.page-indicator {
  font-size: 13px;
  font-weight: 600;
  font-family: monospace;
}

.pdf-actions {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.action-btn:disabled {
  opacity: 0.5;
}

.ai-btn {
  background: var(--bg-card);
  color: var(--text-primary);
}

.sign-btn {
  background: var(--primary);
  color: white;
}

.download-btn {
  background: var(--success);
  color: var(--bg-base);
}

.sig-status {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0 var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: 13px;
}

.sig-valid {
  background: rgba(74, 222, 128, 0.1);
  color: var(--success);
}

.sig-invalid {
  background: rgba(239, 68, 68, 0.1);
  color: var(--critical);
}

.sig-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sig-label {
  font-weight: 600;
}

.sig-detail {
  font-size: 11px;
  opacity: 0.8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}
</style>
