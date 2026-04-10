<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useVaultStore } from '@/stores/vault'
import { useModulesStore } from '@/stores/modules'

const router = useRouter()
const vault = useVaultStore()
const modules = useModulesStore()

function handleLock() {
  vault.lock()
  router.replace({ name: 'lock' })
}
</script>

<template>
  <q-page class="settings-page" padding>
    <h2 class="page-title">Perfil</h2>

    <!-- Identity card -->
    <div class="identity-card">
      <q-icon name="person" size="40px" class="avatar" />
      <div class="identity-body">
        <div class="identity-name">{{ vault.displayName ?? 'Usuario' }}</div>
        <div class="identity-did">{{ vault.did ?? '—' }}</div>
      </div>
    </div>

    <!-- Sections -->
    <section class="settings-section">
      <h3 class="section-title">Seguridad</h3>
      <div class="setting-row">
        <span>Biometrico</span>
        <q-toggle :model-value="true" color="positive" disable />
      </div>
      <div class="setting-row">
        <span>PIN de respaldo</span>
        <q-toggle :model-value="true" color="positive" disable />
      </div>
    </section>

    <section class="settings-section">
      <h3 class="section-title">Accesibilidad</h3>
      <div class="setting-row">
        <span>Alto contraste</span>
        <q-toggle :model-value="false" color="primary" disable />
      </div>
      <div class="setting-row">
        <span>Asistente de voz</span>
        <q-toggle :model-value="false" color="primary" disable />
      </div>
    </section>

    <section class="settings-section">
      <h3 class="section-title">Datos y privacidad</h3>
      <div class="setting-row clickable">
        <span>Exportar vault</span>
        <q-icon name="chevron_right" />
      </div>
      <div class="setting-row clickable">
        <span>Exportar evidencia</span>
        <q-icon name="chevron_right" />
      </div>
      <div class="setting-row clickable danger">
        <span>Eliminar datos</span>
        <q-icon name="chevron_right" />
      </div>
    </section>

    <section class="settings-section">
      <h3 class="section-title">Modulos instalados</h3>
      <div
        v-for="m in modules.installedList"
        :key="m.id"
        class="setting-row clickable"
      >
        <span>{{ m.name }} v{{ m.version }}</span>
        <q-icon name="chevron_right" />
      </div>
      <div v-if="!modules.installedList.length" class="empty-hint">
        Ningun modulo instalado
      </div>
    </section>

    <section class="settings-section">
      <h3 class="section-title">Acerca de</h3>
      <div class="setting-row">
        <span>Version</span>
        <span class="setting-value">0.1.0</span>
      </div>
      <div class="setting-row">
        <span>Licencia</span>
        <span class="setting-value">Apache 2.0</span>
      </div>
    </section>

    <button class="lock-btn" @click="handleLock">
      <q-icon name="lock" size="18px" />
      Bloquear
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
