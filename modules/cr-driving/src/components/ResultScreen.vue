<script setup lang="ts">
import { computed } from 'vue'
import type { ExamResult } from '../types'

const props = defineProps<{ result: ExamResult }>()
defineEmits<{ finish: []; home: []; credential: [] }>()

const durationDisplay = computed(() => {
  const m = Math.floor(props.result.durationSeconds / 60)
  const s = props.result.durationSeconds % 60
  return `${m} min ${s} seg`
})

function barColor(percent: number): string {
  if (percent >= 80) return 'var(--success)'
  if (percent >= 60) return 'var(--warning)'
  return 'var(--critical)'
}
</script>

<template>
  <div class="result-screen">
    <!-- Hero -->
    <div :class="['result-hero', result.passed ? 'passed' : 'failed']">
      <div class="hero-icon">{{ result.passed ? '&#127942;' : '&#10060;' }}</div>
      <h2>{{ result.passed ? 'APROBADO' : 'REPROBADO' }}</h2>
      <div class="hero-score">{{ result.correct }}/{{ result.total }}</div>
      <div class="hero-percent">{{ result.score }}%</div>
    </div>

    <!-- Stats row -->
    <div class="stats-row">
      <div class="stat">
        <div class="stat-value correct">{{ result.correct }}</div>
        <div class="stat-label">Correctas</div>
      </div>
      <div class="stat">
        <div class="stat-value wrong">{{ result.wrong }}</div>
        <div class="stat-label">Incorrectas</div>
      </div>
      <div class="stat">
        <div class="stat-value">{{ durationDisplay }}</div>
        <div class="stat-label">Tiempo</div>
      </div>
    </div>

    <!-- Category breakdown -->
    <section class="section">
      <h3 class="section-title">Dominio por tema</h3>
      <div class="category-list">
        <div v-for="cat in result.categoryBreakdown" :key="cat.category" class="category-row">
          <span class="cat-name">{{ cat.category }}</span>
          <div class="cat-bar-container">
            <div class="cat-bar" :style="{ width: `${cat.percent}%`, background: barColor(cat.percent) }" />
          </div>
          <span class="cat-percent" :style="{ color: barColor(cat.percent) }">{{ cat.percent }}%</span>
        </div>
      </div>
    </section>

    <!-- Weak topics -->
    <section v-if="result.weakTopics.length" class="section">
      <h3 class="section-title">Temas debiles</h3>
      <div v-for="topic in result.weakTopics" :key="topic" class="weak-topic">
        <q-icon name="warning" size="16px" color="warning" />
        <span>{{ topic }}</span>
      </div>
    </section>

    <!-- Session proof -->
    <section class="section">
      <h3 class="section-title">Prueba de sesion</h3>
      <div class="proof-row">
        <q-icon name="link" size="16px" color="grey" />
        <span class="proof-hash">{{ result.chainHead }}</span>
      </div>
      <div class="proof-row">
        <q-icon name="schedule" size="16px" color="grey" />
        <span>{{ durationDisplay }}</span>
      </div>
      <div class="proof-row">
        <q-icon name="photo_camera" size="16px" color="grey" />
        <span>{{ result.incidents.length }} incidentes</span>
      </div>
    </section>

    <!-- Actions -->
    <div class="actions">
      <button v-if="result.passed" class="action-btn primary" @click="$emit('credential')">
        Ver Credencial
      </button>
      <button v-else class="action-btn primary" @click="$emit('home')">
        Practicar temas debiles
      </button>
      <button class="action-btn secondary" @click="$emit('home')">
        Volver al inicio
      </button>
    </div>
  </div>
</template>

<style scoped>
.result-screen {
  min-height: 100dvh;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.result-hero {
  text-align: center;
  padding: var(--space-xl) var(--space-md);
  border-radius: var(--radius-lg);
}

.result-hero.passed {
  background: rgba(74, 222, 128, 0.08);
  border: 1px solid rgba(74, 222, 128, 0.2);
}

.result-hero.failed {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.hero-icon {
  font-size: 48px;
  margin-bottom: var(--space-sm);
}

.result-hero h2 {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 2px;
}

.hero-score {
  font-size: 32px;
  font-weight: 700;
  margin-top: var(--space-sm);
}

.hero-percent {
  font-size: 18px;
  color: var(--text-muted);
}

.stats-row {
  display: flex;
  justify-content: space-around;
  gap: var(--space-sm);
}

.stat {
  text-align: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  flex: 1;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
}

.stat-value.correct { color: var(--success); }
.stat-value.wrong { color: var(--critical); }

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-sm);
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.category-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.cat-name {
  font-size: 13px;
  width: 120px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-bar-container {
  flex: 1;
  height: 8px;
  background: var(--bg-card);
  border-radius: 4px;
  overflow: hidden;
}

.cat-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.cat-percent {
  font-size: 13px;
  font-weight: 600;
  width: 40px;
  text-align: right;
}

.weak-topic {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 14px;
  padding: var(--space-xs) 0;
}

.proof-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 13px;
  color: var(--text-muted);
  padding: var(--space-xs) 0;
}

.proof-hash {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.action-btn {
  width: 100%;
  padding: var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.action-btn.primary {
  background: var(--primary);
  color: white;
}

.action-btn.secondary {
  background: transparent;
  color: var(--text-muted);
}
</style>
