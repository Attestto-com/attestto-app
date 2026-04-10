<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useModulesStore } from '@/stores/modules'

const router = useRouter()
const modules = useModulesStore()

const countryFlags: Record<string, string> = {
  CR: '🇨🇷',
  US: '🇺🇸',
  BR: '🇧🇷',
  MX: '🇲🇽',
  PA: '🇵🇦',
}
</script>

<template>
  <q-page class="modules-page" padding>
    <header class="modules-header">
      <q-btn flat round icon="arrow_back" color="white" @click="router.back()" />
      <span class="modules-title">Modulos</span>
    </header>

    <!-- Installed -->
    <section v-if="modules.installedList.length" class="section">
      <h3 class="section-title">Instalados</h3>
      <div class="module-list">
        <div
          v-for="m in modules.installedList"
          :key="m.id"
          class="module-card"
        >
          <span class="module-flag">{{ countryFlags[m.country] ?? '🌐' }}</span>
          <div class="module-body">
            <div class="module-name">{{ m.name }}</div>
            <div class="module-desc">{{ m.description }}</div>
          </div>
          <span class="module-version">v{{ m.version }}</span>
        </div>
      </div>
    </section>

    <!-- Available -->
    <section class="section">
      <h3 class="section-title">Disponibles</h3>

      <div v-if="!modules.availableForUser.length" class="empty-hint">
        No hay modulos adicionales disponibles
      </div>

      <div class="module-list">
        <div
          v-for="{ manifest, gate } in modules.availableForUser"
          :key="manifest.id"
          class="module-card"
        >
          <span class="module-flag">{{ countryFlags[manifest.country] ?? '🌐' }}</span>
          <div class="module-body">
            <div class="module-name">{{ manifest.name }}</div>
            <div class="module-desc">{{ manifest.description }}</div>
            <div v-if="!gate.allowed" class="module-gate">
              Requiere: {{ gate.missing.join(', ') }}
            </div>
          </div>
          <button
            v-if="gate.allowed"
            class="install-btn"
          >
            Instalar
          </button>
          <span v-else class="locked-badge">
            <q-icon name="lock" size="16px" />
          </span>
        </div>
      </div>
    </section>
  </q-page>
</template>

<style scoped>
.modules-page {
  padding-bottom: 80px;
}

.modules-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.modules-title {
  font-size: 18px;
  font-weight: 600;
}

.section {
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

.module-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.module-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.module-flag {
  font-size: 24px;
}

.module-body {
  flex: 1;
  min-width: 0;
}

.module-name {
  font-weight: 600;
  font-size: 14px;
}

.module-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.module-gate {
  font-size: 11px;
  color: var(--warning);
  margin-top: 4px;
}

.module-version {
  font-size: 12px;
  color: var(--text-muted);
}

.install-btn {
  padding: 6px 14px;
  background: var(--primary);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.locked-badge {
  color: var(--text-muted);
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  padding: var(--space-md) 0;
}
</style>
