<template>
  <div class="min-h-screen bg-[#0f1923] text-[#e2e8f0]">
    <!-- Header -->
    <div class="px-4 pt-6 pb-4 flex items-center gap-3">
      <button class="text-[#94a3b8]" @click="$router.back()">← Volver</button>
      <h1 class="text-lg font-semibold">Historial de dictámenes</h1>
    </div>

    <!-- Filter row -->
    <div class="px-4 mb-4 flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="f in filters"
        :key="f.key"
        class="whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="activeFilter === f.key ? 'bg-[#594FD3] text-white' : 'bg-[#1a1f2e] text-[#94a3b8]'"
        @click="activeFilter = f.key"
      >{{ f.label }}</button>
    </div>

    <!-- Search -->
    <div class="px-4 mb-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Buscar por nombre o cédula…"
        class="w-full bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-[#594FD3]"
      />
    </div>

    <!-- List -->
    <div class="px-4 space-y-3">
      <div v-if="filteredDictamenes.length === 0" class="bg-[#1a1f2e] rounded-2xl p-8 text-center">
        <p class="text-3xl mb-3">📋</p>
        <p class="text-[#94a3b8]">No hay dictámenes{{ activeFilter !== 'all' ? ' con este filtro' : '' }}</p>
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
