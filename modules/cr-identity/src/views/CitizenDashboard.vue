<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">Mi Identidad Digital</div>

    <!-- Scanned credentials -->
    <div v-if="identityCredentials.length > 0" class="q-mb-lg">
      <div class="text-subtitle1 q-mb-sm">Mis documentos</div>
      <div class="row q-gutter-md">
        <div v-for="vc in identityCredentials" :key="vc.id" class="col-12 col-sm-6">
          <q-card class="bg-card">
            <q-card-section>
              <div class="row items-center q-gutter-sm">
                <q-icon :name="getDocIcon(vc)" size="28px" color="primary" />
                <div>
                  <div class="text-subtitle2">{{ getDocLabel(vc) }}</div>
                  <div class="text-caption text-grey">{{ getDocNumber(vc) }}</div>
                </div>
              </div>
            </q-card-section>
            <q-card-section class="q-pt-none">
              <div class="text-caption">
                <span>{{ getDocName(vc) }}</span>
                <q-badge v-if="isExpired(vc)" color="negative" class="q-ml-sm">Vencido</q-badge>
                <q-badge v-else color="positive" class="q-ml-sm">Vigente</q-badge>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center q-pa-xl">
      <q-icon name="fingerprint" size="64px" color="grey-6" />
      <div class="text-h6 q-mt-md text-grey-5">Sin documentos escaneados</div>
      <div class="text-body2 q-mt-sm text-grey-6">Escanea tu cedula para comenzar</div>
    </div>

    <!-- Scan CTA -->
    <q-btn
      color="primary"
      icon="document_scanner"
      label="Escanear documento"
      class="full-width q-mt-md"
      size="lg"
      @click="$router.push('/module/cr-identity/cr-identity/escanear')"
    />

    <!-- Notary mode link -->
    <q-btn
      v-if="isNotary"
      flat
      color="grey-5"
      icon="gavel"
      label="Modo notarial"
      class="full-width q-mt-sm"
      @click="$router.push('/module/cr-identity/cr-identity/notarial')"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { ModuleContext, VerifiableCredential } from '@attestto/module-sdk'

const identityCredentials = ref<VerifiableCredential[]>([])
const isNotary = ref(false)

// These will be wired via module context injection
// For now, stub data from vault
const IDENTITY_TYPES = ['CedulaIdentidadCR', 'DrivingLicenseCR', 'PassportCR']

function getDocIcon(vc: VerifiableCredential): string {
  if (vc.type.includes('DrivingLicenseCR')) return 'directions_car'
  if (vc.type.includes('PassportCR')) return 'flight'
  return 'badge'
}

function getDocLabel(vc: VerifiableCredential): string {
  if (vc.type.includes('DrivingLicenseCR')) return 'Licencia de Conducir'
  if (vc.type.includes('PassportCR')) return 'Pasaporte'
  return 'Cedula de Identidad'
}

function getDocNumber(vc: VerifiableCredential): string {
  const sub = vc.credentialSubject
  return (sub.cedula ?? sub.documentNumber ?? (sub.nationalId as Record<string, unknown>)?.number ?? '') as string
}

function getDocName(vc: VerifiableCredential): string {
  const sub = vc.credentialSubject
  return (sub.fullName ?? `${sub.surname ?? ''} ${sub.givenNames ?? ''}`.trim() ?? '') as string
}

function isExpired(vc: VerifiableCredential): boolean {
  if (!vc.expirationDate) return false
  return new Date(vc.expirationDate) < new Date()
}
</script>
