<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChannels } from '../composables/useChannels'

const router = useRouter()
const { sortedChannels, loadChannels } = useChannels()

onMounted(() => {
  loadChannels()
})

function openChannel(channelId: string) {
  router.push(`/module/chat/channel/${channelId}`)
}

function newChannel() {
  router.push('/module/chat/new')
}

function truncateDid(did: string): string {
  if (did.length <= 24) return did
  return did.slice(0, 16) + '…' + did.slice(-8)
}
</script>

<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h6 col">Negociaciones</div>
      <q-btn
        round
        flat
        icon="add"
        color="primary"
        @click="newChannel"
      />
    </div>

    <q-list v-if="sortedChannels.length > 0" separator>
      <q-item
        v-for="channel in sortedChannels"
        :key="channel.id"
        clickable
        @click="openChannel(channel.id)"
      >
        <q-item-section avatar>
          <q-avatar color="primary" text-color="white" icon="chat" />
        </q-item-section>

        <q-item-section>
          <q-item-label>
            <span
              v-for="(p, i) in channel.participants"
              :key="p"
            >
              {{ truncateDid(p) }}
              <span v-if="i < channel.participants.length - 1">, </span>
            </span>
          </q-item-label>
          <q-item-label caption lines="1">
            {{ channel.lastMessagePreview || 'Sin mensajes' }}
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <q-badge
            v-if="channel.unacknowledgedCount > 0"
            color="primary"
            :label="channel.unacknowledgedCount"
            rounded
          />
        </q-item-section>
      </q-item>
    </q-list>

    <div v-else class="text-center q-pa-xl text-grey-6">
      <q-icon name="chat_bubble_outline" size="64px" class="q-mb-md" />
      <div class="text-subtitle1">Sin negociaciones</div>
      <div class="text-caption q-mb-lg">
        Todo lo que escribas aquí queda firmado y puede convertirse en un acuerdo legal.
      </div>
      <q-btn
        label="Nueva negociación"
        icon="add"
        color="primary"
        @click="newChannel"
      />
    </div>
  </q-page>
</template>
