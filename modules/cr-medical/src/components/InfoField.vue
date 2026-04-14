<template>
  <div>
    <p class="field-label text-xs mb-0.5">{{ label }}</p>
    <p class="text-sm font-medium">{{ value || '—' }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string; value?: string }>()
</script>

<style scoped>
.field-label {
  color: var(--text-muted);
}
</style>
