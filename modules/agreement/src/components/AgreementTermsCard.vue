<script setup lang="ts">
import type { AgreementDraft } from '../types'
import { AGREEMENT_TYPE_LABELS, AGREEMENT_DEFAULT_RISK, RISK_LABELS } from '../types'

const props = defineProps<{ draft: AgreementDraft }>()

const riskLevel = AGREEMENT_DEFAULT_RISK[props.draft.type]
const riskColors: Record<string, string> = { low: '#4ade80', medium: '#fbbf24', high: '#f97316', critical: '#ef4444' }
</script>

<template>
  <div class="terms-card">
    <div class="card-header">
      <span class="type-badge">{{ AGREEMENT_TYPE_LABELS[draft.type] }}</span>
      <span class="risk-badge" :style="{ color: riskColors[riskLevel], background: riskColors[riskLevel] + '22' }">
        {{ RISK_LABELS[riskLevel] }}
      </span>
    </div>

    <p class="summary">{{ draft.summary }}</p>

    <div v-if="draft.parties.length > 0" class="section">
      <span class="label">Partes</span>
      <div v-for="p in draft.parties" :key="p.name" class="party-row">
        <span class="party-role">{{ p.role }}:</span> {{ p.name }}
      </div>
    </div>

    <div v-if="draft.terms.length > 0" class="section">
      <span class="label">Terminos</span>
      <div v-for="t in draft.terms" :key="t.description" class="term-row">
        <span class="term-desc">{{ t.description }}</span>
        <span class="term-value">{{ t.value }}</span>
      </div>
    </div>

    <div v-if="draft.obligations.length > 0" class="section">
      <span class="label">Obligaciones</span>
      <ul><li v-for="(ob, i) in draft.obligations" :key="i">{{ ob }}</li></ul>
    </div>

    <div v-if="draft.amounts.length > 0" class="section">
      <span class="label">Montos</span>
      <div v-for="a in draft.amounts" :key="a.description" class="term-row">
        <span class="term-desc">{{ a.description }}</span>
        <span class="term-value">{{ a.currency }} {{ a.amount.toLocaleString() }}</span>
      </div>
    </div>

    <div v-if="draft.dates.length > 0" class="section">
      <span class="label">Fechas</span>
      <div v-for="d in draft.dates" :key="d.description" class="term-row">
        <span class="term-desc">{{ d.description }}</span>
        <span class="term-value">{{ d.date }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terms-card { background: var(--bg-card, #1a1f2e); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.card-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.type-badge { font-size: 13px; font-weight: 600; color: var(--text, #e8eaed); }
.risk-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.summary { font-size: 14px; line-height: 1.6; color: var(--text, #e8eaed); }
.section { display: flex; flex-direction: column; gap: 4px; }
.label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #8b95a5); }
.party-row { font-size: 13px; color: var(--text, #e8eaed); }
.party-role { font-weight: 600; color: var(--text-muted, #8b95a5); }
.term-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--text, #e8eaed); }
.term-desc { color: var(--text-muted, #8b95a5); }
.term-value { font-weight: 600; }
ul { margin: 0 0 0 16px; padding: 0; font-size: 13px; color: var(--text, #e8eaed); }
li { margin-bottom: 2px; }
</style>
