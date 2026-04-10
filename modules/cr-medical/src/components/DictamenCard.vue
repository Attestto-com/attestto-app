<template>
  <div
    class="bg-[#1a1f2e] rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
    :class="{ 'cursor-default': readonly }"
    @click="!readonly && $emit('click')"
  >
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <span class="text-2xl">{{ statusIcon }}</span>
        <div>
          <p class="font-medium">{{ draft.patient.nombre }} {{ draft.patient.apellidos }}</p>
          <p class="text-[#94a3b8] text-sm">{{ draft.patient.cedula }}</p>
        </div>
      </div>
      <div class="text-right">
        <span class="text-xs px-2 py-0.5 rounded-full" :class="statusClass">{{ statusLabel }}</span>
        <p class="text-[#94a3b8] text-xs mt-1">{{ draft.examDate }}</p>
      </div>
    </div>

    <div class="mt-3 flex items-center gap-2 flex-wrap">
      <span
        v-for="cat in draft.approvedCategories.length ? draft.approvedCategories : draft.requestedCategories"
        :key="cat"
        class="text-xs px-2 py-0.5 rounded-full"
        :class="draft.approvedCategories.length ? 'bg-[#594FD3]/20 text-[#594FD3]' : 'bg-[#1a1f2e] text-[#94a3b8] border border-[#2a2f3e]'"
      >{{ cat }}</span>
      <span v-if="!draft.approvedCategories.length" class="text-xs text-[#94a3b8]">pendiente aprobación</span>
    </div>

    <div v-if="draft.status === 'anchored'" class="mt-2 flex items-center gap-1.5">
      <span class="text-xs text-[#94a3b8]">⛓ Anclado en Solana</span>
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
    case 'draft': return 'bg-[#94a3b8]/10 text-[#94a3b8]'
    case 'pending': return 'bg-[#fbbf24]/10 text-[#fbbf24]'
    case 'signed': return 'bg-[#4ade80]/10 text-[#4ade80]'
    case 'anchored': return 'bg-[#594FD3]/10 text-[#594FD3]'
    case 'revoked': return 'bg-[#ef4444]/10 text-[#ef4444]'
    default: return 'bg-[#94a3b8]/10 text-[#94a3b8]'
  }
})
</script>
