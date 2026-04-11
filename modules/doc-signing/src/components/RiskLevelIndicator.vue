<script setup lang="ts">
import type { RiskLevel } from '../types'
import { RISK_LABELS } from '../types'

const props = defineProps<{ level: RiskLevel }>()

const colorMap: Record<RiskLevel, string> = {
  low: '#4ade80',
  medium: '#fbbf24',
  high: '#f97316',
  critical: '#ef4444',
}
</script>

<template>
  <span class="risk-badge" :style="{ background: colorMap[props.level] + '22', color: colorMap[props.level], borderColor: colorMap[props.level] + '44' }">
    {{ RISK_LABELS[props.level] }}
  </span>
</template>

<style scoped>
.risk-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
