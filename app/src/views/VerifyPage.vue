<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface VerifyResult {
  valid: boolean
  type: string
  holder: string
  issuer: string
  active: boolean
  signatureValid: boolean
  anchored: boolean
}

const result = ref<VerifyResult | null>(null)
const scanning = ref(true)

function handleScan() {
  // TODO: integrate camera QR scanning
  // For now, simulate
  scanning.value = false
  result.value = {
    valid: true,
    type: 'Licencia B1',
    holder: 'Juan Mora',
    issuer: 'COSEVI',
    active: true,
    signatureValid: true,
    anchored: true,
  }
}
</script>

<template>
  <q-page class="verify-page" padding>
    <header class="verify-header">
      <q-btn flat round icon="arrow_back" color="white" @click="router.back()" />
      <span class="verify-title">Verificar</span>
    </header>

    <!-- Scanner -->
    <div v-if="scanning" class="scanner-area" @click="handleScan">
      <div class="scanner-frame">
        <q-icon name="qr_code_scanner" size="64px" color="grey-6" />
        <p>Escana el QR de la credencial</p>
      </div>
    </div>

    <!-- Result -->
    <div v-if="result" class="result-card" :class="{ valid: result.valid, invalid: !result.valid }">
      <div class="result-header">
        <q-icon
          :name="result.valid ? 'verified' : 'cancel'"
          size="32px"
          :color="result.valid ? 'positive' : 'negative'"
        />
        <span class="result-label">
          {{ result.valid ? 'CREDENCIAL VALIDA' : 'CREDENCIAL INVALIDA' }}
        </span>
      </div>

      <div class="result-fields">
        <div class="field">
          <span class="field-label">Tipo</span>
          <span class="field-value">{{ result.type }}</span>
        </div>
        <div class="field">
          <span class="field-label">Titular</span>
          <span class="field-value">{{ result.holder }}</span>
        </div>
        <div class="field">
          <span class="field-label">Emisor</span>
          <span class="field-value">{{ result.issuer }}</span>
        </div>
        <div class="field">
          <span class="field-label">Vigente</span>
          <span class="field-value">{{ result.active ? 'Si' : 'No' }}</span>
        </div>
        <div class="field">
          <span class="field-label">Firma</span>
          <span class="field-value" :style="{ color: result.signatureValid ? 'var(--success)' : 'var(--critical)' }">
            {{ result.signatureValid ? 'valida' : 'invalida' }}
          </span>
        </div>
        <div class="field">
          <span class="field-label">Ancla</span>
          <span class="field-value" :style="{ color: result.anchored ? 'var(--success)' : 'var(--text-muted)' }">
            {{ result.anchored ? 'Solana' : 'N/A' }}
          </span>
        </div>
      </div>

      <button class="scan-again-btn" @click="result = null; scanning = true">
        Escanear otra
      </button>
    </div>
  </q-page>
</template>

<style scoped>
.verify-page {
  display: flex;
  flex-direction: column;
}

.verify-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.verify-title {
  font-size: 18px;
  font-weight: 600;
}

.scanner-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  cursor: pointer;
}

.scanner-frame {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  color: var(--text-muted);
  font-size: 14px;
}

.result-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.result-card.valid {
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.result-card.invalid {
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.result-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.result-label {
  font-size: 16px;
  font-weight: 700;
}

.result-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.field {
  display: flex;
  justify-content: space-between;
  padding: var(--space-xs) 0;
  border-bottom: 1px solid var(--border-subtle);
}

.field-label {
  color: var(--text-muted);
  font-size: 13px;
}

.field-value {
  font-size: 13px;
  font-weight: 500;
}

.scan-again-btn {
  width: 100%;
  margin-top: var(--space-lg);
  padding: var(--space-md);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
</style>
