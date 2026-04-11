import { ref, computed } from 'vue'
import type { ModuleContext } from '@attestto/module-sdk'
import type {
  AgreementSession,
  AgreementPhase,
  AgreementDraft,
  ConversationSource,
} from '../types'

let moduleCtx: ModuleContext | null = null

export function setModuleContext(ctx: ModuleContext): void {
  moduleCtx = ctx
}

// ── Reactive State ──────────────────────────────────────────────

const session = ref<AgreementSession | null>(null)

const phase = computed(() => session.value?.phase ?? 'input')
const draft = computed(() => session.value?.editedDraft ?? session.value?.draft ?? null)
const isComplete = computed(() => session.value?.phase === 'complete')

// ── Session CRUD ────────────────────────────────────────────────

function createSession(text: string, source: ConversationSource): AgreementSession {
  const s: AgreementSession = {
    id: globalThis.crypto.randomUUID(),
    phase: 'input',
    conversationSource: source,
    conversationText: text,
    draft: null,
    editedDraft: null,
    signedAt: null,
    agreementHash: null,
    signature: null,
    vcId: null,
    anchorTx: null,
    createdAt: Date.now(),
    error: null,
  }
  session.value = s
  persist()
  return s
}

function updatePhase(p: AgreementPhase): void {
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

function setDraft(d: AgreementDraft): void {
  if (!session.value) return
  session.value.draft = d
  persist()
}

function setEditedDraft(d: AgreementDraft): void {
  if (!session.value) return
  session.value.editedDraft = d
  persist()
}

function setSigningResult(result: {
  agreementHash: string
  signature: string
  vcId: string
  anchorTx?: string | null
}): void {
  if (!session.value) return
  session.value.agreementHash = result.agreementHash
  session.value.signature = result.signature
  session.value.vcId = result.vcId
  session.value.anchorTx = result.anchorTx ?? null
  session.value.signedAt = new Date().toISOString()
  session.value.phase = 'complete'
  persist()
}

function reset(): void {
  session.value = null
}

// ── Persistence ─────────────────────────────────────────────────

const SESSIONS_KEY = 'sessions'

function persist(): void {
  if (!moduleCtx || !session.value) return
  moduleCtx.storage.set(`session:${session.value.id}`, session.value)

  loadSessionIndex().then((index) => {
    const activeDraft = session.value!.editedDraft ?? session.value!.draft
    const parties = activeDraft?.parties.map((p) => p.name).join(' / ') ?? ''
    const entry = {
      id: session.value!.id,
      phase: session.value!.phase,
      agreementType: activeDraft?.type ?? null,
      partySummary: parties,
      createdAt: session.value!.createdAt,
      signedAt: session.value!.signedAt,
    }
    const existing = index.findIndex((s) => s.id === session.value!.id)
    if (existing >= 0) {
      index[existing] = entry
    } else {
      index.unshift(entry)
    }
    moduleCtx!.storage.set(SESSIONS_KEY, index.slice(0, 20))
  })
}

interface SessionIndexEntry {
  id: string
  phase: AgreementPhase
  agreementType: string | null
  partySummary: string
  createdAt: number
  signedAt: string | null
}

async function loadSessionIndex(): Promise<SessionIndexEntry[]> {
  if (!moduleCtx) return []
  return (await moduleCtx.storage.get<SessionIndexEntry[]>(SESSIONS_KEY)) ?? []
}

async function loadSession(id: string): Promise<AgreementSession | null> {
  if (!moduleCtx) return null
  return moduleCtx.storage.get<AgreementSession>(`session:${id}`)
}

// ── Export ───────────────────────────────────────────────────────

export function useAgreementSession() {
  return {
    session,
    phase,
    draft,
    isComplete,
    createSession,
    updatePhase,
    setError,
    setDraft,
    setEditedDraft,
    setSigningResult,
    reset,
    loadSessionIndex,
    loadSession,
  }
}
