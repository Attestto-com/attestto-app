/**
 * useLockdown — PWA lockdown mode.
 *
 * No kiosk mode in PWA. Instead we use:
 * - Fullscreen API (requestFullscreen)
 * - Visibility change detection (tab switch)
 * - Window blur/focus tracking
 * - Keyboard shortcut blocking (Ctrl+C, Alt+Tab logged)
 *
 * All events feed into the exam hash chain.
 */
import { ref, onUnmounted } from 'vue'

export interface LockdownEvent {
  type: 'focus-lost' | 'focus-regained' | 'blocked-key' | 'fullscreen-exit' | 'blocked-clipboard' | 'blocked-print'
  data?: Record<string, unknown>
  timestamp: number
}

export function useLockdown() {
  const active = ref(false)
  const focusLost = ref(false)
  const violationCount = ref(0)
  const isFullscreen = ref(false)

  let onEvent: ((event: LockdownEvent) => void) | null = null

  function setEventCallback(cb: (event: LockdownEvent) => void): void {
    onEvent = cb
  }

  function emit(type: LockdownEvent['type'], data?: Record<string, unknown>): void {
    violationCount.value++
    onEvent?.({ type, data, timestamp: Date.now() })
  }

  // ── Visibility change ──────────────────────────────

  function handleVisibilityChange(): void {
    if (!active.value) return
    if (document.hidden) {
      focusLost.value = true
      emit('focus-lost', { source: 'visibility' })
    } else {
      focusLost.value = false
      emit('focus-regained', { source: 'visibility' })
    }
  }

  function handleBlur(): void {
    if (!active.value) return
    focusLost.value = true
    emit('focus-lost', { source: 'blur' })
  }

  function handleFocus(): void {
    if (!active.value) return
    focusLost.value = false
    emit('focus-regained', { source: 'focus' })
  }

  // ── Fullscreen ─────────────────────────────────────

  function handleFullscreenChange(): void {
    if (!active.value) return
    isFullscreen.value = !!document.fullscreenElement
    if (!document.fullscreenElement) {
      emit('fullscreen-exit')
      // Re-request fullscreen
      requestFullscreen()
    }
  }

  async function requestFullscreen(): Promise<void> {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      isFullscreen.value = true
    } catch {
      // Fullscreen may be blocked by browser policy
    }
  }

  // ── Keyboard blocking ──────────────────────────────

  function handleKeydown(e: KeyboardEvent): void {
    if (!active.value) return

    // Block common escape shortcuts
    if (
      (e.ctrlKey && ['c', 'v', 'p', 'a', 's', 'f', 'l', 'w', 't', 'n'].includes(e.key.toLowerCase())) ||
      (e.metaKey && ['c', 'v', 'p', 'a', 's', 'f', 'l', 'w', 't', 'n', 'q', 'h', 'm'].includes(e.key.toLowerCase())) ||
      e.key === 'F5' ||
      e.key === 'F11' ||
      e.key === 'F12' ||
      (e.altKey && e.key === 'Tab') ||
      (e.altKey && e.key === 'F4') ||
      e.key === 'PrintScreen'
    ) {
      e.preventDefault()
      e.stopPropagation()
      emit('blocked-key', { key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey })
    }
  }

  // ── Context menu + selection + clipboard blocking ──

  function blockContextMenu(e: Event): void {
    if (!active.value) return
    e.preventDefault()
  }

  function blockSelection(e: Event): void {
    if (!active.value) return
    e.preventDefault()
  }

  function blockPaste(e: Event): void {
    if (!active.value) return
    e.preventDefault()
    emit('blocked-clipboard', { action: 'paste' })
  }

  // ── Print blocking ──────────────────────────────────

  function handleBeforePrint(): void {
    if (!active.value) return
    emit('blocked-print')
  }

  /** Inject @media print CSS that hides everything during lockdown */
  let printStyleEl: HTMLStyleElement | null = null

  function injectPrintBlock(): void {
    printStyleEl = document.createElement('style')
    printStyleEl.textContent = '@media print { body * { display: none !important; visibility: hidden !important; } body::after { content: "Impresión bloqueada durante examen"; display: block !important; visibility: visible !important; font-size: 2rem; text-align: center; padding: 4rem; } }'
    document.head.appendChild(printStyleEl)
  }

  function removePrintBlock(): void {
    if (printStyleEl) {
      printStyleEl.remove()
      printStyleEl = null
    }
  }

  // ── Public API ─────────────────────────────────────

  async function activate(): Promise<void> {
    active.value = true
    violationCount.value = 0
    focusLost.value = false

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('keydown', handleKeydown, true)
    document.addEventListener('contextmenu', blockContextMenu, true)
    document.addEventListener('selectstart', blockSelection, true)
    document.addEventListener('copy', blockSelection, true)
    document.addEventListener('cut', blockSelection, true)
    document.addEventListener('paste', blockPaste, true)
    window.addEventListener('beforeprint', handleBeforePrint)
    injectPrintBlock()

    await requestFullscreen()
  }

  function deactivate(): void {
    active.value = false
    focusLost.value = false

    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('blur', handleBlur)
    window.removeEventListener('focus', handleFocus)
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('keydown', handleKeydown, true)
    document.removeEventListener('contextmenu', blockContextMenu, true)
    document.removeEventListener('selectstart', blockSelection, true)
    document.removeEventListener('copy', blockSelection, true)
    document.removeEventListener('cut', blockSelection, true)
    document.removeEventListener('paste', blockPaste, true)
    window.removeEventListener('beforeprint', handleBeforePrint)
    removePrintBlock()

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }

  onUnmounted(() => {
    if (active.value) deactivate()
  })

  return {
    active,
    focusLost,
    violationCount,
    isFullscreen,
    activate,
    deactivate,
    setEventCallback,
  }
}
