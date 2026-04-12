<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">Datos notariales</div>
      <div class="row q-gutter-sm">
        <div class="col-12"><strong>Notario:</strong> {{ notary.name }}</div>
        <div class="col-6"><strong>Carne:</strong> {{ notary.carneNumber }}</div>
        <div class="col-6"><strong>Protocolo:</strong> {{ notary.protocolNumber }}</div>
        <div class="col-12 text-caption text-grey-6"><strong>DID:</strong> {{ notary.did }}</div>
        <div class="col-12 text-caption text-grey-6"><strong>Colegio:</strong> {{ notary.colegioId }}</div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import type { NotaryData } from '../types/identity'

defineProps<{ notary: NotaryData }>()
</script>
