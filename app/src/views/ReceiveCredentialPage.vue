<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCredentialReceive } from '@/composables/useCredentialReceive'
import { ref } from 'vue'

const route = useRoute()
const router = useRouter()
const { step, offer, issuerMeta, error, receivedCredentialId, handleOffer, accept, reset } =
  useCredentialReceive()

const txCodeInput = ref('')

onMounted(() => {
  // Check for offer in query params (from QR redirect or deep link)
  const offerParam = route.query.credential_offer as string
  const offerUri = route.query.credential_offer_uri as string
  const raw = route.query.raw as string

  if (offerParam) {
    handleOffer(offerParam)
  } else if (offerUri) {
    handleOffer(`openid-credential-offer://?credential_offer_uri=${encodeURIComponent(offerUri)}`)
  } else if (raw) {
    handleOffer(raw)
  }
})

function goToWallet() {
  if (receivedCredentialId.value) {
    router.push({ name: 'credential-detail', params: { id: receivedCredentialId.value } })
  } else {
    router.push({ name: 'wallet' })
  }
}
</script>

<template>
  <q-page class="receive-page" padding>
    <q-btn flat round icon="arrow_back" color="white" @click="router.back()" class="back-btn" />

    <h2 class="page-title">Recibir credencial</h2>

    <!-- Parsing / Loading -->
    <div v-if="step === 'parsing'" class="status-card">
      <q-spinner-dots size="32px" color="primary" />
      <p>Procesando oferta...</p>
    </div>

    <!-- Review offer -->
    <div v-else-if="step === 'reviewing' && offer" class="offer-card">
      <div class="issuer-section">
        <q-icon name="verified" size="24px" color="primary" />
        <div>
          <div class="issuer-label">Emisor</div>
          <div class="issuer-url">{{ offer.credential_issuer }}</div>
        </div>
      </div>

      <div class="cred-list">
        <div class="section-label">Credenciales ofrecidas</div>
        <div
          v-for="configId in offer.credential_configuration_ids"
          :key="configId"
          class="cred-chip"
        >
          {{ configId }}
        </div>
      </div>

      <div class="action-row">
        <q-btn flat label="Cancelar" color="grey" @click="router.back()" />
        <q-btn unelevated label="Aceptar" color="primary" @click="accept()" />
      </div>
    </div>

    <!-- TX Code (PIN) entry -->
    <div v-else-if="step === 'tx-code' && offer" class="offer-card">
      <div class="issuer-section">
        <q-icon name="pin" size="24px" color="primary" />
        <div>
          <div class="issuer-label">Codigo de verificacion</div>
          <div class="issuer-url">{{ offer.credential_issuer }}</div>
        </div>
      </div>

      <q-input
        v-model="txCodeInput"
        label="Codigo"
        outlined
        dark
        class="tx-input"
        inputmode="numeric"
        maxlength="8"
      />

      <div class="action-row">
        <q-btn flat label="Cancelar" color="grey" @click="router.back()" />
        <q-btn
          unelevated
          label="Verificar"
          color="primary"
          :disable="!txCodeInput"
          @click="accept(txCodeInput)"
        />
      </div>
    </div>

    <!-- Exchanging -->
    <div v-else-if="step === 'exchanging'" class="status-card">
      <q-spinner-dots size="32px" color="primary" />
      <p>Intercambiando credencial...</p>
    </div>

    <!-- Success -->
    <div v-else-if="step === 'success'" class="status-card success">
      <q-icon name="check_circle" size="48px" color="positive" />
      <p>Credencial recibida</p>
      <q-btn unelevated label="Ver en billetera" color="primary" @click="goToWallet()" />
    </div>

    <!-- Error -->
    <div v-else-if="step === 'error'" class="status-card error">
      <q-icon name="error_outline" size="48px" color="negative" />
      <p>{{ error }}</p>
      <q-btn flat label="Reintentar" color="primary" @click="reset()" />
    </div>

    <!-- Idle — no offer provided -->
    <div v-else class="status-card">
      <q-icon name="qr_code_scanner" size="48px" color="grey-6" />
      <p>Escanea un codigo QR con una oferta de credencial</p>
    </div>
  </q-page>
</template>

<style scoped>
.receive-page {
  padding-bottom: 80px;
}
.back-btn {
  margin-bottom: var(--space-md);
}
.page-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: var(--space-lg);
}
.status-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  text-align: center;
  color: var(--text-muted);
}
.status-card.success { color: var(--success); }
.status-card.error { color: var(--critical); }
.offer-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
.issuer-section {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
}
.issuer-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
}
.issuer-url {
  font-size: 14px;
  word-break: break-all;
}
.section-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: var(--space-sm);
}
.cred-chip {
  display: inline-block;
  background: var(--bg-elevated, #252b3b);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-sm);
  font-size: 13px;
  margin-right: var(--space-xs);
  margin-bottom: var(--space-xs);
}
.tx-input {
  margin-top: var(--space-sm);
}
.action-row {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}
</style>
