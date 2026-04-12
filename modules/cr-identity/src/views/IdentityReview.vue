<template>
  <q-page padding>
    <q-btn flat icon="arrow_back" label="Volver" @click="$router.push('/module/cr-identity/cr-identity')" class="q-mb-md" />

    <div v-if="!draft" class="text-center q-pa-xl text-grey-6">
      <q-icon name="error_outline" size="48px" />
      <div class="text-h6 q-mt-md">Borrador no encontrado</div>
    </div>

    <template v-else>
      <div class="text-h5 q-mb-md">Revision de Credencial</div>

      <!-- Status badge -->
      <q-badge :color="statusColor" :label="statusLabel" class="q-mb-lg" />

      <!-- Citizen summary -->
      <citizen-data-card :citizen="draft.citizen" />

      <!-- Evidence -->
      <div class="q-mt-md">
        <evidence-checklist :evidence="draft.evidence" />
      </div>

      <!-- Organization roles -->
      <div v-if="draft.organizationRoles.length > 0" class="q-mt-md">
        <div class="text-subtitle2 q-mb-sm">Roles empresariales</div>
        <org-role-card v-for="(role, idx) in draft.organizationRoles" :key="idx" :role="role" />
      </div>

      <!-- Notary info -->
      <notarial-badge :notary="draft.notary" class="q-mt-md" />

      <!-- Actions -->
      <div v-if="draft.status === 'draft' || draft.status === 'review'" class="q-mt-lg q-gutter-sm">
        <q-btn
          color="primary"
          icon="draw"
          label="Firmar y emitir"
          :loading="issuing"
          @click="handleSign"
        />
        <q-btn
          flat color="negative"
          icon="delete"
          label="Eliminar borrador"
          @click="handleDelete"
        />
      </div>

      <!-- Error -->
      <q-banner v-if="issueError" class="bg-negative text-white q-mt-md" rounded>
        {{ issueError }}
      </q-banner>

      <!-- Success -->
      <div v-if="draft.status === 'signed'" class="q-mt-lg q-pa-md bg-positive text-white" style="border-radius: 8px;">
        <q-icon name="check_circle" size="24px" class="q-mr-sm" />
        Credencial emitida exitosamente. Anclaje en progreso.
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIdentityStore } from '../stores/identity.store'
import { useIdentityIssuance } from '../composables/useIdentityIssuance'
import CitizenDataCard from '../components/CitizenDataCard.vue'
import EvidenceChecklist from '../components/EvidenceChecklist.vue'
import OrgRoleCard from '../components/OrgRoleCard.vue'
import NotarialBadge from '../components/NotarialBadge.vue'

const route = useRoute()
const router = useRouter()
const store = useIdentityStore()
const { issuing, issueError, issueIdentityVC } = useIdentityIssuance()

const draftId = computed(() => route.params.draftId as string)
const draft = computed(() => store.getDraft(draftId.value))

const statusColor = computed(() => {
  if (!draft.value) return 'grey'
  const map: Record<string, string> = { draft: 'warning', review: 'info', signed: 'positive', anchored: 'positive' }
  return map[draft.value.status] ?? 'grey'
})

const statusLabel = computed(() => {
  if (!draft.value) return ''
  const map: Record<string, string> = { draft: 'Borrador', review: 'En revision', signed: 'Firmado', anchored: 'Anclado' }
  return map[draft.value.status] ?? draft.value.status
})

async function handleSign(): Promise<void> {
  await issueIdentityVC(draftId.value)
}

function handleDelete(): void {
  store.removeDraft(draftId.value)
  router.push('/module/cr-identity/cr-identity')
}
</script>
