<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const tabs = computed(() => [
  { name: 'home', label: t('nav.home'), icon: 'home' },
  { name: 'wallet', label: t('nav.wallet'), icon: 'account_balance_wallet' },
  // documents: hidden until vault document storage is wired
  { name: 'settings', label: t('nav.more'), icon: 'more_horiz' },
])

const active = computed(() => route.name as string)
</script>

<template>
  <nav class="bottom-nav safe-area-bottom">
    <button
      v-for="tab in tabs"
      :key="tab.name"
      :class="['nav-item', { active: active === tab.name }]"
      @click="router.push({ name: tab.name })"
    >
      <q-icon :name="tab.icon" size="24px" />
      <span class="nav-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: var(--bg-card);
  border-top: 1px solid var(--border-subtle);
  padding: var(--space-sm) 0;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-xs) var(--space-md);
  transition: color 0.15s;
}

.nav-item.active {
  color: var(--primary);
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
}
</style>
