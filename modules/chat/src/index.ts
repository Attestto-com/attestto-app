/**
 * Chat module — Signed negotiation channel.
 *
 * Every message is DID-signed and E2E encrypted.
 * Conversations can crystallize into legally binding AgreementCredential VCs.
 */

import type { AttesttoModule, ModuleContext } from '@attestto/module-sdk'
import { manifest } from './manifest.js'
import { setChatContext, clearChatContext } from './composables/useChatContext.js'

let ctx: ModuleContext | null = null

const chatModule: AttesttoModule = {
  manifest,

  async install(moduleCtx: ModuleContext) {
    ctx = moduleCtx
    setChatContext(moduleCtx)

    moduleCtx.pushInboxItem({
      id: 'chat-cta',
      moduleId: 'chat',
      type: 'action',
      icon: 'chat',
      title: 'Negociaciones',
      subtitle: 'Conversaciones firmadas que pueden convertirse en acuerdos legales',
      action: 'Abrir',
      route: '/module/chat/channels',
      timestamp: Date.now(),
      priority: 6,
    })
  },

  uninstall() {
    ctx = null
    clearChatContext()
  },

  async getInboxItems() {
    // Future: check for unread messages and return inbox items
    return []
  },

  getOnboarding() {
    return {
      id: 'chat-onboarding',
      screens: [
        {
          icon: 'chat',
          title: 'Negociaciones firmadas',
          body: 'Cada mensaje que envíes queda firmado con tu identidad digital. No hay forma de negar lo que dijiste.',
        },
        {
          icon: 'gavel',
          title: 'Acuerdos legales',
          body: 'Cuando lleguen a un acuerdo, presiona "Cristalizar" para convertir la conversación en un contrato legalmente vinculante.',
        },
        {
          icon: 'lock',
          title: 'Cifrado de extremo a extremo',
          body: 'Tus mensajes están cifrados. Ni Attestto ni ningún intermediario puede leer tu conversación.',
        },
      ],
    }
  },
}

export default chatModule
