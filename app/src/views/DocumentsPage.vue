<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()

interface DocItem {
  id: string
  name: string
  status: 'pending' | 'signed' | 'anchored'
  date: string
}

const documents = ref<DocItem[]>([])

const statusConfig = computed(() => ({
  pending: { label: t('documents.pendingSignature'), icon: 'schedule', color: 'var(--alert)' },
  signed: { label: t('documents.signed'), icon: 'check_circle', color: 'var(--success)' },
  anchored: { label: t('documents.signedAnchored'), icon: 'link', color: 'var(--success)' },
}))
</script>

<template>
  <q-page class="docs-page" padding>
    <header class="page-header">
      <h2 class="page-title">{{ $t('firmar.title') }}</h2>
      <q-btn flat round icon="person_outline" color="white" size="sm" @click="router.push({ name: 'settings' })" />
    </header>

    <div class="action-row">
      <button class="action-btn primary" @click="() => {}">
        <q-icon name="draw" size="22px" />
        <span>{{ $t('firmar.signNew') }}</span>
      </button>
      <button class="action-btn" @click="router.push({ name: 'verify' })">
        <q-icon name="check_circle" size="22px" />
        <span>{{ $t('firmar.verify') }}</span>
      </button>
    </div>

    <div v-if="documents.length" class="doc-list">
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="doc-card"
        @click="router.push({ name: 'pdf-viewer', params: { id: doc.id } })"
      >
        <q-icon name="description" size="24px" class="doc-icon" />
        <div class="doc-body">
          <div class="doc-name">{{ doc.name }}</div>
          <div class="doc-status" :style="{ color: statusConfig[doc.status].color }">
            <q-icon :name="statusConfig[doc.status].icon" size="14px" />
            {{ statusConfig[doc.status].label }}
          </div>
          <div class="doc-date">{{ doc.date }}</div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <q-icon name="folder_open" size="48px" color="grey-6" />
      <p>{{ $t('firmar.noDocuments') }}</p>
    </div>
  </q-page>
</template>

<style scoped>
.docs-page {
  padding-bottom: 80px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}

.action-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.action-btn {
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

.action-btn:active { background: var(--bg-elevated); }

.action-btn.primary {
  background: var(--primary);
  color: white;
}

.action-btn.primary:active {
  background: color-mix(in srgb, var(--primary) 85%, black);
}

.doc-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.doc-card {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  cursor: pointer;
  transition: background 0.15s;
}

.doc-card:active {
  background: var(--bg-elevated);
}

.doc-icon {
  color: var(--text-muted);
  margin-top: 2px;
}

.doc-body {
  flex: 1;
}

.doc-name {
  font-weight: 600;
  font-size: 14px;
}

.doc-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  margin-top: 4px;
}

.doc-date {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xl) 0;
  color: var(--text-muted);
}

.add-doc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-md);
  margin-top: var(--space-md);
  background: var(--bg-card);
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.add-doc-btn:active {
  background: var(--bg-elevated);
}
</style>
