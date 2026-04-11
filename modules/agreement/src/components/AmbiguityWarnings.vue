<script setup lang="ts">
defineProps<{ ambiguities: string[]; undiscussedTerms: string[] }>()
</script>

<template>
  <div class="warnings">
    <div v-if="ambiguities.length > 0" class="warn-section">
      <span class="warn-label">Ambiguedades detectadas</span>
      <div v-for="(a, i) in ambiguities" :key="'a' + i" class="warn-card warn-yellow">
        <span class="material-icons-outlined warn-icon">warning</span>
        <span>{{ a }}</span>
      </div>
    </div>

    <div v-if="undiscussedTerms.length > 0" class="warn-section">
      <span class="warn-label">Terminos no discutidos (sugeridos)</span>
      <div v-for="(t, i) in undiscussedTerms" :key="'u' + i" class="warn-card warn-blue">
        <span class="material-icons-outlined warn-icon">info</span>
        <span>{{ t }}</span>
      </div>
    </div>

    <div v-if="ambiguities.length === 0 && undiscussedTerms.length === 0" class="empty">
      <span class="material-icons-outlined" style="color: #4ade80">check_circle</span>
      <span>No se detectaron ambiguedades ni terminos faltantes</span>
    </div>
  </div>
</template>

<style scoped>
.warnings { display: flex; flex-direction: column; gap: 12px; }
.warn-section { display: flex; flex-direction: column; gap: 6px; }
.warn-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #8b95a5); }
.warn-card { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; font-size: 13px; color: var(--text, #e8eaed); line-height: 1.4; }
.warn-yellow { background: rgba(251, 191, 36, 0.08); }
.warn-blue { background: rgba(96, 165, 250, 0.08); }
.warn-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
.warn-yellow .warn-icon { color: #fbbf24; }
.warn-blue .warn-icon { color: #60a5fa; }
.empty { display: flex; align-items: center; gap: 8px; padding: 12px; background: rgba(74, 222, 128, 0.08); border-radius: 8px; font-size: 13px; color: var(--text, #e8eaed); }
</style>
