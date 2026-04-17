<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">Mis Credenciales de Identidad</div>

    <q-list v-if="credentials.length > 0" separator>
      <q-item v-for="vc in credentials" :key="vc.id" clickable>
        <q-item-section avatar>
          <q-icon :name="getDocIcon(vc)" color="primary" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ getDocLabel(vc) }}</q-item-label>
          <q-item-label caption>{{ getDocNumber(vc) }} — {{ getDocName(vc) }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-badge :color="isExpired(vc) ? 'negative' : 'positive'">
            {{ isExpired(vc) ? 'Vencido' : 'Vigente' }}
          </q-badge>
        </q-item-section>
        <q-item-section side>
          <q-badge color="grey-7">
            {{ hasSelfAttestProof(vc) ? 'Auto-atestado' : 'Notarial' }}
          </q-badge>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="text-center q-pa-xl">
      <q-icon name="badge" size="64px" color="grey-6" />
      <div class="text-h6 q-mt-md text-grey-5">Sin credenciales</div>
      <div class="text-body2 q-mt-sm text-grey-6">Escanea un documento para crear tu primera credencial.</div>
      <q-btn
        color="primary"
        icon="document_scanner"
        label="Escanear documento"
        class="q-mt-md"
        @click="$router.push('/module/cr-identity/cr-identity/escanear')"
      />
    </div>

    <q-btn
      v-if="credentials.length > 0"
      color="primary"
      icon="document_scanner"
      label="Escanear otro documento"
      class="full-width q-mt-md"
      @click="$router.push('/module/cr-identity/cr-identity/escanear')"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { VerifiableCredential } from '@attestto/module-sdk'

const IDENTITY_TYPES = ['CedulaIdentidadCR', 'DrivingLicenseCR', 'PassportCR', 'IdentityVC']

// Will be populated via module context
const credentials = ref<VerifiableCredential[]>([])

function getDocIcon(vc: VerifiableCredential): string {
  if (vc.type.includes('DrivingLicenseCR')) return 'directions_car'
  if (vc.type.includes('PassportCR')) return 'flight'
  return 'badge'
}

function getDocLabel(vc: VerifiableCredential): string {
  if (vc.type.includes('DrivingLicenseCR')) return 'Licencia de Conducir'
  if (vc.type.includes('PassportCR')) return 'Pasaporte'
  if (vc.type.includes('IdentityVC')) return 'Identidad Notarial'
  return 'Cedula de Identidad'
}

function getDocNumber(vc: VerifiableCredential): string {
  const sub = vc.credentialSubject
  return (sub.cedula ?? sub.documentNumber ?? '') as string
}

function getDocName(vc: VerifiableCredential): string {
  const sub = vc.credentialSubject
  return (sub.fullName ?? `${sub.surname ?? ''} ${sub.givenNames ?? ''}`.trim() ?? '') as string
}

function isExpired(vc: VerifiableCredential): boolean {
  if (!vc.expirationDate) return false
  return new Date(vc.expirationDate) < new Date()
}

function hasSelfAttestProof(vc: VerifiableCredential): boolean {
  const issuer = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id
  // Self-attested VCs have the user as issuer (no carneNumber)
  return typeof vc.issuer === 'string' || !(vc.issuer as Record<string, unknown>)?.carneNumber
}
</script>
