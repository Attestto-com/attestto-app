import type { AttesttoModule, ModuleContext, OnboardingFlow } from '@attestto/module-sdk'
import { setLlmHandle } from './composables/usePdfAnalyzer'
import { setModuleContext, useSigningSession } from './composables/useSigningSession'
import { setSignerContext } from './composables/useDocumentSigner'

let ctx: ModuleContext | null = null

const docSigningModule: AttesttoModule = {
  manifest: {
    id: 'doc-signing',
    name: 'Firma Inteligente',
    country: 'GLOBAL',
    version: '0.1.0',
    description: 'Analiza documentos con IA antes de firmar. Entiende lo que firmas.',
    icon: 'description',
    requiredCredentials: ['CedulaIdentidadCR'],
    capabilities: ['pdf-analysis', 'document-signing', 'audit-trail'],
    routes: [
      {
        path: '/upload',
        name: 'doc-upload',
        component: () => import('./views/DocumentUploadPage.vue'),
      },
      {
        path: '/analysis/:sessionId',
        name: 'doc-analysis',
        component: () => import('./views/DocumentAnalysisPage.vue'),
      },
      {
        path: '/sign/:sessionId',
        name: 'doc-sign',
        component: () => import('./views/SignDocumentPage.vue'),
      },
    ],
    inboxTypes: ['document-pending', 'document-signed'],
    credentialTypes: ['DocumentSignatureVC'],
  },

  async install(moduleCtx: ModuleContext) {
    ctx = moduleCtx
    setLlmHandle(ctx.llm)
    setModuleContext(ctx)
    setSignerContext(ctx)

    // Push inbox item for document signing
    ctx.pushInboxItem({
      id: 'doc-signing-cta',
      moduleId: 'doc-signing',
      type: 'action',
      icon: 'description',
      title: 'Firma Inteligente',
      subtitle: 'Analiza y firma documentos PDF con asistencia IA',
      action: 'Firmar documento',
      route: '/module/doc-signing/upload',
      timestamp: Date.now(),
      priority: 6,
    })

    // Check for pending sessions
    const { loadSessionIndex } = useSigningSession()
    const sessions = await loadSessionIndex()
    const pending = sessions.find((s) => s.phase !== 'complete' && s.phase !== 'error')
    if (pending) {
      ctx.pushInboxItem({
        id: 'doc-signing-pending',
        moduleId: 'doc-signing',
        type: 'warning',
        icon: 'pending_actions',
        title: `Documento pendiente: ${pending.fileName}`,
        subtitle: 'Tienes un documento sin firmar',
        action: 'Continuar',
        route: `/module/doc-signing/analysis/${pending.id}`,
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
      id: 'doc-signing-onboarding',
      screens: [
        {
          icon: 'description',
          title: 'Firma Inteligente de Documentos',
          body: 'Este modulo analiza documentos PDF con inteligencia artificial antes de que los firmes. Te explica en lenguaje llano que estas firmando, identifica clausulas riesgosas, y te hace preguntas para asegurarse de que entiendes.',
        },
        {
          icon: 'storage',
          title: 'Que datos se guardan',
          body: 'El texto extraido del PDF y el analisis se guardan solo en tu dispositivo. El archivo PDF original se mantiene en memoria durante la sesion. Nada se envia a un servidor.',
        },
        {
          icon: 'verified',
          title: 'Credencial de firma',
          body: 'Al firmar un documento, se emite una credencial verificable (DocumentSignatureVC) en tu wallet. El acta de firma incluye el hash del documento, tu analisis, y las preguntas que contestaste.',
        },
      ],
      completionCredential: 'DocSigningOnboarding',
    }
  },

  async getInboxItems() {
    if (!ctx) return []
    const items = [
      {
        id: 'doc-signing-cta',
        moduleId: 'doc-signing',
        type: 'action' as const,
        icon: 'description',
        title: 'Firma Inteligente',
        subtitle: 'Analiza y firma documentos PDF',
        action: 'Firmar documento',
        route: '/module/doc-signing/upload',
        timestamp: Date.now(),
        priority: 6,
      },
    ]
    return items
  },
}

export default docSigningModule
