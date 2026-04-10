<template>
  <div class="flex gap-2">
    <button
      class="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors"
      :class="modelValue === 'pass' ? 'bg-[#4ade80] text-[#0f1923]' : 'bg-[#1a1f2e] text-[#94a3b8]'"
      @click="$emit('update:modelValue', 'pass')"
    >✅ Pasa</button>
    <button
      class="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors"
      :class="modelValue === 'conditional' ? 'bg-[#fbbf24] text-[#0f1923]' : 'bg-[#1a1f2e] text-[#94a3b8]'"
      @click="$emit('update:modelValue', 'conditional')"
    >⚠️ Cond.</button>
    <button
      class="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors"
      :class="modelValue === 'fail' ? 'bg-[#ef4444] text-white' : 'bg-[#1a1f2e] text-[#94a3b8]'"
      @click="$emit('update:modelValue', 'fail')"
    >❌ Falla</button>
  </div>
</template>

<script setup lang="ts">
import type { PassFail } from '../types/dictamen'
defineProps<{ modelValue: PassFail }>()
defineEmits<{ 'update:modelValue': [value: PassFail] }>()
</script>
