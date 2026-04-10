<script setup lang="ts">
import type { InboxItem } from '@attestto/module-sdk'

defineProps<{ item: InboxItem }>()
defineEmits<{ tap: [item: InboxItem] }>()
</script>

<template>
  <div class="inbox-card" @click="$emit('tap', item)">
    <div class="card-icon">
      <q-icon :name="item.icon" size="24px" />
    </div>
    <div class="card-body">
      <div class="card-title">{{ item.title }}</div>
      <div class="card-subtitle">{{ item.subtitle }}</div>
    </div>
    <div v-if="item.action" class="card-action">
      {{ item.action }}
    </div>
  </div>
</template>

<style scoped>
.inbox-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  cursor: pointer;
  transition: background 0.15s;
}

.inbox-card:active {
  background: var(--bg-elevated);
}

.card-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-weight: 600;
  font-size: 14px;
}

.card-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.card-action {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--primary);
  font-weight: 600;
}
</style>
