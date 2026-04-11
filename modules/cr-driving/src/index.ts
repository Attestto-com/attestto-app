import type { AttesttoModule, ModuleContext } from '@attestto/module-sdk'
import { markRaw } from 'vue'
import MasteryWidget from './components/MasteryWidget.vue'
import { checkDueOnOpen, scheduleReviewReminder } from './composables/useNotifications'
import { setLlmHandle } from './composables/useQuestionGenerator'
import { useMastery } from './composables/useMastery'

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
      {
        path: '/micro-quiz',
        name: 'micro-quiz',
        component: () => import('./views/MicroQuizPage.vue'),
      },
    ],
    inboxTypes: ['exam-available', 'exam-result', 'mastery-update'],
    credentialTypes: ['DrivingTheoryExamCR', 'DrivingCompetencyCR'],
  },

  async install(moduleCtx: ModuleContext) {
    ctx = moduleCtx

    // Wire on-device LLM for question generation
    setLlmHandle(ctx.llm)

    // Check for due review questions and notify
    checkDueOnOpen()
    scheduleReviewReminder()

    const { getBelowThresholdCategories, mastery: masteryState } = useMastery()

    ctx.pushInboxItem({
      id: 'cr-driving-practice',
      moduleId: 'cr-driving',
      type: 'action',
      icon: 'directions_car',
      title: masteryState.value.totalAttempts > 0
        ? `Examen COSEVI — ${masteryState.value.lastScore}%`
        : 'Examen Teorico COSEVI',
      subtitle: masteryState.value.totalAttempts > 0
        ? `Temas debiles: ${masteryState.value.weakTopics.length} — Repasa para mantener dominio`
        : 'Practica el examen teorico de conducir',
      action: masteryState.value.totalAttempts > 0 ? 'Repasar' : 'Iniciar',
      route: '/module/cr-driving/practice',
      timestamp: Date.now(),
      priority: masteryState.value.totalAttempts > 0 ? 5 : 8,
    })

    // Pregunta del día: when categories are below 90%
    const belowThreshold = getBelowThresholdCategories()
    if (belowThreshold.length > 0) {
      ctx.pushInboxItem({
        id: 'cr-driving-pregunta-dia',
        moduleId: 'cr-driving',
        type: 'action',
        icon: 'quiz',
        title: 'Pregunta del dia',
        subtitle: `${belowThreshold.length} tema${belowThreshold.length > 1 ? 's' : ''} por debajo del 90%`,
        action: 'Responder',
        route: '/module/cr-driving/micro-quiz',
        timestamp: Date.now(),
        priority: 9,
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
    const { getBelowThresholdCategories, mastery: masteryState } = useMastery()
    const items = [
      {
        id: 'cr-driving-practice',
        moduleId: 'cr-driving',
        type: 'action' as const,
        icon: 'directions_car',
        title: masteryState.value.totalAttempts > 0
          ? `Examen COSEVI — ${masteryState.value.lastScore}%`
          : 'Examen Teorico COSEVI',
        subtitle: masteryState.value.totalAttempts > 0
          ? `Temas debiles: ${masteryState.value.weakTopics.length} — Repasa para mantener dominio`
          : 'Practica el examen teorico de conducir',
        action: masteryState.value.totalAttempts > 0 ? 'Repasar' : 'Iniciar',
        route: '/module/cr-driving/practice',
        timestamp: Date.now(),
        priority: masteryState.value.totalAttempts > 0 ? 5 : 8,
      },
    ]

    const belowThreshold = getBelowThresholdCategories()
    if (belowThreshold.length > 0) {
      items.push({
        id: 'cr-driving-pregunta-dia',
        moduleId: 'cr-driving',
        type: 'action' as const,
        icon: 'quiz',
        title: 'Pregunta del dia',
        subtitle: `${belowThreshold.length} tema${belowThreshold.length > 1 ? 's' : ''} por debajo del 90%`,
        action: 'Responder',
        route: '/module/cr-driving/micro-quiz',
        timestamp: Date.now(),
        priority: 9,
      })
    }

    return items
  },
}

export default crDrivingModule
