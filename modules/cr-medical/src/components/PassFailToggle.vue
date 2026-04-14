<template>
  <div class="flex gap-2">
    <button
      class="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors"
      :class="modelValue === 'pass' ? 'btn-pass-active' : 'btn-inactive'"
      @click="$emit('update:modelValue', 'pass')"
    >✅ Pasa</button>
    <button
      class="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors"
      :class="modelValue === 'conditional' ? 'btn-conditional-active' : 'btn-inactive'"
      @click="$emit('update:modelValue', 'conditional')"
    >⚠️ Cond.</button>
    <button
      class="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors"
      :class="modelValue === 'fail' ? 'btn-fail-active' : 'btn-inactive'"
      @click="$emit('update:modelValue', 'fail')"
    >❌ Falla</button>
  </div>
</template>

<script setup lang="ts">
import type { PassFail } from '../types/dictamen'
defineProps<{ modelValue: PassFail }>()
defineEmits<{ 'update:modelValue': [value: PassFail] }>()
</script>

<style scoped>
.btn-pass-active {
  background: var(--success);
  color: var(--bg-base);
}

.btn-conditional-active {
  background: var(--alert);
  color: var(--bg-base);
}

.btn-fail-active {
  background: var(--critical);
  color: white;
}

.btn-inactive {
  background: var(--bg-card);
  color: var(--text-muted);
}
</style>
