<template>
  <div class="flex items-center justify-between py-1.5">
    <span class="text-sm text-[#94a3b8]">{{ label }}</span>
    <div class="flex items-center gap-2">
      <span v-if="detail" class="text-xs text-[#94a3b8]">{{ detail }}</span>
      <span class="text-sm font-medium" :class="resultClass">{{ resultText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PassFail } from '../types/dictamen'

const props = defineProps<{
  label: string
  result: PassFail
  detail?: string
}>()

const resultText = computed(() => {
  switch (props.result) {
    case 'pass': return '✅ Pasa'
    case 'conditional': return '⚠️ Condicional'
    case 'fail': return '❌ Falla'
  }
})

const resultClass = computed(() => {
  switch (props.result) {
    case 'pass': return 'text-[#4ade80]'
    case 'conditional': return 'text-[#fbbf24]'
    case 'fail': return 'text-[#ef4444]'
  }
})
</script>
