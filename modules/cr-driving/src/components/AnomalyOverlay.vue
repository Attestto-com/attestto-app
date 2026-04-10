<script setup lang="ts">
defineProps<{
  message: string
  severity: 'warning' | 'critical' | 'terminal'
  incidentCount: number
}>()

defineEmits<{ dismiss: [] }>()

const severityConfig = {
  warning: { icon: 'warning', color: 'var(--alert)', label: 'ATENCION' },
  critical: { icon: 'error', color: 'var(--critical)', label: 'ALERTA CRITICA' },
  terminal: { icon: 'block', color: 'var(--critical)', label: 'EXAMEN DETENIDO' },
}
</script>

<template>
  <div class="anomaly-overlay">
    <div :class="['anomaly-card', severity]">
      <q-icon
        :name="severityConfig[severity].icon"
        size="48px"
        :style="{ color: severityConfig[severity].color }"
      />

      <h2 :style="{ color: severityConfig[severity].color }">
        {{ severityConfig[severity].label }}
      </h2>

      <p class="anomaly-message">{{ message }}</p>

      <div class="incident-counter">
        Incidente {{ incidentCount }} de 3
      </div>

      <div v-if="severity !== 'terminal'" class="pause-indicator">
        <q-icon name="pause_circle" size="20px" />
        Examen pausado
      </div>

      <button
        v-if="severity !== 'terminal'"
        class="dismiss-btn"
        @click="$emit('dismiss')"
      >
        Entendido
      </button>
    </div>
  </div>
</template>

<style scoped>
.anomaly-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--space-md);
}

.anomaly-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  text-align: center;
  max-width: 360px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.anomaly-card.warning {
  border: 2px solid var(--alert);
}

.anomaly-card.critical {
  border: 2px solid var(--critical);
}

.anomaly-card.terminal {
  border: 2px solid var(--critical);
  background: #1a0808;
}

h2 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}

.anomaly-message {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.5;
}

.incident-counter {
  font-size: 13px;
  color: var(--text-muted);
}

.pause-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 13px;
  color: var(--text-muted);
}

.dismiss-btn {
  width: 100%;
  padding: var(--space-md);
  background: var(--bg-elevated);
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
</style>
