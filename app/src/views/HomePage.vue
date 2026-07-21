<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useVaultStore } from '@/stores/vault'
import { useInboxStore } from '@/stores/inbox'
import { useLlm } from '@/composables/useLlm'
import { features } from '@/config/features'
import InboxCard from '@/components/InboxCard.vue'
import type { InboxItem } from '@attestto/module-sdk'

const { t } = useI18n()
const vault = useVaultStore()
const inbox = useInboxStore()
const router = useRouter()
const llm = useLlm()
const aiCardDismissed = ref(false)

const firstName = computed(() => vault.displayName?.split(' ')[0] || t('home.userFallback'))

const didShort = computed(() => {
  if (!vault.did) return ''
  const s = vault.did
  return s.length > 24 ? `${s.slice(0, 14)}…${s.slice(-6)}` : s
})

// Progressive verification tier — mock L0 until CORTEX wiring lands
const tier = computed(() => (vault.credentials.length > 0 ? 'L1' : 'L0'))

const credentialsPreview = computed(() => vault.credentials.slice(0, 3))
const isFirstRun = computed(() => vault.credentials.length === 0)
const showPending = computed(() => features.showModuleInbox && inbox.pending.length > 0)
const showRecent = computed(() => features.showModuleInbox && inbox.recent.length > 0)

const llmLabel = computed(() => {
  if (!features.showLlm) return null
  switch (llm.status.value) {
    case 'ready': return 'IA lista'
    case 'downloading': return `IA ${llm.downloadProgress.value}%`
    case 'loading': return 'IA cargando...'
    case 'generating': return 'IA generando...'
    case 'error': return 'IA error'
    default: return null
  }
})

const showAiCard = computed(() => features.showLlmCard && !aiCardDismissed.value)

watch(() => llm.status.value, (s) => {
  if (s === 'ready') {
    setTimeout(() => { aiCardDismissed.value = true }, 5000)
  }
})

function handleInboxTap(item: InboxItem) {
  if (item.route) router.push(item.route)
}

function handleAiCardTap() {
  const s = llm.status.value
  if (s === 'ready') { aiCardDismissed.value = true; return }
  if (s === 'downloading' || s === 'loading' || s === 'unsupported') return
  if (s === 'idle' || s === 'error') {
    llm.enable()
    llm.init()
  }
}

const isPWA = window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as { standalone?: boolean }).standalone === true
</script>

<template>
  <q-page class="home-page" padding>
    <header class="home-header">
      <div class="greeting">{{ isFirstRun ? '' : t('home.greeting', { name: firstName }) }}</div>
      <div class="header-actions">
        <span
          v-if="llmLabel"
          :class="['llm-chip', llm.status.value === 'ready' ? 'llm-green' : 'llm-loading']"
          @click="llm.status.value !== 'ready' && router.push({ name: 'settings' })"
          :style="{ cursor: llm.status.value !== 'ready' ? 'pointer' : 'default' }"
        >
          {{ llmLabel }}
        </span>
        <q-btn flat round icon="person_outline" color="white" size="sm" @click="router.push({ name: 'settings' })" />
      </div>
    </header>

    <!-- First-run hero: minimal, single CTA -->
    <div v-if="isFirstRun" class="hero">
      <div class="hero-mark">
        <q-icon name="badge" size="72px" :style="{ color: 'var(--primary)' }" />
      </div>
      <div class="hero-title">{{ t('home.welcome') }}</div>
      <button class="hero-btn" @click="router.push({ name: 'receive-credential' })">
        {{ t('home.getStarted') }}
      </button>
    </div>

    <!-- Returning-user dashboard -->
    <template v-else>
    <!-- Identity card -->
    <section class="identity-card">
      <div class="identity-row">
        <q-icon name="badge" size="24px" :style="{ color: 'var(--primary)' }" />
        <div class="identity-body">
          <div class="identity-name">{{ vault.displayName || t('home.userFallback') }}</div>
          <div class="identity-did">{{ didShort }}</div>
        </div>
        <span :class="['tier-badge', `tier-${tier.toLowerCase()}`]">{{ tier }}</span>
      </div>
    </section>

    <!-- Quick actions -->
    <section class="section">
      <div class="quick-actions">
        <button class="qa-btn" @click="router.push({ name: 'present-credentials' })">
          <q-icon name="qr_code_2" size="22px" />
          <span>{{ t('home.present') }}</span>
        </button>
        <button class="qa-btn" @click="router.push({ name: 'receive-credential' })">
          <q-icon name="download" size="22px" />
          <span>{{ t('home.receive') }}</span>
        </button>
        <button class="qa-btn" @click="router.push({ name: 'verify' })">
          <q-icon name="check_circle" size="22px" />
          <span>{{ t('home.verify') }}</span>
        </button>
      </div>
    </section>

    <!-- Credentials preview strip -->
    <section class="section">
      <div class="section-head">
        <h3 class="section-title">{{ t('home.myCredentials') }}</h3>
        <button v-if="vault.credentials.length" class="link-btn" @click="router.push({ name: 'wallet' })">
          {{ t('home.viewAll') }} →
        </button>
      </div>
      <div v-if="credentialsPreview.length" class="cred-strip">
        <div
          v-for="vc in credentialsPreview"
          :key="String(vc.id ?? Math.random())"
          class="cred-tile"
          @click="router.push({ name: 'credential-detail', params: { id: String(vc.id ?? '') } })"
        >
          <q-icon name="verified" size="20px" :style="{ color: 'var(--success)' }" />
          <div class="cred-title">{{ Array.isArray(vc.type) ? vc.type[vc.type.length - 1] : t('credential.fallbackType') }}</div>
        </div>
      </div>
    </section>
    </template>

    <!-- Pending inbox (feature-flagged) -->
    <section v-if="showPending" class="section">
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

    <!-- Recent inbox (feature-flagged) -->
    <section v-if="showRecent" class="section">
      <h3 class="section-title">{{ t('home.recent') }}</h3>
      <div class="recent-list">
        <div v-for="item in inbox.recent" :key="item.id" class="recent-item">
          <q-icon :name="item.icon" size="16px" />
          <span class="recent-text">{{ item.title }}</span>
          <span class="recent-time">{{ new Date(item.timestamp).toLocaleDateString() }}</span>
        </div>
      </div>
    </section>

    <!-- AI feature card (feature-flagged, hidden by default) -->
    <section v-if="showAiCard" class="section ai-card" @click="handleAiCardTap">
      <div class="ai-card-header">
        <q-icon name="psychology" size="20px" :style="{ color: llm.status.value === 'ready' ? 'var(--success)' : 'var(--primary)' }" />
        <span class="ai-card-title">IA en tu dispositivo</span>
        <span :class="['ai-status-dot', llm.status.value === 'ready' ? 'dot-green' : 'dot-purple']" />
      </div>
      <p class="ai-card-desc">
        <template v-if="llm.status.value === 'ready'">Gemma 2B activa, offline.</template>
        <template v-else-if="llm.status.value === 'downloading'">Descargando modelo ({{ llm.downloadProgress.value }}%)...</template>
        <template v-else>Toca para activar ({{ llm.modelSize }}).</template>
      </p>
      <p v-if="!isPWA" class="ai-install-note">
        ~1.3 GB requeridos. <a href="/downloads" @click.stop>Instala la app</a>.
      </p>
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

.llm-green { background: rgba(74, 222, 128, 0.15); color: var(--success); }
.llm-loading { background: rgba(89, 79, 211, 0.15); color: var(--primary); }

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  min-height: 60dvh;
  padding: 0 var(--space-lg);
  text-align: center;
}

.hero-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  background: rgba(89, 79, 211, 0.12);
}

.hero-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}

.hero-btn {
  padding: 14px 40px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
}

.hero-btn:active {
  transform: scale(0.97);
  background: color-mix(in srgb, var(--primary) 85%, black);
}

.identity-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-bottom: var(--space-lg);
}

.identity-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.identity-body {
  flex: 1;
  min-width: 0;
}

.identity-name {
  font-size: 15px;
  font-weight: 600;
}

.identity-did {
  font-size: 11px;
  color: var(--text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  margin-top: 2px;
}

.tier-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: rgba(89, 79, 211, 0.15);
  color: var(--primary);
}

.tier-l0 { background: rgba(148, 163, 184, 0.15); color: var(--text-muted); }
.tier-l1 { background: rgba(89, 79, 211, 0.15); color: var(--primary); }

.section {
  margin-bottom: var(--space-lg);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-sm);
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.link-btn {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
}

.qa-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-md) 0;
  background: var(--bg-card);
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-base, white);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.qa-btn:active {
  background: var(--bg-elevated);
}

.cred-strip {
  display: flex;
  gap: var(--space-sm);
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.cred-strip::-webkit-scrollbar { display: none; }

.cred-tile {
  flex: 0 0 128px;
  padding: var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.cred-title {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-cred {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-lg) var(--space-md);
  background: var(--bg-card);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 13px;
}

.empty-cred p {
  margin: 0;
}

.primary-btn {
  padding: 8px 16px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.card-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
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

.recent-text { flex: 1; }
.recent-time { font-size: 11px; }

.ai-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  cursor: pointer;
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

.dot-green { background: var(--success); box-shadow: 0 0 6px var(--success); }
.dot-purple { background: var(--primary); box-shadow: 0 0 6px var(--primary); }

.ai-card-desc {
  font-size: 12px;
  color: var(--text-secondary, #cbd5e1);
  line-height: 1.5;
  margin: 0;
}

.ai-install-note {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
  line-height: 1.5;
}

.ai-install-note a {
  color: var(--primary);
  font-weight: 600;
  text-decoration: none;
}
</style>
