<template>
  <div class="min-h-screen bg-[#0f1923] text-[#e2e8f0]">
    <!-- Header -->
    <div class="px-4 pt-6 pb-4 flex items-center gap-3">
      <button class="text-[#94a3b8]" @click="$router.back()">← Volver</button>
      <h1 class="text-lg font-semibold">Identificar paciente</h1>
    </div>

    <!-- QR Scan option -->
    <div class="mx-4 mb-4">
      <button
        class="w-full bg-[#594FD3] text-white rounded-2xl p-5 flex items-center gap-4"
        @click="startQRScan"
      >
        <span class="text-3xl">📷</span>
        <div class="text-left">
          <p class="font-semibold">Escanear QR del paciente</p>
          <p class="text-[#a09de8] text-sm mt-0.5">El paciente muestra su QR de identidad</p>
        </div>
      </button>
    </div>

    <!-- Divider -->
    <div class="flex items-center gap-3 px-4 mb-4">
      <div class="flex-1 h-px bg-[#1a1f2e]"></div>
      <span class="text-[#94a3b8] text-sm">o ingrese manualmente</span>
      <div class="flex-1 h-px bg-[#1a1f2e]"></div>
    </div>

    <!-- Manual entry form -->
    <div class="mx-4 bg-[#1a1f2e] rounded-2xl p-4 space-y-4">
      <div>
        <label class="block text-[#94a3b8] text-xs mb-1">Cédula / DIMEX</label>
        <input
          v-model="form.cedula"
          type="text"
          inputmode="numeric"
          placeholder="1-0501-0001"
          class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-[#594FD3]"
        />
      </div>
      <div>
        <label class="block text-[#94a3b8] text-xs mb-1">Nombre</label>
        <input
          v-model="form.nombre"
          type="text"
          placeholder="Juan"
          class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-[#594FD3]"
        />
      </div>
      <div>
        <label class="block text-[#94a3b8] text-xs mb-1">Apellidos</label>
        <input
          v-model="form.apellidos"
          type="text"
          placeholder="Mora Rodríguez"
          class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] placeholder-[#94a3b8] focus:outline-none focus:border-[#594FD3]"
        />
      </div>
      <div>
        <label class="block text-[#94a3b8] text-xs mb-1">Fecha de nacimiento</label>
        <input
          v-model="form.fechaNacimiento"
          type="date"
          class="w-full bg-[#0f1923] border border-[#2a2f3e] rounded-xl px-4 py-3 text-[#e2e8f0] focus:outline-none focus:border-[#594FD3]"
        />
      </div>
    </div>

    <!-- Patient resolved card (after QR scan) -->
    <div v-if="patient" class="mx-4 mt-4 bg-[#1a1f2e] border border-[#4ade80]/30 rounded-2xl p-4">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🪪</span>
        <div>
          <p class="font-medium">{{ patient.nombre }} {{ patient.apellidos }}</p>
          <p class="text-[#94a3b8] text-sm">Cédula: {{ patient.cedula }}</p>
          <p class="text-[#4ade80] text-xs mt-0.5">✅ Identidad verificada</p>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="mx-4 mt-4 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl p-3">
      <p class="text-[#ef4444] text-sm">⚠️ {{ error }}</p>
    </div>

    <!-- CTA -->
    <div class="px-4 mt-6">
      <button
        class="w-full bg-[#594FD3] text-white rounded-2xl py-4 font-semibold text-base disabled:opacity-40"
        :disabled="!canContinue || loading"
        @click="proceed"
      >
        <span v-if="loading">Verificando…</span>
        <span v-else>Iniciar examen →</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { usePatient } from '../composables/usePatient'
import { useDictamenStore } from '../stores/dictamen.store'
import type { ModuleContext } from '@attestto/module-sdk'
import type { PatientInfo } from '../types/dictamen'

const router = useRouter()
const ctx = inject<ModuleContext>('attestto:module-context')!
const { patient, loading, error, resolveFromDID, setManual } = usePatient(ctx)
const store = useDictamenStore()

const form = ref({
  cedula: '',
  nombre: '',
  apellidos: '',
  fechaNacimiento: '',
})

const canContinue = computed(() => {
  if (patient.value) return true
  return form.value.cedula && form.value.nombre && form.value.apellidos && form.value.fechaNacimiento
})

async function startQRScan() {
  // Shell QR scanner — in real app, opens camera via shell bridge
  // On scan success, we receive a DID or VC offer URL
  const fakeDID = 'did:sns:paciente.sol'  // Placeholder — real QR decoder here
  await resolveFromDID(fakeDID)
}

async function proceed() {
  let resolvedPatient: PatientInfo | null = patient.value

  if (!resolvedPatient) {
    // Manual entry — no DID, create a local-only patient record
    resolvedPatient = {
      did: `did:local:${form.value.cedula}`,
      cedula: form.value.cedula,
      nombre: form.value.nombre,
      apellidos: form.value.apellidos,
      fechaNacimiento: form.value.fechaNacimiento,
      nacionalidad: 'CR',
    }
    setManual(resolvedPatient)
  }

  // Create doctor info from their vault VC (placeholder — real impl via ctx)
  const doctorInfo = {
    did: 'did:sns:doctor.sol',   // From vault
    nombre: 'Dr.',               // From ColegioMedicosVC
    apellidos: '',
    numeroColegiado: '00000',
    especialidad: 'Medicina General',
    consultorio: '',
  }

  const draft = store.startNewDictamen(resolvedPatient, doctorInfo)
  router.push(`/cr-medical/examen/${resolvedPatient.did}?draft=${draft.draftId}`)
}
</script>
