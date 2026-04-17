<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVaultStore } from '@/stores/vault'
import * as crypto from '@/composables/useCrypto'
import { buildPresentation } from '@attestto/vc-sdk'

const route = useRoute()
const router = useRouter()
const vault = useVaultStore()

const showQr = ref(false)
const qrDataUrl = ref<string | null>(null)
const qrError = ref('')

async function generateQr() {
  if (!credential.value || !vault.did) return
  qrError.value = ''

  try {
    const privKey = crypto.getPrivateKeyBytes()
    const nonce = globalThis.crypto.randomUUID()
    const vp = buildPresentation([credential.value as any], {
      holderDid: vault.did,
      privateKey: privKey,
      algorithm: 'Ed25519',
      nonce,
    })

    const vpJson = JSON.stringify(vp)
    const QRCode = await import('qrcode')
    qrDataUrl.value = await QRCode.toDataURL(vpJson, {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'L',
    })
    showQr.value = true
  } catch (e: unknown) {
    qrError.value = e instanceof Error ? e.message : 'Error al generar QR'
  }
}

const credential = computed(() =>
  vault.credentials.find((vc) => vc.id === route.params.id),
)

const issuerName = computed(() => {
  if (!credential.value) return ''
  if (typeof credential.value.issuer === 'string') return credential.value.issuer
  return credential.value.issuer.name ?? credential.value.issuer.id
})

const mainType = computed(() => {
  if (!credential.value) return ''
  const types = credential.value.type.filter((t) => t !== 'VerifiableCredential')
  return types[0] ?? 'Credential'
})

const fields = computed(() => {
  if (!credential.value) return []
  const subject = credential.value.credentialSubject
  return Object.entries(subject)
    .filter(([key]) => key !== 'id')
    .map(([key, value]) => ({
      key: key.charAt(0).toUpperCase() + key.slice(1),
      value: String(value),
    }))
})

const statusColor = computed(() => {
  switch (credential.value?.revocationStatus) {
    case 'valid': return 'var(--success)'
    case 'revoked': return 'var(--critical)'
    default: return 'var(--text-muted)'
  }
})

const statusLabel = computed(() => {
  switch (credential.value?.revocationStatus) {
    case 'valid': return 'Verificada'
    case 'revoked': return 'Revocada'
    default: return 'Sin verificar'
  }
})
</script>

<template>
  <q-page class="detail-page" padding>
    <header class="detail-header">
      <q-btn flat round icon="arrow_back" color="white" @click="router.back()" />
      <span class="detail-title">{{ mainType }}</span>
    </header>

    <template v-if="credential">
      <!-- Demo indicator -->
      <div v-if="credential.id?.includes('demo')" class="demo-badge">
        <q-icon name="science" size="14px" />
        <div>
          <div>Datos de ejemplo — no son reales</div>
          <div class="demo-install">Instala la app como PWA para crear tu identidad real</div>
        </div>
      </div>

      <!-- Status badge -->
      <div class="status-badge" :style="{ borderColor: statusColor }">
        <q-icon
          :name="credential.revocationStatus === 'valid' ? 'verified' : 'help_outline'"
          size="20px"
          :style="{ color: statusColor }"
        />
        <span :style="{ color: statusColor }">{{ statusLabel }}</span>
      </div>

      <!-- Issuer -->
      <div class="info-section">
        <div class="info-label">Emisor</div>
        <div class="info-value">{{ issuerName }}</div>
      </div>

      <!-- Dates -->
      <div class="info-row">
        <div class="info-section">
          <div class="info-label">Emitida</div>
          <div class="info-value">{{ credential.issuanceDate.slice(0, 10) }}</div>
        </div>
        <div v-if="credential.expirationDate" class="info-section">
          <div class="info-label">Vence</div>
          <div class="info-value">{{ credential.expirationDate.slice(0, 10) }}</div>
        </div>
      </div>

      <!-- Subject fields -->
      <div class="fields-section">
        <div class="info-label">Datos</div>
        <div class="fields-card">
          <div v-for="field in fields" :key="field.key" class="field-row">
            <span class="field-key">{{ field.key }}</span>
            <span class="field-val">{{ field.value }}</span>
          </div>
        </div>
      </div>

      <!-- DID -->
      <div class="info-section">
        <div class="info-label">DID del titular</div>
        <div class="info-value mono">{{ credential.credentialSubject.id }}</div>
      </div>

      <!-- QR code for credential sharing -->
      <div class="qr-section">
        <q-btn
          v-if="!showQr"
          unelevated
          icon="qr_code_2"
          label="Mostrar QR"
          color="primary"
          :disable="!vault.unlocked"
          @click="generateQr"
        />
        <div v-if="showQr && qrDataUrl" class="qr-display">
          <img :src="qrDataUrl" alt="QR de credencial" class="qr-image" />
          <p class="qr-hint">Un verificador puede escanear este codigo</p>
          <q-btn flat dense label="Ocultar" color="grey" @click="showQr = false" />
        </div>
        <p v-if="qrError" class="qr-error">{{ qrError }}</p>
      </div>
    </template>

    <div v-else class="not-found">
      <p>Credencial no encontrada</p>
    </div>
  </q-page>
</template>

<style scoped>
.detail-page {
  padding-bottom: 40px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
}

.status-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid;
  border-radius: var(--radius-full);
  font-size: 14px;
  font-weight: 600;
  margin-bottom: var(--space-lg);
  width: fit-content;
}

.info-section {
  margin-bottom: var(--space-md);
}

.info-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.info-value {
  font-size: 15px;
  font-weight: 500;
}

.info-value.mono {
  font-family: monospace;
  font-size: 13px;
  word-break: break-all;
}

.info-row {
  display: flex;
  gap: var(--space-xl);
}

.fields-section {
  margin-bottom: var(--space-md);
}

.fields-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.field-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border-subtle);
}

.field-row:last-child {
  border-bottom: none;
}

.field-key {
  font-size: 13px;
  color: var(--text-muted);
}

.field-val {
  font-size: 13px;
  font-weight: 500;
}

.qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: var(--space-lg);
  gap: var(--space-md);
}

.qr-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-lg);
}

.qr-image {
  border-radius: var(--radius-sm);
}

.qr-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.qr-error {
  font-size: 13px;
  color: var(--critical);
}

.demo-badge {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--warning);
  margin-bottom: var(--space-md);
}

.demo-install {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.not-found {
  text-align: center;
  padding: var(--space-xl);
  color: var(--text-muted);
}
</style>
