/**
 * Module context bridge — stores the shell-injected context
 * so composables and views can access vault, signing, storage.
 */

import type { ModuleContext } from '@attestto/module-sdk'

let ctx: ModuleContext | null = null

export function setChatContext(moduleCtx: ModuleContext): void {
  ctx = moduleCtx
}

export function getChatContext(): ModuleContext {
  if (!ctx) throw new Error('Chat module not installed — no context')
  return ctx
}

export function clearChatContext(): void {
  ctx = null
}
