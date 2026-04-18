<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useChannels } from '../composables/useChannels'

const router = useRouter()
const { createChannel } = useChannels()

const peerDid = ref('')
const loading = ref(false)
const error = ref('')

async function create() {
  const did = peerDid.value.trim()
  if (!did.startsWith('did:')) {
    error.value = 'Ingrese un DID válido (ej: did:sns:nombre.attestto.sol)'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const channel = await createChannel(did)
    router.push(`/module/chat/channel/${channel.id}`)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <q-page padding>
    <div class="text-h6 q-mb-md">Nueva negociación</div>

    <q-banner v-if="error" class="bg-negative text-white q-mb-md" rounded>
      {{ error }}
    </q-banner>

    <div class="text-caption q-mb-sm" style="color: var(--text-secondary, #94a3b8)">
      Todo lo que escribas en este canal queda firmado con tu DID.
      Puede convertirse en un acuerdo legalmente vinculante.
    </div>

    <q-input
      v-model="peerDid"
      label="DID de la otra parte"
      placeholder="did:sns:nombre.attestto.sol"
      outlined
      dark
      class="q-mb-md"
      :rules="[(v: string) => v.startsWith('did:') || 'Debe comenzar con did:']"
    >
      <template #append>
        <q-btn flat round icon="qr_code_scanner" @click="() => { /* TODO: QR scanner */ }" />
      </template>
    </q-input>

    <q-btn
      label="Iniciar negociación"
      icon="chat"
      color="primary"
      :loading="loading"
      :disable="!peerDid.trim()"
      class="full-width"
      @click="create"
    />
  </q-page>
</template>
