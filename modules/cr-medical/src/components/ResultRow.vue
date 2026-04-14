<template>
  <div class="flex items-center justify-between py-1.5">
    <span class="text-sm label-text">{{ label }}</span>
    <div class="flex items-center gap-2">
      <span v-if="detail" class="text-xs detail-text">{{ detail }}</span>
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
    case 'pass': return 'result-pass'
    case 'conditional': return 'result-conditional'
    case 'fail': return 'result-fail'
  }
})
</script>

<style scoped>
.label-text {
  color: var(--text-muted);
}

.detail-text {
  color: var(--text-muted);
}

.result-pass {
  color: var(--success);
}

.result-conditional {
  color: var(--alert);
}

.result-fail {
  color: var(--critical);
}
</style>
