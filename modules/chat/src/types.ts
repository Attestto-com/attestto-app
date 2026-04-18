/**
 * Chat module domain types.
 *
 * These types are local to the PWA chat module.
 * Wire-format types (GossipChatMessage etc.) live in @attestto/mesh.
 */

/** Local channel state */
export interface ChatChannel {
  id: string
  /** DIDs of all participants */
  participants: string[]
  /** Channel creation timestamp */
  createdAt: string
  /** Last message timestamp (for sorting) */
  lastMessageAt: string
  /** Last message preview text (decrypted, truncated) */
  lastMessagePreview: string
  /** Count of unacknowledged messages */
  unacknowledgedCount: number
  /** Channel status */
  status: 'pending' | 'active' | 'archived'
  /** Delivery mode */
  relayMode: 'mesh-only' | 'cortex-relay'
  /** Symmetric channel key (derived from X25519 shared secret) */
  channelKey: Uint8Array | null
}

/** Local message state (decrypted, with UI metadata) */
export interface ChatMessage {
  id: string
  channelId: string
  from: string
  /** Decrypted plaintext body */
  body: string
  timestamp: string
  sequence: number
  replyTo?: string
  attachment?: ChatAttachment
  /** Delivery/ack status */
  status: 'sending' | 'sent' | 'received' | 'acknowledged'
  /** Whether this message was sent by the current user */
  isMine: boolean
}

export type ChatAttachment =
  | VaultReference
  | StructuredCard

export interface VaultReference {
  type: 'vault-reference'
  credentialId: string
  credentialType: string
  credentialHash: string
  summary: string
}

export interface StructuredCard {
  type: 'structured-card'
  moduleId: string
  cardType: string
  data: Record<string, unknown>
  signature: string
}

/** Channel invitation */
export interface ChannelInvitation {
  channelId: string
  from: string
  /** Sender's X25519 ephemeral public key (base64url) */
  ephemeralPublicKey: string
  timestamp: string
}
