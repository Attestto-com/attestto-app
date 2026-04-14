<template>
  <div class="page-root min-h-screen">
    <!-- Header -->
    <div class="px-4 pt-6 pb-4 flex items-center gap-3">
      <button class="btn-back" @click="$router.back()">← Volver</button>
      <h1 class="text-lg font-semibold">Historial de dictámenes</h1>
    </div>

    <!-- Filter row -->
    <div class="px-4 mb-4 flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="f in filters"
        :key="f.key"
        class="whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="activeFilter === f.key ? 'filter-active' : 'filter-inactive'"
        @click="activeFilter = f.key"
      >{{ f.label }}</button>
    </div>

    <!-- Search -->
    <div class="px-4 mb-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Buscar por nombre o cédula…"
        class="search-input w-full rounded-xl px-4 py-3"
      />
    </div>

    <!-- List -->
    <div class="px-4 space-y-3">
      <div v-if="filteredDictamenes.length === 0" class="empty-state rounded-2xl p-8 text-center">
        <p class="text-3xl mb-3">📋</p>
        <p class="empty-text">No hay dictámenes{{ activeFilter !== 'all' ? ' con este filtro' : '' }}</p>
      </div>

      <DictamenCard
        v-for="draft in filteredDictamenes"
        :key="draft.draftId"
        :draft="draft"
        readonly
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDictamenStore } from '../stores/dictamen.store'
import DictamenCard from '../components/DictamenCard.vue'

const store = useDictamenStore()
const activeFilter = ref('all')
const searchQuery = ref('')

const filters = [
  { key: 'all', label: 'Todos' },
  { key: 'anchored', label: '⛓ Anclados' },
  { key: 'signed', label: '✅ Firmados' },
  { key: 'today', label: 'Hoy' },
  { key: 'month', label: 'Este mes' },
]

const today = new Date().toISOString().split('T')[0]
const thisMonth = today.slice(0, 7)

const filteredDictamenes = computed(() => {
  let list = store.signedDictamenes

  switch (activeFilter.value) {
    case 'anchored': list = list.filter((d) => d.status === 'anchored'); break
    case 'signed': list = list.filter((d) => d.status === 'signed'); break
    case 'today': list = list.filter((d) => d.examDate === today); break
    case 'month': list = list.filter((d) => d.examDate.startsWith(thisMonth)); break
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((d) =>
      d.patient.nombre.toLowerCase().includes(q) ||
      d.patient.apellidos.toLowerCase().includes(q) ||
      d.patient.cedula.includes(q)
    )
  }

  return list.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
})
</script>

<style scoped>
.page-root {
  background: var(--bg-base);
  color: var(--text-primary);
}

.btn-back {
  color: var(--text-muted);
}

.filter-active {
  background: var(--primary);
  color: white;
}

.filter-inactive {
  background: var(--bg-card);
  color: var(--text-muted);
}

.search-input {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
}

.empty-state {
  background: var(--bg-card);
}

.empty-text {
  color: var(--text-muted);
}
</style>
