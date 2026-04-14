<template>
  <div
    class="dictamen-card rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
    :class="{ 'cursor-default': readonly }"
    @click="!readonly && $emit('click')"
  >
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <span class="text-2xl">{{ statusIcon }}</span>
        <div>
          <p class="font-medium">{{ draft.patient.nombre }} {{ draft.patient.apellidos }}</p>
          <p class="text-muted text-sm">{{ draft.patient.cedula }}</p>
        </div>
      </div>
      <div class="text-right">
        <span class="text-xs px-2 py-0.5 rounded-full" :class="statusClass">{{ statusLabel }}</span>
        <p class="text-muted text-xs mt-1">{{ draft.examDate }}</p>
      </div>
    </div>

    <div class="mt-3 flex items-center gap-2 flex-wrap">
      <span
        v-for="cat in draft.approvedCategories.length ? draft.approvedCategories : draft.requestedCategories"
        :key="cat"
        class="text-xs px-2 py-0.5 rounded-full"
        :class="draft.approvedCategories.length ? 'cat-approved' : 'cat-pending'"
      >{{ cat }}</span>
      <span v-if="!draft.approvedCategories.length" class="text-xs text-muted">pendiente aprobación</span>
    </div>

    <div v-if="draft.status === 'anchored'" class="mt-2 flex items-center gap-1.5">
      <span class="text-xs text-muted">⛓ Anclado en Solana</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DictamenDraft } from '../types/dictamen'

const props = defineProps<{
  draft: DictamenDraft
  readonly?: boolean
}>()

defineEmits<{ click: [] }>()

const statusIcon = computed(() => {
  switch (props.draft.status) {
    case 'draft': return '✏️'
    case 'pending': return '⏳'
    case 'signed': return '✅'
    case 'anchored': return '⛓'
    case 'revoked': return '🚫'
    default: return '📋'
  }
})

const statusLabel = computed(() => {
  switch (props.draft.status) {
    case 'draft': return 'Borrador'
    case 'pending': return 'Pendiente firma'
    case 'signed': return 'Firmado'
    case 'anchored': return 'Anclado'
    case 'revoked': return 'Revocado'
    default: return props.draft.status
  }
})

const statusClass = computed(() => {
  switch (props.draft.status) {
    case 'draft': return 'status-draft'
    case 'pending': return 'status-pending'
    case 'signed': return 'status-signed'
    case 'anchored': return 'status-anchored'
    case 'revoked': return 'status-revoked'
    default: return 'status-draft'
  }
})
</script>

<style scoped>
.dictamen-card {
  background: var(--bg-card);
}

.text-muted {
  color: var(--text-muted);
}

.cat-approved {
  background: color-mix(in srgb, var(--primary) 20%, transparent);
  color: var(--primary);
}

.cat-pending {
  background: var(--bg-card);
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
}

.status-draft {
  background: color-mix(in srgb, var(--text-muted) 10%, transparent);
  color: var(--text-muted);
}

.status-pending {
  background: color-mix(in srgb, var(--alert) 10%, transparent);
  color: var(--alert);
}

.status-signed {
  background: color-mix(in srgb, var(--success) 10%, transparent);
  color: var(--success);
}

.status-anchored {
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
}

.status-revoked {
  background: color-mix(in srgb, var(--critical) 10%, transparent);
  color: var(--critical);
}
</style>
