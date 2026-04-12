<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">Credencial de Identidad</div>
    <div class="text-subtitle2 text-grey-6 q-mb-lg">Emision de credenciales notariales de identidad</div>

    <!-- Stats -->
    <div class="row q-gutter-md q-mb-lg">
      <q-card class="col-12 col-sm-4" flat bordered>
        <q-card-section>
          <div class="text-h4 text-primary">{{ pendingDrafts.length }}</div>
          <div class="text-caption text-grey-6">Borradores pendientes</div>
        </q-card-section>
      </q-card>
      <q-card class="col-12 col-sm-4" flat bordered>
        <q-card-section>
          <div class="text-h4 text-positive">{{ issued.length }}</div>
          <div class="text-caption text-grey-6">Credenciales emitidas</div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Actions -->
    <q-btn
      color="primary"
      icon="add"
      label="Nueva credencial"
      class="q-mb-lg"
      @click="$router.push('/module/cr-identity/cr-identity/nueva')"
    />

    <!-- Pending Drafts -->
    <div v-if="pendingDrafts.length > 0" class="q-mb-lg">
      <div class="text-subtitle1 q-mb-sm">Borradores pendientes</div>
      <q-list bordered separator>
        <q-item
          v-for="draft in pendingDrafts"
          :key="draft.draftId"
          clickable
          @click="$router.push(`/module/cr-identity/cr-identity/revision/${draft.draftId}`)"
        >
          <q-item-section avatar>
            <q-icon name="person" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ draft.citizen.fullName }}</q-item-label>
            <q-item-label caption>{{ draft.citizen.nationalId.number }} &middot; {{ draft.status }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" />
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- Recent Issuances -->
    <div v-if="issued.length > 0">
      <div class="text-subtitle1 q-mb-sm">
        Emitidas recientemente
        <q-btn
          flat dense size="sm" color="primary"
          label="Ver todo"
          @click="$router.push('/module/cr-identity/cr-identity/historial')"
        />
      </div>
      <q-list bordered separator>
        <q-item v-for="record in issued.slice(0, 5)" :key="record.vcId">
          <q-item-section avatar>
            <q-icon name="verified" color="positive" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ record.citizenName }}</q-item-label>
            <q-item-label caption>{{ record.nationalIdNumber }} &middot; {{ formatDate(record.issuedAt) }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-badge v-if="record.anchorTx" color="positive" label="Anclado" />
            <q-badge v-else color="warning" label="Pendiente" />
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- Empty state -->
    <div v-if="pendingDrafts.length === 0 && issued.length === 0" class="text-center q-pa-xl text-grey-6">
      <q-icon name="fingerprint" size="64px" class="q-mb-md" />
      <div class="text-h6">Sin credenciales</div>
      <div class="text-body2">Pulse "Nueva credencial" para emitir una credencial de identidad.</div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useIdentityStore } from '../stores/identity.store'

const { pendingDrafts, issued } = useIdentityStore()

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>
