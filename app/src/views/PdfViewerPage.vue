<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const docId = route.params.id as string
</script>

<template>
  <q-page class="pdf-page" padding>
    <header class="pdf-header">
      <q-btn flat round icon="arrow_back" color="white" @click="router.back()" />
      <span class="pdf-title">Documento</span>
      <q-btn flat round icon="more_vert" color="white" />
    </header>

    <div class="pdf-viewport">
      <div class="pdf-placeholder">
        <q-icon name="picture_as_pdf" size="64px" color="grey-6" />
        <p>PDF Viewer</p>
        <p class="hint">Integrar @attestto/pdf aqui</p>
      </div>
    </div>

    <div class="pdf-actions">
      <button class="action-btn ai-btn">
        <q-icon name="smart_toy" size="20px" />
        Explicar
      </button>
      <button class="action-btn sign-btn">
        <q-icon name="draw" size="20px" />
        Firmar
      </button>
    </div>
  </q-page>
</template>

<style scoped>
.pdf-page {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  padding: 0;
}

.pdf-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-xs);
}

.pdf-title {
  flex: 1;
  font-weight: 600;
  font-size: 16px;
}

.pdf-viewport {
  flex: 1;
  margin: 0 var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pdf-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  color: var(--text-muted);
}

.hint {
  font-size: 12px;
}

.pdf-actions {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.ai-btn {
  background: var(--bg-card);
  color: var(--text-primary);
}

.sign-btn {
  background: var(--primary);
  color: white;
}
</style>
