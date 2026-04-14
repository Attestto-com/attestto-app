<template>
  <div class="space-y-1.5">
    <div class="flex items-baseline justify-between">
      <label class="label-text text-xs font-medium uppercase tracking-wider">{{ label }}</label>
      <span v-if="hint" class="hint-text text-xs">{{ hint }}</span>
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

<style scoped>
.label-text {
  color: var(--text-muted);
}

.hint-text {
  color: var(--alert);
}
</style>
