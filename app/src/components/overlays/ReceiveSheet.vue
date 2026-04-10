<script setup lang="ts">
import { ref } from 'vue'
import type { VerifiableCredential } from '@attestto/module-sdk'

const props = defineProps<{
  visible: boolean
  credential?: VerifiableCredential
}>()

const emit = defineEmits<{
  accept: [vc: VerifiableCredential]
  decline: []
}>()

const accepting = ref(false)

async function handleAccept() {
  if (!props.credential) return
  accepting.value = true
  emit('accept', props.credential)
  accepting.value = false
}

function issuerName(vc?: VerifiableCredential): string {
  if (!vc) return 'Desconocido'
  if (typeof vc.issuer === 'string') return vc.issuer
  return vc.issuer.name ?? vc.issuer.id
}

function mainType(vc?: VerifiableCredential): string {
  if (!vc) return 'Credencial'
  const types = vc.type.filter((t) => t !== 'VerifiableCredential')
  return types[0] ?? 'Credencial'
}
</script>

<template>
  <q-dialog :model-value="visible" position="bottom" @hide="emit('decline')">
    <q-card class="receive-sheet">
      <q-card-section class="receive-header">
        <q-icon name="card_giftcard" size="28px" color="positive" />
        <span class="receive-title">Nueva credencial</span>
      </q-card-section>

      <q-card-section v-if="credential">
        <div class="vc-preview">
          <div class="vc-type">{{ mainType(credential) }}</div>
          <div class="vc-issuer">De: {{ issuerName(credential) }}</div>
          <div class="vc-date">Emitida: {{ credential.issuanceDate.slice(0, 10) }}</div>
          <div v-if="credential.expirationDate" class="vc-expiry">
            Vence: {{ credential.expirationDate.slice(0, 10) }}
          </div>
        </div>
      </q-card-section>

      <q-card-actions vertical>
        <q-btn
          class="accept-btn"
          unelevated
          color="positive"
          icon="add_card"
          label="Aceptar y guardar"
          :loading="accepting"
          @click="handleAccept"
        />
        <q-btn
          flat
          label="Rechazar"
          color="grey"
          @click="emit('decline')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.receive-sheet {
  background: var(--bg-card);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  min-width: 100%;
}

.receive-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.receive-title {
  font-size: 18px;
  font-weight: 700;
}

.vc-preview {
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.vc-type {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--space-sm);
}

.vc-issuer,
.vc-date,
.vc-expiry {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.accept-btn {
  width: 100%;
}
</style>
