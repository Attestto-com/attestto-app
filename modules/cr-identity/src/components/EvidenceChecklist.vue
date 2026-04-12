<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">Verificacion de evidencia</div>
      <div v-for="(e, idx) in evidence" :key="idx" class="q-mb-sm">
        <div><strong>Metodo:</strong> {{ methodLabel(e.method) }}</div>
        <div>
          <strong>Documentos:</strong>
          <q-chip v-for="doc in e.documentsChecked" :key="doc" size="sm" dense>{{ docLabel(doc) }}</q-chip>
        </div>
        <div>
          <q-icon :name="e.biometricMatch ? 'check_circle' : 'cancel'" :color="e.biometricMatch ? 'positive' : 'negative'" size="16px" />
          Coincidencia biometrica: {{ e.biometricMatch ? 'Si' : 'No' }}
        </div>
        <div class="text-caption text-grey-6">{{ e.verifiedAt }}</div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import type { EvidenceEntry, VerificationMethod, DocumentChecked } from '../types/identity'
import { VERIFICATION_METHOD_LABELS, DOCUMENT_CHECKED_LABELS } from '../types/identity'

defineProps<{ evidence: EvidenceEntry[] }>()

function methodLabel(m: VerificationMethod): string {
  return VERIFICATION_METHOD_LABELS[m] ?? m
}

function docLabel(d: DocumentChecked): string {
  return DOCUMENT_CHECKED_LABELS[d] ?? d
}
</script>
