<template>
  <div>
    <p class="text-[#94a3b8] text-xs mb-0.5">{{ label }}</p>
    <p class="text-sm font-medium">{{ value || '—' }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string; value?: string }>()
</script>
