import { ref, computed } from 'vue'
import type { ModuleContext } from '@attestto/module-sdk'
import type {
  SigningSession,
  SessionPhase,
  DocumentAnalysis,
  ChatMessage,
  UserAnswer,
} from '../types'

let moduleCtx: ModuleContext | null = null

export function setModuleContext(ctx: ModuleContext): void {
  moduleCtx = ctx
}

// ── Reactive State ──────────────────────────────────────────────

const session = ref<SigningSession | null>(null)
const pdfBytes = ref<Uint8Array | null>(null) // In-memory only, not persisted

// ── Computed ────────────────────────────────────────────────────

const phase = computed(() => session.value?.phase ?? 'upload')
const analysis = computed(() => session.value?.analysis ?? null)
const riskLevel = computed(() => session.value?.analysis?.riskLevel ?? null)
const fileName = computed(() => session.value?.fileName ?? '')
const isComplete = computed(() => session.value?.phase === 'complete')

// ── Session CRUD ────────────────────────────────────────────────

function createSession(name: string, bytes: Uint8Array): SigningSession {
  const s: SigningSession = {
    id: globalThis.crypto.randomUUID(),
    fileName: name,
    extractedText: '',
    analysis: null,
    phase: 'upload',
    chatMessages: [],
    userAnswers: [],
    recommendation: null,
    signedAt: null,
    pdfHash: null,
    signature: null,
    verificationMethod: null,
    anchorTx: null,
    vcId: null,
    createdAt: Date.now(),
    error: null,
  }
  session.value = s
  pdfBytes.value = bytes
  persist()
  return s
}

function updatePhase(p: SessionPhase): void {
  if (!session.value) return
  session.value.phase = p
  session.value.error = null
  persist()
}

function setError(msg: string): void {
  if (!session.value) return
  session.value.phase = 'error'
  session.value.error = msg
  persist()
}

function setExtractedText(text: string): void {
  if (!session.value) return
  session.value.extractedText = text
  persist()
}

function setAnalysis(a: DocumentAnalysis): void {
  if (!session.value) return
  session.value.analysis = a

  // Generate initial chat messages from analysis questions
  if (a.questions.length > 0) {
    session.value.chatMessages = [
      {
        id: 'intro',
        role: 'assistant',
        text: `Antes de firmar, te ayudo a entender que estas firmando.\n\nEste documento es: ${a.plainLanguageSummary}`,
        timestamp: Date.now(),
      },
    ]
  }

  persist()
}

function addChatMessage(msg: ChatMessage): void {
  if (!session.value) return
  session.value.chatMessages.push(msg)
  persist()
}

function addUserAnswer(answer: UserAnswer): void {
  if (!session.value) return
  session.value.userAnswers.push(answer)
  persist()
}

/**
 * Get the next unanswered question, or null if all answered.
 */
function getNextQuestion(): { id: string; text: string } | null {
  if (!session.value?.analysis) return null
  const answeredIds = new Set(session.value.userAnswers.map((a) => a.questionId))
  return session.value.analysis.questions.find((q) => !answeredIds.has(q.id)) ?? null
}

/**
 * Compute signing recommendation based on risk level and answers.
 */
function computeRecommendation(): 'sign' | 'review' | 'legal-advice' {
  if (!session.value?.analysis) return 'sign'

  const { riskLevel } = session.value.analysis

  if (riskLevel === 'critical') return 'legal-advice'
  if (riskLevel === 'high') return 'review'

  // Check for concerning answers (user said "no" or expressed confusion)
  const negativePatterns = /\bno\b|no se|no estoy seguro|no entiendo|no sabia/i
  const hasConcern = session.value.userAnswers.some((a) => negativePatterns.test(a.answer))

  if (hasConcern && riskLevel === 'medium') return 'review'

  return 'sign'
}

function setRecommendation(): void {
  if (!session.value) return
  session.value.recommendation = computeRecommendation()
  persist()
}

function setSigningResult(result: {
  pdfHash: string
  signature: string
  verificationMethod: string
  vcId: string
  anchorTx?: string | null
}): void {
  if (!session.value) return
  session.value.pdfHash = result.pdfHash
  session.value.signature = result.signature
  session.value.verificationMethod = result.verificationMethod
  session.value.vcId = result.vcId
  session.value.anchorTx = result.anchorTx ?? null
  session.value.signedAt = new Date().toISOString()
  session.value.phase = 'complete'
  persist()
}

function reset(): void {
  session.value = null
  pdfBytes.value = null
}

// ── Persistence ─────────────────────────────────────────────────

const SESSIONS_KEY = 'sessions'

function persist(): void {
  if (!moduleCtx || !session.value) return
  // Save current session
  moduleCtx.storage.set(`session:${session.value.id}`, session.value)

  // Update session index
  loadSessionIndex().then((index) => {
    const existing = index.findIndex((s) => s.id === session.value!.id)
    const entry = {
      id: session.value!.id,
      fileName: session.value!.fileName,
      phase: session.value!.phase,
      riskLevel: session.value!.analysis?.riskLevel ?? null,
      documentType: session.value!.analysis?.documentType ?? null,
      createdAt: session.value!.createdAt,
      signedAt: session.value!.signedAt,
    }
    if (existing >= 0) {
      index[existing] = entry
    } else {
      index.unshift(entry)
    }
    // Keep max 20 sessions in index
    moduleCtx!.storage.set(SESSIONS_KEY, index.slice(0, 20))
  })
}

interface SessionIndexEntry {
  id: string
  fileName: string
  phase: SessionPhase
  riskLevel: string | null
  documentType: string | null
  createdAt: number
  signedAt: string | null
}

async function loadSessionIndex(): Promise<SessionIndexEntry[]> {
  if (!moduleCtx) return []
  return (await moduleCtx.storage.get<SessionIndexEntry[]>(SESSIONS_KEY)) ?? []
}

async function loadSession(id: string): Promise<SigningSession | null> {
  if (!moduleCtx) return null
  return moduleCtx.storage.get<SigningSession>(`session:${id}`)
}

// ── Export ───────────────────────────────────────────────────────

export function useSigningSession() {
  return {
    session,
    pdfBytes,
    phase,
    analysis,
    riskLevel,
    fileName,
    isComplete,
    createSession,
    updatePhase,
    setError,
    setExtractedText,
    setAnalysis,
    addChatMessage,
    addUserAnswer,
    getNextQuestion,
    setRecommendation,
    setSigningResult,
    reset,
    loadSessionIndex,
    loadSession,
  }
}
