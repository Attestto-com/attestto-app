<script setup lang="ts">
import { ref } from 'vue'
import type { FlaggedClause } from '../types'

defineProps<{ clauses: FlaggedClause[] }>()

const expanded = ref<Set<number>>(new Set())

function toggle(i: number) {
  if (expanded.value.has(i)) expanded.value.delete(i)
  else expanded.value.add(i)
}

const severityIcon: Record<string, string> = {
  info: 'info',
  warning: 'warning',
  critical: 'error',
}

const severityColor: Record<string, string> = {
  info: '#60a5fa',
  warning: '#fbbf24',
  critical: '#ef4444',
}
</script>

<template>
  <div class="flagged-panel">
    <div v-if="clauses.length === 0" class="empty-state">
      <span class="material-icons-outlined" style="color: #4ade80; font-size: 20px">check_circle</span>
      <span>No se encontraron clausulas riesgosas</span>
    </div>

    <div v-for="(clause, i) in clauses" :key="i" class="clause-item" @click="toggle(i)">
      <div class="clause-header">
        <span class="material-icons-outlined clause-icon" :style="{ color: severityColor[clause.severity] }">
          {{ severityIcon[clause.severity] }}
        </span>
        <span class="clause-concern">{{ clause.concern }}</span>
        <span class="material-icons-outlined expand-icon">
          {{ expanded.has(i) ? 'expand_less' : 'expand_more' }}
        </span>
      </div>
      <div v-if="expanded.has(i)" class="clause-detail">
        <p class="clause-text">"{{ clause.clause }}"</p>
        <p v-if="clause.legalRef" class="legal-ref">Ref: {{ clause.legalRef }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flagged-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(74, 222, 128, 0.08);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text, #e8eaed);
}

.clause-item {
  background: var(--bg-card, #1a1f2e);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
}

.clause-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.clause-icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.clause-concern {
  flex: 1;
  font-size: 13px;
  color: var(--text, #e8eaed);
  line-height: 1.4;
}

.expand-icon {
  font-size: 18px;
  color: var(--text-muted, #8b95a5);
  flex-shrink: 0;
}

.clause-detail {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.clause-text {
  font-size: 12px;
  font-style: italic;
  color: var(--text-muted, #8b95a5);
  line-height: 1.5;
}

.legal-ref {
  font-size: 11px;
  color: var(--text-dim, #5a6577);
  margin-top: 4px;
}
</style>
