<script setup lang="ts">
import type { DocumentAnalysis } from '../types'
import { CATEGORY_LABELS } from '../types'
import RiskLevelIndicator from './RiskLevelIndicator.vue'

defineProps<{ analysis: DocumentAnalysis }>()
</script>

<template>
  <div class="summary-card">
    <div class="summary-header">
      <span class="material-icons-outlined summary-icon">description</span>
      <div class="summary-meta">
        <span class="doc-type">{{ CATEGORY_LABELS[analysis.documentType] }}</span>
        <RiskLevelIndicator :level="analysis.riskLevel" />
      </div>
    </div>

    <p class="summary-text">{{ analysis.plainLanguageSummary }}</p>

    <div v-if="analysis.parties.length > 0" class="parties">
      <span class="parties-label">Partes:</span>
      <span v-for="party in analysis.parties" :key="party.name" class="party-chip">
        {{ party.role }}: {{ party.name }}
      </span>
    </div>

    <div v-if="analysis.obligations.length > 0" class="obligations">
      <span class="section-label">Tus obligaciones:</span>
      <ul>
        <li v-for="(ob, i) in analysis.obligations" :key="i">{{ ob }}</li>
      </ul>
    </div>

    <div v-if="analysis.penalties.length > 0" class="penalties">
      <span class="section-label" style="color: var(--critical)">Penalidades:</span>
      <ul>
        <li v-for="(p, i) in analysis.penalties" :key="i">{{ p }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.summary-card {
  background: var(--bg-card, #1a1f2e);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.summary-icon {
  font-size: 28px;
  color: var(--primary, #594FD3);
}

.summary-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.doc-type {
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #e8eaed);
}

.summary-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text, #e8eaed);
}

.parties {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.parties-label,
.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #8b95a5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.party-chip {
  font-size: 12px;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 6px;
  color: var(--text, #e8eaed);
}

.obligations ul,
.penalties ul {
  margin: 4px 0 0 16px;
  padding: 0;
  font-size: 13px;
  color: var(--text, #e8eaed);
}

.obligations li,
.penalties li {
  margin-bottom: 2px;
}
</style>
