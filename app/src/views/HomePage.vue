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

const quickActions = [
  { icon: 'qr_code_scanner', labelKey: 'home.scan', action: () => router.push({ name: 'verify' }) },
  { icon: 'payment', labelKey: 'home.pay', action: () => {} },
  { icon: 'verified', labelKey: 'home.verify', action: () => router.push({ name: 'verify' }) },
]
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

    <!-- Quick actions -->
    <section class="section">
      <h3 class="section-title">{{ t('home.quickActions') }}</h3>
      <div class="quick-actions">
        <button
          v-for="qa in quickActions"
          :key="qa.labelKey"
          class="quick-action"
          @click="qa.action"
        >
          <q-icon :name="qa.icon" size="24px" />
          <span>{{ t(qa.labelKey) }}</span>
        </button>
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

.quick-actions {
  display: flex;
  gap: var(--space-sm);
}

.quick-action {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-md);
  background: var(--bg-card);
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}

.quick-action:active {
  background: var(--bg-elevated);
}
</style>
