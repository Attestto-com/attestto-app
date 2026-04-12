<template>
  <q-card flat bordered class="q-mb-sm">
    <q-card-section>
      <div class="row items-center q-gutter-sm">
        <q-icon name="business" color="primary" />
        <div>
          <div class="text-body2 text-weight-medium">{{ role.organization.legalName }}</div>
          <div class="text-caption text-grey-6">{{ role.organization.taxId }} &middot; {{ role.organization.jurisdiction }}</div>
        </div>
      </div>
      <div class="q-mt-sm">
        <q-badge color="primary" :label="roleLabel" />
        <span v-if="role.position" class="q-ml-sm text-caption">{{ role.position }}</span>
        <span v-if="role.ownershipPercentage != null" class="q-ml-sm text-caption">{{ role.ownershipPercentage }}%</span>
        <span v-if="role.poderType" class="q-ml-sm text-caption">(Poder {{ poderLabel }})</span>
      </div>
      <div v-if="role.hasVotingControl || role.hasAppointmentRights || role.hasVetoRights" class="q-mt-xs text-caption text-grey-6">
        <span v-if="role.hasVotingControl">Voto </span>
        <span v-if="role.hasAppointmentRights">Nombramiento </span>
        <span v-if="role.hasVetoRights">Veto</span>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OrganizationRole } from '../types/identity'
import { ORG_ROLE_LABELS, PODER_TYPE_LABELS } from '../types/identity'

const props = defineProps<{ role: OrganizationRole }>()

const roleLabel = computed(() => ORG_ROLE_LABELS[props.role.role] ?? props.role.role)
const poderLabel = computed(() => props.role.poderType ? PODER_TYPE_LABELS[props.role.poderType] ?? props.role.poderType : '')
</script>
