<script setup lang="ts">
import { computed } from 'vue'
import type { VerifiableCredential } from '@attestto/module-sdk'

const props = defineProps<{ credential: VerifiableCredential }>()
defineEmits<{ tap: [vc: VerifiableCredential] }>()

const issuerName = computed(() => {
  if (typeof props.credential.issuer === 'string') return props.credential.issuer
  return props.credential.issuer.name ?? props.credential.issuer.id
})

const mainType = computed(() => {
  const types = props.credential.type.filter((t) => t !== 'VerifiableCredential')
  return types[0] ?? 'Credential'
})

const statusColor = computed(() => {
  switch (props.credential.revocationStatus) {
    case 'revoked': return 'var(--critical)'
    case 'valid': return 'var(--success)'
    default: return 'var(--text-muted)'
  }
})
</script>

<template>
  <div class="credential-card" @click="$emit('tap', credential)">
    <div class="card-header">
      <span class="card-type">{{ mainType }}</span>
      <span class="card-status" :style="{ color: statusColor }">
        {{ credential.revocationStatus === 'valid' ? 'Verificada' : credential.revocationStatus === 'revoked' ? 'Revocada' : '' }}
      </span>
    </div>
    <div class="card-issuer">{{ issuerName }}</div>
    <div v-if="credential.expirationDate" class="card-expiry">
      Vence: {{ credential.expirationDate.slice(0, 10) }}
    </div>
  </div>
</template>

<style scoped>
.credential-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  cursor: pointer;
  transition: background 0.15s;
}

.credential-card:active {
  background: var(--bg-elevated);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-type {
  font-weight: 600;
  font-size: 14px;
}

.card-status {
  font-size: 12px;
  font-weight: 600;
}

.card-issuer {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.card-expiry {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
