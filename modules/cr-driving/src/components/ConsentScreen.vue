<script setup lang="ts">
defineEmits<{ accept: []; reject: [] }>()
</script>

<template>
  <div class="consent-screen">
    <div class="consent-icon">&#9878;</div>
    <h2>Consentimiento Informado</h2>

    <div class="consent-card">
      <p class="consent-intro">
        De conformidad con la Ley N.° 8968, durante esta prueba se recopilara:
      </p>

      <div class="consent-items">
        <div class="consent-item">
          <q-icon name="photo_camera" size="20px" />
          <span>Captura facial en eventos de anomalia</span>
        </div>
        <div class="consent-item">
          <q-icon name="visibility" size="20px" />
          <span>Deteccion de rostro y presencia</span>
        </div>
        <div class="consent-item">
          <q-icon name="lock" size="20px" />
          <span>Registro de eventos con hash criptografico</span>
        </div>
        <div class="consent-item">
          <q-icon name="mic" size="20px" />
          <span>Deteccion de actividad de voz</span>
        </div>
      </div>

      <p class="consent-purpose">
        Uso exclusivo para verificar identidad e integridad. Sin analisis secundarios.
        Todos los datos permanecen en tu dispositivo.
      </p>
    </div>

    <button class="accept-btn" @click="$emit('accept')">
      Acepto — Continuar
    </button>

    <button class="reject-btn" @click="$emit('reject')">
      Rechazar
    </button>
  </div>
</template>

<style scoped>
.consent-screen {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  gap: var(--space-lg);
}

.consent-icon {
  font-size: 48px;
}

h2 {
  font-size: 20px;
  font-weight: 700;
}

.consent-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  width: 100%;
  max-width: 400px;
}

.consent-intro {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: var(--space-md);
}

.consent-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.consent-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 14px;
}

.consent-purpose {
  margin-top: var(--space-md);
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}

.accept-btn {
  width: 100%;
  max-width: 400px;
  padding: var(--space-md);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.reject-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
}
</style>
