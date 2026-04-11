<script setup lang="ts">
import { computed } from 'vue'
import { useMastery } from '../composables/useMastery'

const { mastery, getAllCategories, getOverallAccuracy, canRetry, canIssueVC } = useMastery()
const emit = defineEmits<{ start: []; practice: []; 'micro-quiz': []; 'issue-vc': [] }>()

const accuracy = computed(() => getOverallAccuracy())
const categories = computed(() => getAllCategories())
const retryAvailable = computed(() => canRetry())
const hasWeakTopics = computed(() => mastery.value.weakTopics.length > 0)

function barColor(pct: number): string {
  if (pct >= 90) return 'var(--success)'
  if (pct >= 70) return 'var(--warning)'
  return 'var(--critical)'
}
</script>

<template>
  <div class="mastery-widget">
    <div class="widget-header">
      <span class="widget-title">Dominio — Prueba Teorica</span>
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
        <span>{{ mastery.totalAttempts }} sesiones</span>
      </div>
    </div>

    <!-- VC Ready Banner -->
    <div v-if="canIssueVC.value" class="vc-ready">
      <q-icon name="verified" size="18px" color="positive" />
      <span>Todas las categorias en 90%+</span>
      <button class="vc-btn" @click="emit('issue-vc')">Generar Credencial</button>
    </div>

    <!-- Category bars (all) -->
    <div v-if="categories.length" class="category-bars">
      <div v-for="cat in categories" :key="cat.category" class="cat-row">
        <span class="cat-label">{{ cat.category }}</span>
        <div class="cat-bar-bg">
          <div class="cat-bar-fill" :style="{ width: `${cat.percent}%`, background: barColor(cat.percent) }" />
          <div class="threshold-marker" />
        </div>
        <span class="cat-pct" :style="{ color: cat.isGreen ? 'var(--success)' : 'var(--text-muted)' }">
          {{ cat.percent }}%
        </span>
        <span v-if="!cat.isGreen" class="cat-gap">+{{ 90 - cat.percent }}%</span>
      </div>
    </div>

    <div v-if="hasWeakTopics" class="weak-hint">
      {{ mastery.weakTopics.length }} tema{{ mastery.weakTopics.length > 1 ? 's' : '' }} por debajo del 90%
    </div>

    <!-- Pending law changes -->
    <div v-if="mastery.pendingLawChanges.length" class="law-change-hint">
      <q-icon name="gavel" size="14px" />
      {{ mastery.pendingLawChanges.length }} categoria{{ mastery.pendingLawChanges.length > 1 ? 's' : '' }} reseteada{{ mastery.pendingLawChanges.length > 1 ? 's' : '' }} por cambio de ley
    </div>

    <!-- CTAs -->
    <div class="cta-row">
      <button
        v-if="retryAvailable"
        class="start-btn"
        @click="emit('start')"
      >
        EXAMEN COMPLETO
      </button>
      <button
        v-if="hasWeakTopics"
        class="quiz-btn"
        @click="emit('micro-quiz')"
      >
        Repaso rapido (5 preguntas)
      </button>
      <button class="practice-btn" @click="emit('practice')">
        Practicar (10 preguntas)
      </button>
    </div>

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
  font-size: 12px;
  font-weight: 500;
}

.vc-ready {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
  font-size: 13px;
  color: var(--success);
}

.vc-btn {
  margin-left: auto;
  padding: 4px 12px;
  background: var(--success);
  border: none;
  border-radius: var(--radius-sm);
  color: #0f1923;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
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
  overflow: visible;
  position: relative;
}

.cat-bar-fill {
  height: 100%;
  border-radius: 3px;
}

.threshold-marker {
  position: absolute;
  left: 90%;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: var(--text-muted);
  opacity: 0.3;
  border-radius: 1px;
}

.cat-pct {
  width: 32px;
  text-align: right;
  font-weight: 600;
}

.cat-gap {
  width: 36px;
  font-size: 11px;
  color: var(--warning);
  opacity: 0.8;
}

.weak-hint {
  font-size: 12px;
  color: var(--warning);
  margin-bottom: var(--space-sm);
}

.law-change-hint {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 12px;
  color: var(--critical);
  margin-bottom: var(--space-md);
}

.cta-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
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

.quiz-btn {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: rgba(89, 79, 211, 0.15);
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.practice-btn {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
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
