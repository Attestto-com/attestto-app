/**
 * Channel management — create, join, archive channels.
 * Handles key exchange and channel state persistence.
 */

import { ref, computed } from 'vue'
import type { ChatChannel, ChatMessage, ChannelInvitation } from '../types.js'
import { getChatContext } from './useChatContext.js'

const channels = ref<Map<string, ChatChannel>>(new Map())
const STORAGE_KEY = 'channels'

/**
 * Load channels from persistent storage.
 */
export async function loadChannels(): Promise<void> {
  const ctx = getChatContext()
  const stored = await ctx.storage.get<Record<string, ChatChannel>>(STORAGE_KEY)
  if (stored) {
    channels.value = new Map(Object.entries(stored))
  }
}

/**
 * Persist channels to storage.
 */
async function persist(): Promise<void> {
  const ctx = getChatContext()
  const obj = Object.fromEntries(channels.value)
  await ctx.storage.set(STORAGE_KEY, obj)
}

/**
 * Create a new channel and invite a peer by DID.
 */
export async function createChannel(peerDid: string): Promise<ChatChannel> {
  const ctx = getChatContext()
  const myDid = ctx.getDID()
  const channelId = crypto.randomUUID()

  const channel: ChatChannel = {
    id: channelId,
    participants: [myDid, peerDid],
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    lastMessagePreview: '',
    unacknowledgedCount: 0,
    status: 'active',
    relayMode: 'mesh-only',
    channelKey: null,
  }

  channels.value.set(channelId, channel)
  await persist()
  return channel
}

/**
 * Get a channel by ID.
 */
export function getChannel(channelId: string): ChatChannel | undefined {
  return channels.value.get(channelId)
}

/**
 * Update channel's last message info.
 */
export async function updateChannelLastMessage(
  channelId: string,
  message: ChatMessage
): Promise<void> {
  const channel = channels.value.get(channelId)
  if (!channel) return

  channel.lastMessageAt = message.timestamp
  channel.lastMessagePreview = message.body.slice(0, 80)
  if (!message.isMine && message.status !== 'acknowledged') {
    channel.unacknowledgedCount++
  }
  await persist()
}

/**
 * Reset unacknowledged count for a channel.
 */
export async function markChannelRead(channelId: string): Promise<void> {
  const channel = channels.value.get(channelId)
  if (!channel) return
  channel.unacknowledgedCount = 0
  await persist()
}

/**
 * Archive a channel.
 */
export async function archiveChannel(channelId: string): Promise<void> {
  const channel = channels.value.get(channelId)
  if (!channel) return
  channel.status = 'archived'
  await persist()
}

/**
 * Set channel key (after key exchange).
 */
export async function setChannelKey(channelId: string, key: Uint8Array): Promise<void> {
  const channel = channels.value.get(channelId)
  if (!channel) return
  channel.channelKey = key
  await persist()
}

/**
 * Vue composable for channel management.
 */
export function useChannels() {
  const sortedChannels = computed(() => {
    return Array.from(channels.value.values())
      .filter((c) => c.status !== 'archived')
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
  })

  return {
    channels,
    sortedChannels,
    loadChannels,
    createChannel,
    getChannel,
    updateChannelLastMessage,
    markChannelRead,
    archiveChannel,
    setChannelKey,
  }
}
