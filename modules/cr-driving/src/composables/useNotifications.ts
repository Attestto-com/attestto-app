/**
 * useNotifications — local push notifications for review reminders.
 *
 * Uses the Notification API + setTimeout scheduling.
 * No backend needed — reminders are scheduled locally in the PWA.
 * Falls back gracefully if notifications are denied or unavailable.
 */
import { ref } from 'vue'
import { getDueCount, getNextReviewDate } from './useSpacedRepetition'

const permission = ref<NotificationPermission>(
  typeof Notification !== 'undefined' ? Notification.permission : 'denied',
)
const supported = typeof Notification !== 'undefined'

let scheduledTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Request notification permission from the user.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!supported) return 'denied'
  const result = await Notification.requestPermission()
  permission.value = result
  return result
}

/**
 * Show a notification immediately.
 */
export function showNotification(title: string, body: string, tag?: string): void {
  if (!supported || permission.value !== 'granted') return

  new Notification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: tag ?? 'attestto-review',
  } as NotificationOptions)
}

/**
 * Schedule a review reminder notification.
 * Calculates delay from next review date and sets a timer.
 */
export function scheduleReviewReminder(): void {
  clearScheduledReminder()

  const nextDate = getNextReviewDate()
  if (!nextDate) return

  const nextTime = new Date(nextDate + 'T09:00:00').getTime() // 9 AM local
  const now = Date.now()
  const delay = nextTime - now

  if (delay <= 0) {
    // Already due — notify now
    const dueCount = getDueCount()
    if (dueCount > 0) {
      showNotification(
        'Repaso pendiente',
        `Tienes ${dueCount} pregunta${dueCount > 1 ? 's' : ''} lista${dueCount > 1 ? 's' : ''} para repasar.`,
        'attestto-review-due',
      )
    }
    return
  }

  // Schedule for future (max ~24 days due to setTimeout limit)
  const maxDelay = 24 * 24 * 60 * 60 * 1000
  scheduledTimer = setTimeout(() => {
    const dueCount = getDueCount()
    if (dueCount > 0) {
      showNotification(
        'Repaso pendiente',
        `Tienes ${dueCount} pregunta${dueCount > 1 ? 's' : ''} lista${dueCount > 1 ? 's' : ''} para repasar.`,
        'attestto-review-due',
      )
    }
    // Reschedule for next batch
    scheduleReviewReminder()
  }, Math.min(delay, maxDelay))
}

/**
 * Clear any scheduled reminder.
 */
export function clearScheduledReminder(): void {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer)
    scheduledTimer = null
  }
}

/**
 * Check and notify if there are due questions (call on app open).
 */
export function checkDueOnOpen(): void {
  const dueCount = getDueCount()
  if (dueCount > 0 && permission.value === 'granted') {
    showNotification(
      'Repaso pendiente',
      `Tienes ${dueCount} pregunta${dueCount > 1 ? 's' : ''} lista${dueCount > 1 ? 's' : ''} para repasar.`,
      'attestto-review-open',
    )
  }
}

export function useNotifications() {
  return {
    permission,
    supported,
    requestPermission,
    showNotification,
    scheduleReviewReminder,
    clearScheduledReminder,
    checkDueOnOpen,
  }
}
