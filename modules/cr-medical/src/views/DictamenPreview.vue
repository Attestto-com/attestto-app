<template>
  <div class="min-h-screen bg-[#0f1923] text-[#e2e8f0] pb-32">
    <!-- Header -->
    <div class="px-4 pt-6 pb-4 flex items-center gap-3">
      <button class="text-[#94a3b8]" @click="$router.back()">← Editar</button>
      <h1 class="text-lg font-semibold">Vista previa</h1>
    </div>

    <div v-if="!draft" class="px-4 text-[#94a3b8]">Cargando borrador…</div>

    <div v-else class="px-4 space-y-4">
      <!-- Official-style document card -->
      <div class="bg-[#1a1f2e] rounded-2xl overflow-hidden">
        <!-- Document header -->
        <div class="bg-[#594FD3] px-5 py-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-white/70 text-xs uppercase tracking-widest">República de Costa Rica</p>
              <h2 class="text-white font-bold text-lg mt-0.5">Dictamen Médico</h2>
              <p class="text-white/70 text-xs mt-0.5">Licencia de Conducir — COSEVI</p>
            </div>
            <span class="text-4xl">🏥</span>
          </div>
        </div>

        <!-- Patient section -->
        <div class="px-5 py-4 border-b border-[#0f1923]">
          <p class="text-[#94a3b8] text-xs uppercase tracking-widest mb-3">Paciente</p>
          <div class="grid grid-cols-2 gap-3">
            <InfoField label="Nombre" :value="`${draft.patient.nombre} ${draft.patient.apellidos}`" />
            <InfoField label="Cédula" :value="draft.patient.cedula" />
            <InfoField label="Fecha nacimiento" :value="draft.patient.fechaNacimiento" />
            <InfoField label="Nacionalidad" :value="draft.patient.nacionalidad" />
          </div>
        </div>

        <!-- Exam results section -->
        <div class="px-5 py-4 border-b border-[#0f1923]">
          <p class="text-[#94a3b8] text-xs uppercase tracking-widest mb-3">Resultados del examen</p>
          <div class="space-y-2">
            <ResultRow label="Visión" :result="draft.results.vision.visualField" />
            <ResultRow label="Audición" :result="draft.results.hearing.result" />
            <ResultRow label="Presión arterial" :result="draft.results.bloodPressure.result"
              :detail="`${draft.results.bloodPressure.systolic}/${draft.results.bloodPressure.diastolic} mmHg`" />
            <ResultRow label="Capacidades motoras" :result="draft.results.motor.coordination" />
            <ResultRow label="Evaluación psicológica" :result="draft.results.psychological.mentalStatus" />
          </div>

          <!-- Restrictions -->
          <div v-if="draft.results.vision.requiresLenses || draft.results.vision.daytimeOnly || draft.results.hearing.requiresHearingAid" class="mt-3">
            <p class="text-[#fbbf24] text-xs uppercase tracking-widest mb-2">Restricciones</p>
            <div class="space-y-1">
              <p v-if="draft.results.vision.requiresLenses" class="text-sm text-[#fbbf24]">⚠️ Uso obligatorio de lentes</p>
              <p v-if="draft.results.vision.daytimeOnly" class="text-sm text-[#fbbf24]">⚠️ Solo conducción diurna</p>
              <p v-if="draft.results.hearing.requiresHearingAid" class="text-sm text-[#fbbf24]">⚠️ Uso obligatorio de audífono</p>
            </div>
          </div>

          <div v-if="draft.results.observations" class="mt-3">
            <p class="text-[#94a3b8] text-xs uppercase tracking-widest mb-1">Observaciones</p>
            <p class="text-sm">{{ draft.results.observations }}</p>
          </div>
        </div>

        <!-- Approved categories -->
        <div class="px-5 py-4 border-b border-[#0f1923]">
          <p class="text-[#94a3b8] text-xs uppercase tracking-widest mb-3">Categorías aprobadas</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="cat in draft.approvedCategories"
              :key="cat"
              class="bg-[#594FD3]/20 text-[#594FD3] border border-[#594FD3]/40 px-3 py-1 rounded-full text-sm font-semibold"
            >{{ cat }}</span>
          </div>
        </div>

        <!-- Overall result -->
        <div class="px-5 py-4 border-b border-[#0f1923]">
          <div class="flex items-center justify-between">
            <p class="text-[#94a3b8] text-xs uppercase tracking-widest">Resultado general</p>
            <span
              class="font-bold text-lg"
              :class="{
                'text-[#4ade80]': draft.results.overallResult === 'pass',
                'text-[#fbbf24]': draft.results.overallResult === 'conditional',
                'text-[#ef4444]': draft.results.overallResult === 'fail',
              }"
            >
              {{ resultLabel }}
            </span>
          </div>
        </div>

        <!-- Validity and dates -->
        <div class="px-5 py-4 border-b border-[#0f1923]">
          <div class="grid grid-cols-2 gap-3">
            <InfoField label="Fecha de examen" :value="draft.examDate" />
            <InfoField label="Válido hasta" :value="draft.expiresAt" />
          </div>
        </div>

        <!-- Issuer -->
        <div class="px-5 py-4">
          <p class="text-[#94a3b8] text-xs uppercase tracking-widest mb-3">Médico firmante</p>
          <div class="grid grid-cols-2 gap-3">
            <InfoField label="Nombre" :value="`${draft.doctor.nombre} ${draft.doctor.apellidos}`" />
            <InfoField label="Colegiado #" :value="draft.doctor.numeroColegiado" />
            <InfoField label="Especialidad" :value="draft.doctor.especialidad" />
          </div>
        </div>
      </div>

      <!-- Legal note -->
      <div class="bg-[#1a1f2e] rounded-xl p-4">
        <p class="text-[#94a3b8] text-xs leading-relaxed">
          Al firmar este dictamen, el médico certifica bajo la fe de su colegiatura que realizó el
          examen físico y mental del paciente indicado y que los resultados son fidedignos. Este
          documento se emitirá como Credencial Verificable (VC) y será anclado en Solana para
          garantía de integridad.
        </p>
      </div>

      <!-- Error -->
      <div v-if="issueError" class="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl p-3">
        <p class="text-[#ef4444] text-sm">⚠️ {{ issueError }}</p>
      </div>
    </div>

    <!-- Bottom action -->
    <div class="fixed bottom-0 left-0 right-0 bg-[#0f1923] border-t border-[#1a1f2e] px-4 py-4">
      <button
        class="w-full bg-[#4ade80] text-[#0f1923] rounded-2xl py-4 font-bold text-base disabled:opacity-40"
        :disabled="issuing || !draft"
        @click="issue"
      >
        <span v-if="issuing">Firmando con vault… 🔐</span>
        <span v-else>🔐 Firmar y emitir dictamen</span>
      </button>
      <p class="text-center text-[#94a3b8] text-xs mt-2">Se solicitará confirmación biométrica</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDictamenStore } from '../stores/dictamen.store'
import { useDictamen } from '../composables/useDictamen'
import InfoField from '../components/InfoField.vue'
import ResultRow from '../components/ResultRow.vue'
import type { ModuleContext } from '@attestto/module-sdk'

const router = useRouter()
const route = useRoute()
const store = useDictamenStore()
const ctx = inject<ModuleContext>('attestto:module-context')!
const { issuing, issueError, issueDictamen } = useDictamen(ctx)

const draftId = route.params.draftId as string
const draft = computed(() => store.drafts.find((d) => d.draftId === draftId) ?? null)

const resultLabel = computed(() => {
  switch (draft.value?.results.overallResult) {
    case 'pass': return '✅ APTO'
    case 'conditional': return '⚠️ APTO CONDICIONAL'
    case 'fail': return '❌ NO APTO'
    default: return '—'
  }
})

async function issue() {
  const vc = await issueDictamen(draftId)
  if (vc) {
    router.push('/cr-medical')
    // Shell notification injected via ctx.pushInboxItem in useDictamen
  }
}
</script>
