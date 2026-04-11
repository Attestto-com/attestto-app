<script setup lang="ts">
import { ref } from 'vue'
import type { DocumentCategory } from '../types'
import { CATEGORY_LABELS } from '../types'

const emit = defineEmits<{
  classify: [category: DocumentCategory, summary: string]
}>()

const selected = ref<DocumentCategory>('unknown')
const summary = ref('')

const categories = Object.entries(CATEGORY_LABELS) as [DocumentCategory, string][]

function submit() {
  emit('classify', selected.value, summary.value)
}
</script>

<template>
  <div class="manual-form">
    <div class="form-header">
      <span class="material-icons-outlined" style="color: var(--warning, #fbbf24)">psychology_alt</span>
      <span class="form-title">Clasificacion manual</span>
    </div>
    <p class="form-desc">La IA no esta disponible. Clasifica el documento manualmente.</p>

    <label class="form-label">Tipo de documento</label>
    <select v-model="selected" class="form-select">
      <option v-for="[value, label] in categories" :key="value" :value="value">
        {{ label }}
      </option>
    </select>

    <label class="form-label">Resumen (opcional)</label>
    <textarea
      v-model="summary"
      class="form-textarea"
      rows="3"
      placeholder="Describe brevemente de que trata el documento..."
    />

    <button class="submit-btn" @click="submit">
      Continuar sin analisis IA
    </button>
  </div>
</template>

<style scoped>
.manual-form {
  background: var(--bg-card, #1a1f2e);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #e8eaed);
}

.form-desc {
  font-size: 12px;
  color: var(--text-muted, #8b95a5);
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #8b95a5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-select,
.form-textarea {
  background: var(--bg-deep, #080e14);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text, #e8eaed);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.form-select:focus,
.form-textarea:focus {
  border-color: var(--primary, #594FD3);
}

.form-textarea {
  resize: vertical;
}

.submit-btn {
  background: var(--primary, #594FD3);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
}
</style>
