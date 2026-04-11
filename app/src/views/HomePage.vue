<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { useInboxStore } from '@/stores/inbox'
import { useLlm } from '@/composables/useLlm'
import InboxCard from '@/components/InboxCard.vue'
import type { InboxItem } from '@attestto/module-sdk'

const { t } = useI18n()
const vault = useVaultStore()
const inbox = useInboxStore()
const router = useRouter()
const llm = useLlm()

const llmLabel = computed(() => {
  switch (llm.status.value) {
    case 'ready': return 'IA lista'
    case 'downloading': return `IA ${llm.downloadProgress.value}%`
    case 'loading': return 'IA cargando...'
    case 'generating': return 'IA generando...'
    case 'error': return 'IA error'
    default: return null
  }
})

function handleInboxTap(item: InboxItem) {
  if (item.route) router.push(item.route)
}

</script>

<template>
  <q-page class="home-page" padding>
    <header class="home-header">
      <div class="greeting">{{ t('home.greeting', { name: vault.displayName?.split(' ')[0] ?? t('home.userFallback') }) }}</div>
      <div class="header-actions">
        <span
          v-if="llmLabel"
          :class="['llm-chip', llm.status.value === 'ready' ? 'llm-green' : 'llm-loading']"
          @click="llm.status.value !== 'ready' && router.push({ name: 'settings' })"
          :style="{ cursor: llm.status.value !== 'ready' ? 'pointer' : 'default' }"
        >
          {{ llmLabel }}
        </span>
        <q-btn flat round icon="notifications_none" color="white" size="sm" />
        <q-btn flat round icon="person_outline" color="white" size="sm" @click="router.push({ name: 'settings' })" />
      </div>
    </header>

    <!-- Pending -->
    <section v-if="inbox.pending.length" class="section">
      <h3 class="section-title">{{ t('home.pending') }}</h3>
      <div class="card-stack">
        <InboxCard
          v-for="item in inbox.pending"
          :key="item.id"
          :item="item"
          @tap="handleInboxTap"
        />
      </div>
    </section>

    <!-- Empty state -->
    <div v-if="!inbox.pending.length && !inbox.recent.length" class="empty-state">
      <q-icon name="check_circle" size="48px" color="positive" />
      <p>{{ t('home.allCaughtUp') }}</p>
    </div>

    <!-- Recent -->
    <section v-if="inbox.recent.length" class="section">
      <h3 class="section-title">{{ t('home.recent') }}</h3>
      <div class="recent-list">
        <div v-for="item in inbox.recent" :key="item.id" class="recent-item">
          <q-icon :name="item.icon" size="16px" />
          <span class="recent-text">{{ item.title }}</span>
          <span class="recent-time">{{ new Date(item.timestamp).toLocaleDateString() }}</span>
        </div>
      </div>
    </section>

    <!-- AI feature card -->
    <section class="section ai-card" @click="router.push({ name: 'settings' })">
      <div class="ai-card-header">
        <q-icon name="psychology" size="20px" :style="{ color: llm.status.value === 'ready' ? 'var(--success)' : 'var(--warning)' }" />
        <span class="ai-card-title">IA en tu dispositivo</span>
        <span :class="['ai-status-dot', llm.status.value === 'ready' ? 'dot-green' : 'dot-yellow']" />
      </div>
      <p class="ai-card-desc">
        <template v-if="llm.status.value === 'ready'">
          Gemma 2B activa — genera preguntas unicas con inteligencia artificial, 100% offline. Tus datos nunca salen de tu dispositivo.
        </template>
        <template v-else-if="llm.status.value === 'downloading'">
          Descargando modelo Gemma 2B (1.3 GB)... Una vez descargado, funciona sin internet.
        </template>
        <template v-else-if="llm.status.value === 'loading'">
          Cargando modelo en GPU... Unos segundos mas.
        </template>
        <template v-else>
          Activa la IA local en Configuracion para generar preguntas personalizadas con Gemma 2B. Sin servidores, sin conexion, 100% privado.
        </template>
      </p>
      <div class="ai-card-footer">
        <span v-if="llm.status.value === 'ready'" class="ai-tag ai-tag-green">Activa</span>
        <span v-else class="ai-tag ai-tag-yellow">Configurar</span>
        <q-icon name="chevron_right" size="16px" color="grey-6" />
      </div>
    </section>

  </q-page>
</template>

<style scoped>
.home-page {
  padding-bottom: 80px;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.greeting {
  font-size: 22px;
  font-weight: 700;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.llm-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.llm-green {
  background: rgba(74, 222, 128, 0.15);
  color: var(--success);
}

.llm-loading {
  background: rgba(89, 79, 211, 0.15);
  color: var(--primary);
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

.card-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl) 0;
  color: var(--text-muted);
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.recent-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 13px;
  color: var(--text-muted);
  padding: var(--space-xs) 0;
}

.recent-text {
  flex: 1;
}

.recent-time {
  font-size: 11px;
}

.ai-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  cursor: pointer;
  transition: background 0.15s;
}

.ai-card:active {
  background: var(--bg-elevated);
}

.ai-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.ai-card-title {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
}

.ai-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-green {
  background: var(--success);
  box-shadow: 0 0 6px var(--success);
}

.dot-yellow {
  background: var(--warning);
  box-shadow: 0 0 6px var(--warning);
  animation: dot-pulse 2s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.ai-card-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: var(--space-sm);
}

.ai-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ai-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.ai-tag-green {
  background: rgba(74, 222, 128, 0.15);
  color: var(--success);
}

.ai-tag-yellow {
  background: rgba(251, 191, 36, 0.15);
  color: var(--warning);
}

</style>
