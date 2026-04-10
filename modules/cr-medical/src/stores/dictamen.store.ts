/**
 * app-module-cr-medical — Dictamen Store (Pinia)
 *
 * Manages the lifecycle of dictamen drafts and issued VCs.
 * Data lives in module-scoped storage (vault) + IndexedDB for offline drafts.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { DictamenDraft, PatientInfo, DoctorInfo, CRLicenseCategory, ExamResults } from '../types/dictamen'
import { computeExpiryDate } from '../types/dictamen'

export const useDictamenStore = defineStore('cr-medical:dictamen', () => {

  // ── State ────────────────────────────────────────────────────────

  /** Drafts in progress (doctor's side) */
  const drafts = ref<DictamenDraft[]>([])

  /** Currently active draft being filled in */
  const activeDraftId = ref<string | null>(null)

  /** Loading state */
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Computed ─────────────────────────────────────────────────────

  const activeDraft = computed<DictamenDraft | null>(() =>
    drafts.value.find((d) => d.draftId === activeDraftId.value) ?? null
  )

  const pendingDrafts = computed(() =>
    drafts.value.filter((d) => d.status === 'draft' || d.status === 'pending')
  )

  const signedDictamenes = computed(() =>
    drafts.value.filter((d) => d.status === 'signed' || d.status === 'anchored')
  )

  // ── Actions ──────────────────────────────────────────────────────

  function startNewDictamen(patient: PatientInfo, doctor: DoctorInfo): DictamenDraft {
    const now = new Date().toISOString()
    const examDate = now.split('T')[0]

    const draft: DictamenDraft = {
      draftId: uuidv4(),
      status: 'draft',
      patient,
      doctor,
      requestedCategories: ['B1'],  // default, doctor adjusts
      approvedCategories: [],
      examDate,
      expiresAt: computeExpiryDate(examDate, ['B1']),
      results: {
        vision: {
          rightEye: '',
          leftEye: '',
          visualField: 'pass',
          colorVision: 'pass',
          requiresLenses: false,
          daytimeOnly: false,
        },
        hearing: {
          result: 'pass',
          requiresHearingAid: false,
        },
        bloodPressure: {
          systolic: 0,
          diastolic: 0,
          pulse: 0,
          result: 'pass',
        },
        motor: {
          coordination: 'pass',
          strength: 'pass',
          reflexes: 'pass',
          adaptations: [],
        },
        psychological: {
          mentalStatus: 'pass',
          stressResponse: 'pass',
          substanceUse: 'pass',
        },
        overallResult: 'pass',
        observations: '',
      },
      restrictions: [],
      createdAt: now,
      updatedAt: now,
    }

    drafts.value.push(draft)
    activeDraftId.value = draft.draftId
    persistDrafts()
    return draft
  }

  function updateDraftExamResults(draftId: string, results: Partial<ExamResults>) {
    const draft = drafts.value.find((d) => d.draftId === draftId)
    if (!draft) return
    draft.results = { ...draft.results, ...results }
    draft.updatedAt = new Date().toISOString()
    persistDrafts()
  }

  function updateDraftCategories(draftId: string, categories: CRLicenseCategory[]) {
    const draft = drafts.value.find((d) => d.draftId === draftId)
    if (!draft) return
    draft.requestedCategories = categories
    draft.expiresAt = computeExpiryDate(draft.examDate, categories)
    draft.updatedAt = new Date().toISOString()
    persistDrafts()
  }

  function approveDraft(draftId: string, approvedCategories: CRLicenseCategory[], restrictions: string[]) {
    const draft = drafts.value.find((d) => d.draftId === draftId)
    if (!draft) return
    draft.approvedCategories = approvedCategories
    draft.restrictions = restrictions
    draft.expiresAt = computeExpiryDate(draft.examDate, approvedCategories)
    draft.status = 'pending'
    draft.updatedAt = new Date().toISOString()
    persistDrafts()
  }

  function markSigned(draftId: string) {
    const draft = drafts.value.find((d) => d.draftId === draftId)
    if (!draft) return
    draft.status = 'signed'
    draft.updatedAt = new Date().toISOString()
    persistDrafts()
  }

  function markAnchored(draftId: string, anchorTx: string) {
    const draft = drafts.value.find((d) => d.draftId === draftId)
    if (!draft) return
    draft.status = 'anchored'
    ;(draft as DictamenDraft & { anchorTx?: string }).anchorTx = anchorTx
    draft.updatedAt = new Date().toISOString()
    persistDrafts()
  }

  function setActiveDraft(draftId: string | null) {
    activeDraftId.value = draftId
  }

  function deleteDraft(draftId: string) {
    drafts.value = drafts.value.filter((d) => d.draftId !== draftId)
    if (activeDraftId.value === draftId) activeDraftId.value = null
    persistDrafts()
  }

  // ── Persistence (IndexedDB via localForage pattern) ──────────────

  const STORAGE_KEY = 'cr-medical:drafts'

  function persistDrafts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.value))
    } catch {
      // Offline / storage full — silently fail, drafts remain in memory
    }
  }

  function loadDrafts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) drafts.value = JSON.parse(raw) as DictamenDraft[]
    } catch {
      drafts.value = []
    }
  }

  // Hydrate on store creation
  loadDrafts()

  return {
    // state
    drafts,
    activeDraftId,
    loading,
    error,
    // computed
    activeDraft,
    pendingDrafts,
    signedDictamenes,
    // actions
    startNewDictamen,
    updateDraftExamResults,
    updateDraftCategories,
    approveDraft,
    markSigned,
    markAnchored,
    setActiveDraft,
    deleteDraft,
    loadDrafts,
  }
})
