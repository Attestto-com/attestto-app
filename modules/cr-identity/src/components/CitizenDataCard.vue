<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">Datos del ciudadano</div>
      <div class="row q-gutter-sm">
        <div class="col-12"><strong>Nombre:</strong> {{ citizen.fullName }}</div>
        <div class="col-6"><strong>Documento:</strong> {{ idLabel }} {{ citizen.nationalId.number }}</div>
        <div class="col-6"><strong>Pais:</strong> {{ citizen.nationalId.country }}</div>
        <div class="col-6"><strong>Nacimiento:</strong> {{ citizen.dateOfBirth }}</div>
        <div class="col-6"><strong>Nacionalidad:</strong> {{ citizen.nationality }}</div>
        <div v-if="citizen.maritalStatus" class="col-6"><strong>Estado civil:</strong> {{ maritalLabel }}</div>
        <div class="col-12 text-caption text-grey-6"><strong>DID:</strong> {{ citizen.did }}</div>
        <div class="col-12 text-caption text-grey-6"><strong>Foto:</strong> {{ citizen.photoHash }}</div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CitizenData } from '../types/identity'
import { NATIONAL_ID_LABELS, MARITAL_STATUS_LABELS } from '../types/identity'

const props = defineProps<{ citizen: CitizenData }>()

const idLabel = computed(() => NATIONAL_ID_LABELS[props.citizen.nationalId.type] ?? props.citizen.nationalId.type)
const maritalLabel = computed(() =>
  props.citizen.maritalStatus ? MARITAL_STATUS_LABELS[props.citizen.maritalStatus] ?? props.citizen.maritalStatus : '',
)
</script>
