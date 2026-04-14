<template>
  <div class="page-root min-h-screen">
    <!-- Header -->
    <div class="px-4 pt-6 pb-4 flex items-center justify-between">
      <div>
        <p class="text-muted text-sm">Módulo</p>
        <h1 class="text-xl font-semibold">🏥 Dictamen Médico</h1>
      </div>
      <button
        class="btn-primary text-white px-4 py-2 rounded-xl text-sm font-medium"
        @click="$router.push('/cr-medical/paciente')"
      >
        + Nuevo dictamen
      </button>
    </div>

    <!-- Doctor info card -->
    <div class="mx-4 mb-6 card-bg rounded-2xl p-4">
      <div class="flex items-center gap-3">
        <div class="avatar-circle w-10 h-10 rounded-full flex items-center justify-center text-lg">👨‍⚕️</div>
        <div>
          <p class="font-medium">{{ doctorName }}</p>
          <p class="text-muted text-sm">Colegiado #{{ doctorColNumber }}</p>
        </div>
        <div class="ml-auto">
          <span class="badge-active text-xs px-2 py-1 rounded-full">✅ Activo</span>
        </div>
      </div>
    </div>

    <!-- Pending drafts -->
    <section class="px-4 mb-6">
      <h2 class="text-muted text-xs font-semibold uppercase tracking-widest mb-3">
        En progreso ({{ pendingDrafts.length }})
      </h2>

      <div v-if="pendingDrafts.length === 0" class="card-bg rounded-2xl p-6 text-center">
        <p class="text-muted text-sm">Sin dictámenes pendientes</p>
        <p class="text-muted text-xs mt-1">Inicie un nuevo examen para comenzar</p>
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
        <h2 class="text-muted text-xs font-semibold uppercase tracking-widest">
          Emitidos recientes
        </h2>
        <button class="link-primary text-sm" @click="$router.push('/cr-medical/historial')">
          Ver todos →
        </button>
      </div>

      <div v-if="recentSigned.length === 0" class="card-bg rounded-2xl p-6 text-center">
        <p class="text-muted text-sm">Aún no ha emitido dictámenes</p>
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
        <div class="card-bg rounded-xl p-3 text-center">
          <p class="text-2xl font-bold stat-success">{{ stats.issuedToday }}</p>
          <p class="text-muted text-xs mt-1">Hoy</p>
        </div>
        <div class="card-bg rounded-xl p-3 text-center">
          <p class="text-2xl font-bold stat-primary-text">{{ stats.issuedMonth }}</p>
          <p class="text-muted text-xs mt-1">Este mes</p>
        </div>
        <div class="card-bg rounded-xl p-3 text-center">
          <p class="text-2xl font-bold stat-brand">{{ stats.issuedTotal }}</p>
          <p class="text-muted text-xs mt-1">Total</p>
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

<style scoped>
.page-root {
  background: var(--bg-base);
  color: var(--text-primary);
}

.text-muted {
  color: var(--text-muted);
}

.card-bg {
  background: var(--bg-card);
}

.btn-primary {
  background: var(--primary);
}

.link-primary {
  color: var(--primary);
}

.avatar-circle {
  background: color-mix(in srgb, var(--primary) 20%, transparent);
}

.badge-active {
  background: color-mix(in srgb, var(--success) 10%, transparent);
  color: var(--success);
}

.stat-success {
  color: var(--success);
}

.stat-primary-text {
  color: var(--text-primary);
}

.stat-brand {
  color: var(--primary);
}
</style>
