<script setup lang="ts">
import { computed } from 'vue'
import { useMastery } from '../composables/useMastery'

const { mastery, getTopCategories, getOverallAccuracy, canRetry } = useMastery()
const emit = defineEmits<{ start: []; practice: [] }>()

const accuracy = computed(() => getOverallAccuracy())
const topCats = computed(() => getTopCategories(3))
const retryAvailable = computed(() => canRetry())

function barColor(pct: number): string {
  if (pct >= 80) return 'var(--success)'
  if (pct >= 60) return 'var(--warning)'
  return 'var(--critical)'
}
</script>

<template>
  <div class="mastery-widget">
    <div class="widget-header">
      <span class="widget-title">Prueba Teorica</span>
    </div>

    <!-- Stats row -->
    <div class="stats-row">
      <div class="stat-pill">
        <span class="stat-icon">&#128293;</span>
        <span>{{ mastery.streak }} dias</span>
      </div>
      <div class="stat-pill">
        <span>{{ accuracy }}%</span>
      </div>
      <div class="stat-pill">
        <span>{{ mastery.totalAttempts }}</span>
      </div>
    </div>

    <!-- Category bars -->
    <div v-if="topCats.length" class="category-bars">
      <div v-for="cat in topCats" :key="cat.category" class="cat-row">
        <span class="cat-label">{{ cat.category }}</span>
        <div class="cat-bar-bg">
          <div class="cat-bar-fill" :style="{ width: `${cat.percent}%`, background: barColor(cat.percent) }" />
        </div>
        <span class="cat-pct">{{ cat.percent }}%</span>
      </div>
    </div>

    <div v-if="mastery.weakTopics.length" class="weak-hint">
      {{ mastery.weakTopics.length }} temas por mejorar
    </div>

    <!-- CTA -->
    <button
      v-if="retryAvailable"
      class="start-btn"
      @click="emit('start')"
    >
      INICIAR EXAMEN
    </button>
    <button v-else class="practice-btn" @click="emit('practice')">
      Practicar
    </button>

    <div class="last-attempt" v-if="mastery.lastAttemptDate">
      Ultimo: {{ mastery.lastAttemptDate }}, {{ mastery.lastScore }}%
    </div>
  </div>
</template>

<style scoped>
.mastery-widget {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.widget-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.widget-title {
  font-size: 15px;
  font-weight: 600;
}

.stats-row {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;
}

.category-bars {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.cat-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 12px;
}

.cat-label {
  width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
}

.cat-bar-bg {
  flex: 1;
  height: 6px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.cat-bar-fill {
  height: 100%;
  border-radius: 3px;
}

.cat-pct {
  width: 32px;
  text-align: right;
  font-weight: 600;
}

.weak-hint {
  font-size: 12px;
  color: var(--warning);
  margin-bottom: var(--space-md);
}

.start-btn {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
}

.practice-btn {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.last-attempt {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  margin-top: var(--space-sm);
}
</style>
