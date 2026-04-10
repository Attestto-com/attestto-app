import type { AttesttoModule, ModuleContext } from '@attestto/module-sdk'
import { markRaw } from 'vue'
import MasteryWidget from './components/MasteryWidget.vue'

let ctx: ModuleContext | null = null

const crDrivingModule: AttesttoModule = {
  manifest: {
    id: 'cr-driving',
    name: 'Examen Teorico COSEVI',
    country: 'CR',
    version: '0.1.0',
    description: 'Practica y aprueba el examen teorico de conducir',
    icon: 'directions_car',
    requiredCredentials: ['CedulaIdentidadCR'],
    capabilities: ['exam-practice', 'exam-proctored', 'mastery-tracking'],
    routes: [
      {
        path: '/exam',
        name: 'exam',
        component: () => import('./views/ExamPage.vue'),
      },
      {
        path: '/practice',
        name: 'practice',
        component: () => import('./views/PracticePage.vue'),
      },
    ],
    inboxTypes: ['exam-available', 'exam-result', 'mastery-update'],
    credentialTypes: ['DrivingTheoryExamCR'],
  },

  async install(moduleCtx: ModuleContext) {
    ctx = moduleCtx

    const mastery = await ctx.storage.get<{ score: number; weakTopics: string[] }>('mastery')
    if (mastery) {
      ctx.pushInboxItem({
        id: 'cr-driving-practice',
        moduleId: 'cr-driving',
        type: 'action',
        icon: 'directions_car',
        title: 'Examen disponible',
        subtitle: `Ultimo: ${mastery.score}% — Temas debiles: ${mastery.weakTopics.length}`,
        action: 'Practicar',
        route: '/module/cr-driving/practice',
        timestamp: Date.now(),
        priority: 5,
      })
    }
  },

  uninstall() {
    ctx = null
  },

  getHomeWidget() {
    return markRaw(MasteryWidget)
  },

  async getInboxItems() {
    if (!ctx) return []
    const mastery = await ctx.storage.get<{ score: number; weakTopics: string[] }>('mastery')
    if (!mastery) return []

    return [
      {
        id: 'cr-driving-practice',
        moduleId: 'cr-driving',
        type: 'action' as const,
        icon: 'directions_car',
        title: 'Examen disponible',
        subtitle: `Ultimo: ${mastery.score}% — Temas debiles: ${mastery.weakTopics.length}`,
        action: 'Practicar',
        route: '/module/cr-driving/practice',
        timestamp: Date.now(),
        priority: 5,
      },
    ]
  },
}

export default crDrivingModule
