<template>
  <div class="min-h-screen bg-[#0f1923] text-[#e2e8f0]">
    <!-- Header -->
    <div class="px-4 pt-6 pb-4 flex items-center justify-between">
      <div>
        <p class="text-[#94a3b8] text-sm">Módulo</p>
        <h1 class="text-xl font-semibold">🏥 Dictamen Médico</h1>
      </div>
      <button
        class="bg-[#594FD3] text-white px-4 py-2 rounded-xl text-sm font-medium"
        @click="$router.push('/cr-medical/paciente')"
      >
        + Nuevo dictamen
      </button>
    </div>

    <!-- Doctor info card -->
    <div class="mx-4 mb-6 bg-[#1a1f2e] rounded-2xl p-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-[#594FD3]/20 flex items-center justify-center text-lg">👨‍⚕️</div>
        <div>
          <p class="font-medium">{{ doctorName }}</p>
          <p class="text-[#94a3b8] text-sm">Colegiado #{{ doctorColNumber }}</p>
        </div>
        <div class="ml-auto">
          <span class="bg-[#4ade80]/10 text-[#4ade80] text-xs px-2 py-1 rounded-full">✅ Activo</span>
        </div>
      </div>
    </div>

    <!-- Pending drafts -->
    <section class="px-4 mb-6">
      <h2 class="text-[#94a3b8] text-xs font-semibold uppercase tracking-widest mb-3">
        En progreso ({{ pendingDrafts.length }})
      </h2>

      <div v-if="pendingDrafts.length === 0" class="bg-[#1a1f2e] rounded-2xl p-6 text-center">
        <p class="text-[#94a3b8] text-sm">Sin dictámenes pendientes</p>
        <p class="text-[#94a3b8] text-xs mt-1">Inicie un nuevo examen para comenzar</p>
      </div>

      <DictamenCard
        v-for="draft in pendingDrafts"
        :key="draft.draftId"
        :draft="draft"
        class="mb-3"
        @click="$router.push(`/cr-medical/examen/${draft.patient.did}?draft=${draft.draftId}`)"
      />
    </section>

    <!-- Recent signed -->
    <section class="px-4 mb-6">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-[#94a3b8] text-xs font-semibold uppercase tracking-widest">
          Emitidos recientes
        </h2>
        <button class="text-[#594FD3] text-sm" @click="$router.push('/cr-medical/historial')">
          Ver todos →
        </button>
      </div>

      <div v-if="recentSigned.length === 0" class="bg-[#1a1f2e] rounded-2xl p-6 text-center">
        <p class="text-[#94a3b8] text-sm">Aún no ha emitido dictámenes</p>
      </div>

      <DictamenCard
        v-for="draft in recentSigned"
        :key="draft.draftId"
        :draft="draft"
        class="mb-3"
        readonly
      />
    </section>

    <!-- Stats row -->
    <section class="px-4 mb-8">
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-[#1a1f2e] rounded-xl p-3 text-center">
          <p class="text-2xl font-bold text-[#4ade80]">{{ stats.issuedToday }}</p>
          <p class="text-[#94a3b8] text-xs mt-1">Hoy</p>
        </div>
        <div class="bg-[#1a1f2e] rounded-xl p-3 text-center">
          <p class="text-2xl font-bold text-[#e2e8f0]">{{ stats.issuedMonth }}</p>
          <p class="text-[#94a3b8] text-xs mt-1">Este mes</p>
        </div>
        <div class="bg-[#1a1f2e] rounded-xl p-3 text-center">
          <p class="text-2xl font-bold text-[#594FD3]">{{ stats.issuedTotal }}</p>
          <p class="text-[#94a3b8] text-xs mt-1">Total</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useDictamenStore } from '../stores/dictamen.store'
import DictamenCard from '../components/DictamenCard.vue'
import type { ModuleContext } from '@attestto/module-sdk'

const ctx = inject<ModuleContext>('attestto:module-context')!
const store = useDictamenStore()

const pendingDrafts = computed(() => store.pendingDrafts)
const recentSigned = computed(() => store.signedDictamenes.slice(0, 5))

// Doctor info — comes from their Colegio de Médicos VC
const doctorName = computed(() => 'Dr. Cargando...')
const doctorColNumber = computed(() => '...')

const today = new Date().toISOString().split('T')[0]

const stats = computed(() => ({
  issuedToday: store.signedDictamenes.filter((d) => d.examDate === today).length,
  issuedMonth: store.signedDictamenes.filter((d) => d.examDate.startsWith(today.slice(0, 7))).length,
  issuedTotal: store.signedDictamenes.length,
}))
</script>
