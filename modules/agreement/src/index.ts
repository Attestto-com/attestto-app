import type { AttesttoModule, ModuleContext, OnboardingFlow } from '@attestto/module-sdk'
import { setLlmHandle } from './composables/useConversationAnalyzer'
import { setModuleContext, useAgreementSession } from './composables/useAgreementSession'
import { setSignerContext } from './composables/useAgreementSigner'

let ctx: ModuleContext | null = null

const agreementModule: AttesttoModule = {
  manifest: {
    id: 'agreement',
    name: 'Acuerdo Conversacional',
    country: 'GLOBAL',
    version: '0.1.0',
    description: 'Convierte conversaciones en acuerdos firmados con tu identidad digital.',
    icon: 'handshake',
    requiredCredentials: ['CedulaIdentidadCR'],
    capabilities: ['conversation-analysis', 'agreement-signing', 'audit-trail'],
    routes: [
      {
        path: '/input',
        name: 'agreement-input',
        component: () => import('./views/ConversationInputPage.vue'),
      },
      {
        path: '/draft/:sessionId',
        name: 'agreement-draft',
        component: () => import('./views/AgreementDraftPage.vue'),
      },
      {
        path: '/sign/:sessionId',
        name: 'agreement-sign',
        component: () => import('./views/SignAgreementPage.vue'),
      },
    ],
    inboxTypes: ['agreement-pending', 'agreement-signed'],
    credentialTypes: ['ConversationAgreementCredential'],
  },

  async install(moduleCtx: ModuleContext) {
    ctx = moduleCtx
    setLlmHandle(ctx.llm)
    setModuleContext(ctx)
    setSignerContext(ctx)

    ctx.pushInboxItem({
      id: 'agreement-cta',
      moduleId: 'agreement',
      type: 'action',
      icon: 'handshake',
      title: 'Acuerdo Conversacional',
      subtitle: 'Convierte una conversacion en un acuerdo firmado',
      action: 'Crear acuerdo',
      route: '/module/agreement/input',
      timestamp: Date.now(),
      priority: 6,
    })

    const { loadSessionIndex } = useAgreementSession()
    const sessions = await loadSessionIndex()
    const pending = sessions.find((s) => s.phase !== 'complete' && s.phase !== 'error')
    if (pending) {
      ctx.pushInboxItem({
        id: 'agreement-pending',
        moduleId: 'agreement',
        type: 'warning',
        icon: 'pending_actions',
        title: `Acuerdo pendiente: ${pending.partySummary || 'Sin partes'}`,
        subtitle: 'Tienes un acuerdo sin firmar',
        action: 'Continuar',
        route: `/module/agreement/draft/${pending.id}`,
        timestamp: Date.now(),
        priority: 7,
      })
    }
  },

  uninstall() {
    ctx = null
  },

  getOnboarding(): OnboardingFlow {
    return {
      id: 'agreement-onboarding',
      screens: [
        {
          icon: 'handshake',
          title: 'Acuerdos desde Conversaciones',
          body: 'Pega una conversacion de WhatsApp, email, o transcripcion de voz. La IA extrae los terminos, montos, plazos y obligaciones. Tu los revisas, editas, y firmas con tu identidad digital.',
        },
        {
          icon: 'storage',
          title: 'Que datos se guardan',
          body: 'El texto de la conversacion y el analisis se guardan solo en tu dispositivo. Nada se envia a un servidor. El acuerdo firmado se almacena como una credencial verificable en tu wallet.',
        },
        {
          icon: 'verified',
          title: 'Credencial de acuerdo',
          body: 'Al firmar, se emite un ConversationAgreementCredential en tu wallet. Incluye el hash del acuerdo, las partes, y un acta PDF con el audit trail completo.',
        },
      ],
      completionCredential: 'AgreementOnboarding',
    }
  },

  async getInboxItems() {
    if (!ctx) return []
    return [
      {
        id: 'agreement-cta',
        moduleId: 'agreement',
        type: 'action' as const,
        icon: 'handshake',
        title: 'Acuerdo Conversacional',
        subtitle: 'Convierte una conversacion en un acuerdo firmado',
        action: 'Crear acuerdo',
        route: '/module/agreement/input',
        timestamp: Date.now(),
        priority: 6,
      },
    ]
  },
}

export default agreementModule
