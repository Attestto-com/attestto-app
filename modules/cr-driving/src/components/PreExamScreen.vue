<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { FaceStatus } from '../composables/useFaceDetection'

const props = defineProps<{
  cameraActive: boolean
  faceStatus: FaceStatus
}>()

const emit = defineEmits<{
  start: []
  back: []
  videoMounted: [el: HTMLVideoElement]
}>()

const videoEl = ref<HTMLVideoElement | null>(null)

const checks = computed(() => [
  { label: 'Identidad verificada', icon: 'badge', ok: true },
  { label: 'Dictamen medico valido', icon: 'local_hospital', ok: true },
  { label: 'Camara activa', icon: 'videocam', ok: props.cameraActive },
  { label: 'Microfono activo', icon: 'mic', ok: true },
  { label: 'Rostro detectado', icon: 'face', ok: props.faceStatus === 'present' },
  { label: 'Cooldown cumplido', icon: 'schedule', ok: true },
])

const allChecksPass = computed(() => checks.value.every((c) => c.ok))

const faceLabel = computed(() => {
  switch (props.faceStatus) {
    case 'present': return 'Rostro detectado'
    case 'absent': return 'No se detecta rostro'
    case 'multiple': return 'Multiples rostros'
    case 'initializing': return 'Inicializando...'
    case 'error': return 'Error de camara'
    default: return 'Esperando...'
  }
})

const faceClass = computed(() => {
  if (props.faceStatus === 'present') return 'ok'
  if (props.faceStatus === 'initializing') return 'pending'
  return 'error'
})

onMounted(() => {
  if (videoEl.value) {
    emit('videoMounted', videoEl.value)
  }
})
</script>

<template>
  <div class="pre-exam-screen">
    <header class="screen-header">
      <q-btn flat round icon="arrow_back" color="white" @click="emit('back')" />
      <span>Verificacion previa</span>
    </header>

    <!-- Camera preview -->
    <div class="camera-preview">
      <video
        ref="videoEl"
        autoplay
        playsinline
        muted
        class="camera-video"
      />
      <div v-if="!cameraActive" class="camera-placeholder">
        <q-icon name="videocam_off" size="48px" color="grey-6" />
        <div>Activando camara...</div>
      </div>
      <div :class="['face-status', faceClass]">{{ faceLabel }}</div>
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
        <div class="rule">Pantalla completa</div>
        <div class="rule">Captura en anomalias</div>
        <div class="rule">Deteccion de voz</div>
      </div>
    </div>

    <button
      class="start-btn"
      :disabled="!allChecksPass"
      @click="emit('start')"
    >
      COMENZAR EXAMEN
    </button>

    <p v-if="!allChecksPass" class="hint">
      Todos los requisitos deben estar activos para iniciar
    </p>
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
  position: relative;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-video {
  width: 100%;
  max-height: 280px;
  object-fit: cover;
  transform: scaleX(-1); /* mirror */
}

.camera-placeholder {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  color: var(--text-muted);
  font-size: 13px;
}

.face-status {
  position: absolute;
  bottom: var(--space-sm);
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  padding: 4px 16px;
  border-radius: var(--radius-full);
  backdrop-filter: blur(8px);
}

.face-status.ok {
  background: rgba(74, 222, 128, 0.2);
  color: var(--success);
}

.face-status.pending {
  background: rgba(251, 191, 36, 0.2);
  color: var(--alert);
}

.face-status.error {
  background: rgba(239, 68, 68, 0.2);
  color: var(--critical);
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

.hint {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
</style>
