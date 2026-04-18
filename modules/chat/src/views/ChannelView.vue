<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { getChatContext } from '../composables/useChatContext'
import { useChannels } from '../composables/useChannels'
import { onMeshEvent, sendChatMessage, sendChatAck, sendChatDelete, fetchChatMessages } from '../composables/useMeshBridge'
import { useCrystallize } from '../composables/useCrystallize'
import type { ChatMessage } from '../types'

const route = useRoute()
const channelId = route.params.channelId as string
const { getChannel, updateChannelLastMessage, markChannelRead } = useChannels()

const channel = computed(() => getChannel(channelId))
const messages = ref<ChatMessage[]>([])
const messageText = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const loading = ref(false)
const myDid = ref('')

const { step: crystallizeStep, extractedTerms, error: crystallizeError, extractTerms, signAgreement, resetCrystallize } = useCrystallize()
const showCrystallize = ref(false)

let sequence = 0
let cleanup: (() => void) | null = null

onMounted(async () => {
  const ctx = getChatContext()
  myDid.value = ctx.getDID()

  // Load existing messages
  await loadMessages()
  markChannelRead(channelId)

  // Listen for real-time events
  cleanup = onMeshEvent((event) => {
    if (event.type === 'chat:received' && 'channelId' in event && event.channelId === channelId) {
      loadMessages()
    }
    if (event.type === 'chat:ack' && 'channelId' in event && event.channelId === channelId) {
      loadMessages()
    }
    if (event.type === 'chat:deleted' && 'channelId' in event && event.channelId === channelId) {
      loadMessages()
    }
  })
})

onUnmounted(() => {
  cleanup?.()
})

async function loadMessages() {
  try {
    const result = await fetchChatMessages(channelId, 200)
    messages.value = (result.messages as unknown as ChatMessage[]).map((m) => ({
      ...m,
      isMine: m.from === myDid.value,
      status: 'received' as const,
    }))

    // Update sequence counter
    const myMessages = messages.value.filter((m) => m.isMine)
    if (myMessages.length > 0) {
      sequence = Math.max(...myMessages.map((m) => m.sequence))
    }

    await nextTick()
    scrollToBottom()
  } catch {
    // Mesh might not be connected yet
  }
}

async function send() {
  const text = messageText.value.trim()
  if (!text) return

  const ctx = getChatContext()
  sequence++

  const id = crypto.randomUUID()
  const timestamp = new Date().toISOString()

  // Sign the message
  const signPayload = JSON.stringify({
    channelId,
    body: text,
    timestamp,
    sequence,
  })
  const { signature } = await ctx.sign(signPayload)

  // Optimistic UI update
  const localMsg: ChatMessage = {
    id,
    channelId,
    from: myDid.value,
    body: text,
    timestamp,
    sequence,
    status: 'sending',
    isMine: true,
  }
  messages.value.push(localMsg)
  messageText.value = ''
  await nextTick()
  scrollToBottom()

  try {
    await sendChatMessage({
      type: 'chat',
      id,
      channelId,
      from: myDid.value,
      body: text,
      timestamp,
      sequence,
      signature,
    })

    // Update status
    const msg = messages.value.find((m) => m.id === id)
    if (msg) msg.status = 'sent'

    updateChannelLastMessage(channelId, localMsg)
  } catch {
    const msg = messages.value.find((m) => m.id === id)
    if (msg) msg.status = 'sending'
  }
}

async function acknowledge(messageId: string) {
  const ctx = getChatContext()
  const timestamp = new Date().toISOString()
  const signPayload = JSON.stringify({ messageId, channelId, timestamp })
  const { signature } = await ctx.sign(signPayload)

  await sendChatAck({
    type: 'chat-ack',
    messageId,
    channelId,
    from: myDid.value,
    timestamp,
    signature,
  })

  const msg = messages.value.find((m) => m.id === messageId)
  if (msg) msg.status = 'acknowledged'
}

function statusIcon(status: string): string {
  switch (status) {
    case 'sending': return '○'
    case 'sent': return '○'
    case 'received': return '◐'
    case 'acknowledged': return '●'
    default: return ''
  }
}

function canDelete(msg: ChatMessage): boolean {
  if (!msg.isMine) return false
  if (msg.status === 'acknowledged') return false
  const msgTime = new Date(msg.timestamp).getTime()
  return Date.now() - msgTime < 60_000
}

async function deleteMessage(messageId: string) {
  const ctx = getChatContext()
  const timestamp = new Date().toISOString()
  const signPayload = JSON.stringify({ messageId, channelId, timestamp })
  const { signature } = await ctx.sign(signPayload)

  try {
    await sendChatDelete({
      type: 'chat-delete',
      messageId,
      channelId,
      from: myDid.value,
      timestamp,
      signature,
    })
    messages.value = messages.value.filter((m) => m.id !== messageId)
  } catch {
    // Deletion window expired or already acked
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function truncateDid(did: string): string {
  if (did.length <= 20) return did
  return did.slice(0, 12) + '…' + did.slice(-6)
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function startCrystallize() {
  if (messages.value.length === 0) return
  resetCrystallize()
  showCrystallize.value = true

  const participants = channel.value?.participants ?? []
  await extractTerms(messages.value, participants)
}

async function confirmCrystallize() {
  if (!extractedTerms.value || !channel.value) return

  const msgIds = messages.value.map((m) => m.id)
  const range: [string, string] = [msgIds[0], msgIds[msgIds.length - 1]]
  const hash = await hashMessages(messages.value)

  await signAgreement(
    extractedTerms.value,
    channelId,
    range,
    messages.value.length,
    hash
  )
  showCrystallize.value = false
}

async function hashMessages(msgs: ChatMessage[]): Promise<string> {
  const text = msgs.map((m) => `${m.id}:${m.body}`).join('|')
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
</script>

<template>
  <q-page class="column" style="height: 100vh">
    <!-- Header -->
    <q-toolbar class="bg-dark">
      <q-btn flat round icon="arrow_back" @click="$router.back()" />
      <q-toolbar-title class="text-caption">
        <template v-if="channel">
          {{ channel.participants.filter(p => p !== myDid).map(truncateDid).join(', ') }}
        </template>
      </q-toolbar-title>
      <q-btn
        flat
        round
        icon="gavel"
        :disable="messages.length === 0"
        @click="startCrystallize"
      >
        <q-tooltip>Cristalizar acuerdo</q-tooltip>
      </q-btn>
    </q-toolbar>

    <!-- Legal notice banner -->
    <q-banner dense class="text-caption" style="background: var(--bg-card, #1a1f2e); color: var(--text-secondary, #94a3b8)">
      <q-icon name="gavel" size="14px" class="q-mr-xs" />
      Cada mensaje queda firmado con tu DID. Puede convertirse en un acuerdo legal.
    </q-banner>

    <!-- Messages -->
    <div
      ref="messagesContainer"
      class="col q-pa-sm"
      style="overflow-y: auto"
    >
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['row q-mb-sm', msg.isMine ? 'justify-end' : 'justify-start']"
      >
        <div
          :class="[
            'q-pa-sm q-px-md rounded-borders',
            msg.isMine ? 'bg-primary text-white' : 'bg-dark'
          ]"
          style="max-width: 80%; min-width: 60px; position: relative"
        >
          <!-- Sender DID (for received messages) -->
          <div v-if="!msg.isMine" class="text-caption" style="color: var(--primary, #594FD3); font-weight: 600">
            {{ truncateDid(msg.from) }}
          </div>

          <!-- Reply indicator -->
          <div v-if="msg.replyTo" class="text-caption q-mb-xs" style="opacity: 0.6; border-left: 2px solid; padding-left: 6px">
            Respuesta a mensaje anterior
          </div>

          <!-- Message body -->
          <div>{{ msg.body }}</div>

          <!-- Attachment card -->
          <div v-if="msg.attachment" class="q-mt-xs q-pa-xs rounded-borders" style="background: rgba(255,255,255,0.1)">
            <div class="text-caption">
              <q-icon :name="msg.attachment.type === 'vault-reference' ? 'verified' : 'widgets'" size="14px" />
              {{ msg.attachment.type === 'vault-reference' ? (msg.attachment as any).summary : (msg.attachment as any).cardType }}
            </div>
          </div>

          <!-- Footer: time + status -->
          <div class="row items-center justify-end q-mt-xs" style="gap: 4px; opacity: 0.7">
            <span class="text-caption">{{ formatTime(msg.timestamp) }}</span>
            <span v-if="msg.isMine" class="text-caption">{{ statusIcon(msg.status) }}</span>
          </div>

          <!-- Context menu for deletion -->
          <q-menu v-if="canDelete(msg)" touch-position context-menu>
            <q-list dense>
              <q-item clickable @click="deleteMessage(msg.id)">
                <q-item-section>Eliminar</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </div>

        <!-- Acknowledge button (for received messages) -->
        <q-btn
          v-if="!msg.isMine && msg.status !== 'acknowledged'"
          flat
          round
          dense
          size="sm"
          icon="done"
          class="q-ml-xs self-end"
          @click="acknowledge(msg.id)"
        />
      </div>
    </div>

    <!-- Crystallize Dialog -->
    <q-dialog v-model="showCrystallize" maximized>
      <q-card dark style="background: var(--bg-base, #0f1923)">
        <q-toolbar class="bg-dark">
          <q-btn flat round icon="close" @click="showCrystallize = false; resetCrystallize()" />
          <q-toolbar-title>Cristalizar acuerdo</q-toolbar-title>
        </q-toolbar>

        <q-card-section v-if="crystallizeStep === 'extracting'" class="text-center q-pa-xl">
          <q-spinner-dots size="48px" color="primary" />
          <div class="q-mt-md">Analizando conversación...</div>
        </q-card-section>

        <q-card-section v-else-if="crystallizeStep === 'reviewing' && extractedTerms">
          <div class="text-subtitle1 q-mb-md">Resumen del acuerdo</div>
          <div class="text-caption q-mb-lg" style="color: var(--text-secondary, #94a3b8)">
            {{ extractedTerms.summary }}
          </div>

          <div class="text-subtitle2 q-mb-sm">Partes</div>
          <q-list dense separator class="q-mb-md">
            <q-item v-for="party in extractedTerms.parties" :key="party.did">
              <q-item-section avatar>
                <q-avatar size="32px" color="primary" text-color="white" icon="person" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ truncateDid(party.did) }}</q-item-label>
                <q-item-label caption>{{ party.role }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="text-subtitle2 q-mb-sm">Términos</div>
          <q-list v-if="extractedTerms.terms.length > 0" dense separator class="q-mb-md">
            <q-item v-for="(term, i) in extractedTerms.terms" :key="i">
              <q-item-section>
                <q-item-label>{{ term.obligation }}</q-item-label>
                <q-item-label caption>
                  Responsable: {{ truncateDid(term.responsibleParty) }}
                  <span v-if="term.deadline"> · Fecha límite: {{ term.deadline }}</span>
                  <span v-if="term.amount"> · {{ term.amount.currency }} {{ term.amount.value }}</span>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="text-caption q-mb-md" style="color: var(--text-secondary, #94a3b8)">
            No se identificaron términos específicos. Puedes agregarlos manualmente.
          </div>

          <q-banner class="q-mb-md" style="background: var(--bg-card, #1a1f2e)">
            <template #avatar>
              <q-icon name="fingerprint" color="primary" />
            </template>
            Al firmar, se solicitará tu huella digital o Face ID para confirmar tu identidad.
            Este acuerdo será legalmente vinculante y se anclará en blockchain.
            <br>
            <strong>Costo: $1 USD</strong>
          </q-banner>

          <div class="row q-gutter-sm">
            <q-btn
              label="Firmar acuerdo"
              icon="gavel"
              color="primary"
              class="col"
              :loading="crystallizeStep === 'signing'"
              @click="confirmCrystallize"
            />
            <q-btn
              label="Cancelar"
              flat
              class="col-auto"
              @click="showCrystallize = false; resetCrystallize()"
            />
          </div>
        </q-card-section>

        <q-card-section v-else-if="crystallizeStep === 'signing'" class="text-center q-pa-xl">
          <q-spinner-dots size="48px" color="primary" />
          <div class="q-mt-md">Firmando acuerdo...</div>
          <div class="text-caption" style="color: var(--text-secondary, #94a3b8)">
            Esperando confirmación biométrica
          </div>
        </q-card-section>

        <q-card-section v-else-if="crystallizeStep === 'complete'" class="text-center q-pa-xl">
          <q-icon name="check_circle" size="64px" color="positive" />
          <div class="text-h6 q-mt-md">Acuerdo firmado</div>
          <div class="text-caption q-mb-lg" style="color: var(--text-secondary, #94a3b8)">
            Tu firma ha sido registrada. Esperando la firma de la otra parte.
          </div>
          <q-btn label="Cerrar" color="primary" @click="showCrystallize = false" />
        </q-card-section>

        <q-card-section v-else-if="crystallizeStep === 'error'" class="text-center q-pa-xl">
          <q-icon name="error" size="64px" color="negative" />
          <div class="q-mt-md">{{ crystallizeError }}</div>
          <q-btn label="Reintentar" color="primary" class="q-mt-md" @click="startCrystallize" />
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Input -->
    <div class="q-pa-sm row items-end" style="background: var(--bg-card, #1a1f2e)">
      <q-input
        v-model="messageText"
        placeholder="Escribe tu mensaje..."
        outlined
        dense
        dark
        autogrow
        class="col"
        spellcheck="true"
        @keyup.enter.exact="send"
      />
      <q-btn
        round
        flat
        icon="send"
        color="primary"
        :disable="!messageText.trim()"
        class="q-ml-xs"
        @click="send"
      />
    </div>
  </q-page>
</template>
