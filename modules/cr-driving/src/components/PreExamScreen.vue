<script setup lang="ts">
import { ref, computed } from 'vue'

defineEmits<{ start: []; back: [] }>()

const checks = ref([
  { label: 'Identidad verificada', icon: 'badge', ok: true },
  { label: 'Dictamen medico valido', icon: 'local_hospital', ok: true },
  { label: 'Camara activa', icon: 'videocam', ok: true },
  { label: 'Microfono activo', icon: 'mic', ok: true },
  { label: 'Rostro detectado', icon: 'face', ok: true },
  { label: 'Cooldown cumplido', icon: 'schedule', ok: true },
])

const allChecksPass = computed(() => checks.value.every((c) => c.ok))
</script>

<template>
  <div class="pre-exam-screen">
    <header class="screen-header">
      <q-btn flat round icon="arrow_back" color="white" @click="$emit('back')" />
      <span>Verificacion previa</span>
    </header>

    <!-- Camera preview placeholder -->
    <div class="camera-preview">
      <q-icon name="videocam" size="64px" color="grey-6" />
      <div class="camera-label">Camara de verificacion</div>
      <div class="face-status ok">Rostro detectado</div>
    </div>

    <!-- Checklist -->
    <div class="checklist">
      <div v-for="check in checks" :key="check.label" class="check-item">
        <q-icon
          :name="check.ok ? 'check_circle' : 'cancel'"
          :color="check.ok ? 'positive' : 'negative'"
          size="20px"
        />
        <span>{{ check.label }}</span>
      </div>
    </div>

    <!-- Exam rules -->
    <div class="rules-section">
      <h3>Reglas del examen</h3>
      <div class="rules-list">
        <div class="rule">40 preguntas</div>
        <div class="rule">40 minutos</div>
        <div class="rule">80% para aprobar</div>
        <div class="rule">Pantalla bloqueada</div>
        <div class="rule">Captura en anomalias</div>
      </div>
    </div>

    <button
      class="start-btn"
      :disabled="!allChecksPass"
      @click="$emit('start')"
    >
      COMENZAR EXAMEN
    </button>
  </div>
</template>

<style scoped>
.pre-exam-screen {
  min-height: 100dvh;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.screen-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 18px;
  font-weight: 600;
}

.camera-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  min-height: 200px;
}

.camera-label {
  font-size: 13px;
  color: var(--text-muted);
}

.face-status {
  font-size: 13px;
  padding: 4px 12px;
  border-radius: var(--radius-full);
}

.face-status.ok {
  background: rgba(74, 222, 128, 0.15);
  color: var(--success);
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.check-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 14px;
}

.rules-section h3 {
  font-size: 13px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-sm);
}

.rules-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.rule {
  font-size: 13px;
  padding: 4px 10px;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
}

.start-btn {
  width: 100%;
  padding: var(--space-md);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  margin-top: auto;
}

.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
