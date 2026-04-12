<template>
  <q-page padding>
    <q-btn flat icon="arrow_back" label="Volver" @click="$router.push('/module/cr-identity/cr-identity')" class="q-mb-md" />

    <div class="text-h5 q-mb-md">Historial de Emision</div>

    <q-list v-if="issued.length > 0" bordered separator>
      <q-item v-for="record in issued" :key="record.vcId">
        <q-item-section avatar>
          <q-icon name="verified" color="positive" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ record.citizenName }}</q-item-label>
          <q-item-label caption>{{ record.nationalIdNumber }}</q-item-label>
          <q-item-label caption>{{ formatDate(record.issuedAt) }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-badge v-if="record.anchorTx" color="positive" label="Anclado" />
          <q-badge v-else color="warning" label="Pendiente" />
        </q-item-section>
        <q-item-section side>
          <div class="text-mono text-caption text-grey-6" style="max-width: 120px; overflow: hidden; text-overflow: ellipsis;">
            {{ record.vcId }}
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="text-center q-pa-xl text-grey-6">
      <q-icon name="history" size="48px" />
      <div class="text-body2 q-mt-md">No hay credenciales emitidas.</div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useIdentityStore } from '../stores/identity.store'

const { issued } = useIdentityStore()

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>
