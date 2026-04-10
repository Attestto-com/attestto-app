<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  visible: boolean
  merchant?: string
  amount?: number
  currency?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const confirming = ref(false)

async function handleConfirm() {
  confirming.value = true
  // TODO: DID signs payment intent → CORTEX+Circle executes
  emit('confirm')
  confirming.value = false
}
</script>

<template>
  <q-dialog :model-value="visible" position="bottom" @hide="emit('cancel')">
    <q-card class="pay-sheet">
      <q-card-section class="pay-header">
        <q-icon name="payment" size="28px" color="primary" />
        <span class="pay-title">Attestto Pay</span>
      </q-card-section>

      <q-card-section>
        <div class="pay-merchant">Pago a:</div>
        <div class="pay-merchant-name">{{ merchant ?? 'Comercio' }}</div>

        <div class="pay-amount-box">
          <span class="pay-currency">{{ currency ?? 'CRC' }}</span>
          <span class="pay-amount">{{ amount?.toLocaleString() ?? '0' }}</span>
        </div>

        <div class="pay-source">
          Desde: CRC balance
        </div>
      </q-card-section>

      <q-card-actions vertical>
        <q-btn
          class="confirm-btn"
          unelevated
          color="primary"
          icon="lock"
          label="Confirmar pago"
          :loading="confirming"
          @click="handleConfirm"
        />
        <q-btn
          flat
          label="Cancelar"
          color="grey"
          @click="emit('cancel')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.pay-sheet {
  background: var(--bg-card);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  min-width: 100%;
}

.pay-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.pay-title {
  font-size: 18px;
  font-weight: 700;
}

.pay-merchant {
  font-size: 13px;
  color: var(--text-muted);
}

.pay-merchant-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.pay-amount-box {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-lg);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.pay-currency {
  font-size: 14px;
  color: var(--text-muted);
}

.pay-amount {
  font-size: 32px;
  font-weight: 700;
}

.pay-source {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

.confirm-btn {
  width: 100%;
}
</style>
