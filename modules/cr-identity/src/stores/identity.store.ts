/**
 * Identity draft store — manages drafts for IdentityVC issuance.
 * Persists to localStorage via module-scoped storage key.
 */

import { ref, computed } from 'vue'
import type { IdentityDraft, IssuedIdentityRecord, DraftStatus } from '../types/identity'

const STORAGE_KEY = 'cr-identity:drafts'
const ISSUED_KEY = 'cr-identity:issued'

const drafts = ref<IdentityDraft[]>([])
const issued = ref<IssuedIdentityRecord[]>([])

function loadDrafts(): IdentityDraft[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function persistDrafts(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.value))
}

function loadIssued(): IssuedIdentityRecord[] {
  const raw = localStorage.getItem(ISSUED_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function persistIssued(): void {
  localStorage.setItem(ISSUED_KEY, JSON.stringify(issued.value))
}

export function useIdentityStore() {
  // Initialize from storage
  if (drafts.value.length === 0) {
    drafts.value = loadDrafts()
  }
  if (issued.value.length === 0) {
    issued.value = loadIssued()
  }

  const pendingDrafts = computed(() =>
    drafts.value.filter((d) => d.status === 'draft' || d.status === 'review'),
  )

  function addDraft(draft: IdentityDraft): void {
    drafts.value.push(draft)
    persistDrafts()
  }

  function updateDraft(draftId: string, updates: Partial<IdentityDraft>): void {
    const idx = drafts.value.findIndex((d) => d.draftId === draftId)
    if (idx >= 0) {
      drafts.value[idx] = { ...drafts.value[idx], ...updates, updatedAt: new Date().toISOString() }
      persistDrafts()
    }
  }

  function markStatus(draftId: string, status: DraftStatus): void {
    updateDraft(draftId, { status })
  }

  function removeDraft(draftId: string): void {
    drafts.value = drafts.value.filter((d) => d.draftId !== draftId)
    persistDrafts()
  }

  function getDraft(draftId: string): IdentityDraft | undefined {
    return drafts.value.find((d) => d.draftId === draftId)
  }

  function addIssuedRecord(record: IssuedIdentityRecord): void {
    issued.value.unshift(record)
    if (issued.value.length > 100) issued.value = issued.value.slice(0, 100)
    persistIssued()
  }

  return {
    drafts,
    issued,
    pendingDrafts,
    addDraft,
    updateDraft,
    markStatus,
    removeDraft,
    getDraft,
    addIssuedRecord,
  }
}
