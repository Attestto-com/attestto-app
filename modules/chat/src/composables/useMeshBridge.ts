/**
 * Mesh bridge — connects the PWA to the mesh daemon via HTTP RPC + WebSocket.
 *
 * HTTP for commands (send, ack, delete, fetch messages).
 * WebSocket for real-time event streaming (new messages, acks, deletes).
 */

import { ref, onUnmounted } from 'vue'

export interface MeshBridgeConfig {
  /** Mesh RPC base URL, e.g. 'http://localhost:8080' */
  rpcUrl: string
  /** Auth token for non-loopback connections */
  token?: string
}

export type MeshEvent =
  | { type: 'connected'; peerId: string }
  | { type: 'chat:received'; channelId: string; messageId: string; from: string }
  | { type: 'chat:ack'; channelId: string; messageId: string; from: string }
  | { type: 'chat:deleted'; channelId: string; messageId: string; from: string }

type EventHandler = (event: MeshEvent) => void

const connected = ref(false)
let ws: WebSocket | null = null
let config: MeshBridgeConfig | null = null
const handlers: Set<EventHandler> = new Set()

/**
 * Initialize the mesh bridge connection.
 */
export function connectMeshBridge(cfg: MeshBridgeConfig): void {
  config = cfg
  connectWs()
}

/**
 * Register an event handler for real-time mesh events.
 */
export function onMeshEvent(handler: EventHandler): () => void {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

/**
 * Send a chat message via the mesh RPC.
 */
export async function sendChatMessage(message: Record<string, unknown>): Promise<{ ok: boolean; id: string }> {
  return rpcPost('/chat/send', message)
}

/**
 * Acknowledge a chat message.
 */
export async function sendChatAck(ack: Record<string, unknown>): Promise<{ ok: boolean }> {
  return rpcPost('/chat/ack', ack)
}

/**
 * Request deletion of a chat message.
 */
export async function sendChatDelete(del: Record<string, unknown>): Promise<{ ok: boolean }> {
  return rpcPost('/chat/delete', del)
}

/**
 * Fetch messages for a channel.
 */
export async function fetchChatMessages(
  channelId: string,
  limit = 100,
  afterSequence = 0
): Promise<{ messages: Record<string, unknown>[] }> {
  return rpcGet(`/chat/messages?channel=${encodeURIComponent(channelId)}&limit=${limit}&after=${afterSequence}`)
}

/**
 * Check mesh node health.
 */
export async function checkHealth(): Promise<{ status: string; peerId: string }> {
  return rpcGet('/health')
}

/**
 * Disconnect the mesh bridge.
 */
export function disconnectMeshBridge(): void {
  if (ws) {
    ws.close()
    ws = null
  }
  connected.value = false
}

/**
 * Vue composable for mesh bridge state.
 */
export function useMeshBridge() {
  onUnmounted(() => {
    // Don't disconnect on unmount — bridge is global
  })

  return {
    connected,
    connect: connectMeshBridge,
    disconnect: disconnectMeshBridge,
    onEvent: onMeshEvent,
    sendMessage: sendChatMessage,
    sendAck: sendChatAck,
    sendDelete: sendChatDelete,
    fetchMessages: fetchChatMessages,
    checkHealth,
  }
}

// ── Internal ──────────────────────────────────────────────────────────

function connectWs(): void {
  if (!config) return

  const wsUrl = config.rpcUrl.replace(/^http/, 'ws') + '/ws'
    + (config.token ? `?token=${config.token}` : '')

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    connected.value = true
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as MeshEvent
      for (const handler of handlers) {
        handler(data)
      }
    } catch {
      // ignore malformed messages
    }
  }

  ws.onclose = () => {
    connected.value = false
    // Reconnect after 3 seconds
    setTimeout(() => {
      if (config) connectWs()
    }, 3000)
  }

  ws.onerror = () => {
    ws?.close()
  }
}

async function rpcPost<T>(path: string, body: unknown): Promise<T> {
  if (!config) throw new Error('Mesh bridge not connected')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.token) headers['Authorization'] = `Bearer ${config.token}`

  const res = await fetch(`${config.rpcUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error || res.statusText)
  }
  return res.json() as Promise<T>
}

async function rpcGet<T>(path: string): Promise<T> {
  if (!config) throw new Error('Mesh bridge not connected')
  const headers: Record<string, string> = {}
  if (config.token) headers['Authorization'] = `Bearer ${config.token}`

  const res = await fetch(`${config.rpcUrl}${path}`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error || res.statusText)
  }
  return res.json() as Promise<T>
}
