<template>
  <div class="space-y-1.5">
    <div class="flex items-baseline justify-between">
      <label class="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">{{ label }}</label>
      <span v-if="hint" class="text-[#fbbf24] text-xs">{{ hint }}</span>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  hint?: string
}>()
</script>
