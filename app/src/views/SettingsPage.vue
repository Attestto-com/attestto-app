<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { useModulesStore } from '@/stores/modules'
import { useLlm } from '@/composables/useLlm'
import { setLocale, getLocale } from '@/i18n'

const { t } = useI18n()
const router = useRouter()
const vault = useVaultStore()
const modules = useModulesStore()
const llm = useLlm()

const currentLocale = computed(() => getLocale())
const llmSupported = computed(() => llm.supportsWebGpu())
const storageUsed = ref('')
const storageQuota = ref('')
const storagePct = ref(0)

onMounted(async () => {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate()
    const used = est.usage ?? 0
    const quota = est.quota ?? 0
    storageUsed.value = formatBytes(used)
    storageQuota.value = formatBytes(quota)
    storagePct.value = quota > 0 ? Math.round((used / quota) * 100) : 0
  }
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function toggleLlm() {
  if (llm.enabled.value) {
    llm.disable()
  } else {
    llm.enable()
  }
}

function startDownload() {
  llm.init().catch(() => { /* error shown via llm.errorMessage */ })
}

async function deleteLlmCache() {
  await llm.deleteCache()
}

function toggleLocale() {
  setLocale(currentLocale.value === 'es' ? 'en' : 'es')
}

function handleLock() {
  vault.lock()
  router.replace({ name: 'lock' })
}
</script>

<template>
  <q-page class="settings-page" padding>
    <h2 class="page-title">{{ t('settings.profile') }}</h2>

    <!-- Identity card -->
    <div class="identity-card">
      <q-icon name="person" size="40px" class="avatar" />
      <div class="identity-body">
        <div class="identity-name">{{ vault.displayName ?? t('settings.userFallback') }}</div>
        <div class="identity-did">{{ vault.did ?? '—' }}</div>
      </div>
    </div>

    <!-- Sections -->
    <section class="settings-section">
      <h3 class="section-title">{{ t('settings.security') }}</h3>
      <div class="setting-row">
        <span>{{ t('settings.biometric') }}</span>
        <q-toggle :model-value="true" color="positive" disable />
      </div>
      <div class="setting-row">
        <span>{{ t('settings.backupPin') }}</span>
        <q-toggle :model-value="true" color="positive" disable />
      </div>
    </section>

    <section class="settings-section">
      <h3 class="section-title">{{ t('settings.accessibility') }}</h3>
      <div class="setting-row">
        <span>{{ t('settings.highContrast') }}</span>
        <q-toggle :model-value="false" color="primary" disable />
      </div>
      <div class="setting-row">
        <span>{{ t('settings.voiceAssistant') }}</span>
        <q-toggle :model-value="false" color="primary" disable />
      </div>
      <div class="setting-row clickable" @click="toggleLocale">
        <span>Idioma / Language</span>
        <span class="setting-value">{{ currentLocale === 'es' ? 'Espanol' : 'English' }}</span>
      </div>
    </section>

    <section v-if="llmSupported" class="settings-section">
      <h3 class="section-title">IA EN DISPOSITIVO</h3>
      <div class="setting-row">
        <div>
          <span>Preguntas con IA</span>
          <div class="setting-hint">Genera preguntas unicas con Gemma 2 ({{ llm.modelSize }})</div>
        </div>
        <q-toggle :model-value="llm.enabled.value" color="primary" @update:model-value="toggleLlm" />
      </div>
      <div v-if="llm.enabled.value && storageQuota" class="setting-row">
        <span>Almacenamiento</span>
        <span class="setting-value">{{ storageUsed }} / {{ storageQuota }} ({{ storagePct }}%)</span>
      </div>
      <div v-if="llm.enabled.value && llm.status.value === 'downloading'" class="setting-row">
        <span>Descargando modelo...</span>
        <div class="download-progress">
          <div class="download-bar" :style="{ width: `${llm.downloadProgress.value}%` }" />
        </div>
        <span class="setting-value">{{ llm.downloadProgress.value }}%</span>
      </div>
      <div v-else-if="llm.enabled.value && llm.status.value === 'loading'" class="setting-row">
        <span>Inicializando IA...</span>
        <q-spinner-dots size="16px" color="primary" />
      </div>
      <div v-else-if="llm.enabled.value && llm.status.value === 'ready'" class="setting-row">
        <span>Estado</span>
        <span class="setting-value setting-success">Listo</span>
      </div>
      <div v-else-if="llm.enabled.value && llm.modelCached.value && llm.status.value === 'idle'" class="setting-row clickable" @click="startDownload">
        <span>Modelo en cache — toca para iniciar</span>
        <q-icon name="play_arrow" />
      </div>
      <div v-else-if="llm.enabled.value && !llm.modelCached.value" class="setting-row clickable" @click="startDownload">
        <span>Descargar modelo ({{ llm.modelSize }})</span>
        <q-icon name="download" />
      </div>
      <div v-if="llm.enabled.value && llm.status.value === 'error'" class="setting-row clickable" @click="startDownload">
        <span class="setting-error">{{ llm.errorMessage.value }}</span>
        <span class="setting-retry">Reintentar</span>
      </div>
      <div v-if="llm.modelCached.value" class="setting-row clickable danger" @click="deleteLlmCache">
        <span>Eliminar modelo descargado</span>
        <q-icon name="chevron_right" />
      </div>
    </section>

    <section class="settings-section">
      <h3 class="section-title">{{ t('settings.dataPrivacy') }}</h3>
      <div class="setting-row clickable">
        <span>{{ t('settings.exportVault') }}</span>
        <q-icon name="chevron_right" />
      </div>
      <div class="setting-row clickable">
        <span>{{ t('settings.exportEvidence') }}</span>
        <q-icon name="chevron_right" />
      </div>
      <div class="setting-row clickable danger">
        <span>{{ t('settings.deleteData') }}</span>
        <q-icon name="chevron_right" />
      </div>
    </section>

    <section class="settings-section">
      <h3 class="section-title">{{ t('settings.installedModules') }}</h3>
      <div
        v-for="m in modules.installedList"
        :key="m.id"
        class="setting-row clickable"
      >
        <span>{{ m.name }} v{{ m.version }}</span>
        <q-icon name="chevron_right" />
      </div>
      <div v-if="!modules.installedList.length" class="empty-hint">
        {{ t('settings.noModules') }}
      </div>
    </section>

    <section class="settings-section">
      <h3 class="section-title">{{ t('settings.about') }}</h3>
      <div class="setting-row">
        <span>{{ t('settings.version') }}</span>
        <span class="setting-value">0.1.0</span>
      </div>
      <div class="setting-row">
        <span>{{ t('settings.license') }}</span>
        <span class="setting-value">Apache 2.0</span>
      </div>
    </section>

    <button class="lock-btn" @click="handleLock">
      <q-icon name="lock" size="18px" />
      {{ t('settings.lock') }}
    </button>
  </q-page>
</template>

<style scoped>
.settings-page {
  padding-bottom: 80px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: var(--space-lg);
}

.identity-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-bottom: var(--space-lg);
}

.avatar {
  color: var(--primary);
}

.identity-name {
  font-weight: 600;
  font-size: 16px;
}

.identity-did {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
}

.settings-section {
  margin-bottom: var(--space-lg);
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-sm);
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-card);
  font-size: 14px;
}

.setting-row:first-of-type {
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.setting-row:last-of-type {
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
}

.setting-row:only-of-type {
  border-radius: var(--radius-sm);
}

.setting-row + .setting-row {
  border-top: 1px solid var(--border-subtle);
}

.setting-row.clickable {
  cursor: pointer;
}

.setting-row.danger span {
  color: var(--critical);
}

.setting-value {
  color: var(--text-muted);
  font-size: 13px;
}

.setting-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.setting-error {
  font-size: 12px;
  color: var(--critical);
}

.setting-success {
  color: var(--success) !important;
  font-weight: 600;
}

.setting-retry {
  font-size: 12px;
  color: var(--primary);
  font-weight: 600;
  white-space: nowrap;
}

.download-progress {
  flex: 1;
  height: 4px;
  background: var(--bg-elevated);
  border-radius: 2px;
  margin: 0 var(--space-sm);
  overflow: hidden;
}

.download-bar {
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  transition: width 0.3s;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-sm);
}

.lock-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-md);
  margin-top: var(--space-xl);
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
}
</style>
