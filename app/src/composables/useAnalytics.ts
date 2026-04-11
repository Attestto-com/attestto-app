/**
 * Privacy-first analytics via Plausible.
 * No cookies, no PII, GDPR/Ley 8968 compliant.
 *
 * Tracks: page views (automatic), custom events (manual).
 * Sign up at https://plausible.io or self-host.
 */

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void
  }
}

function track(event: string, props?: Record<string, string | number | boolean>) {
  window.plausible?.(event, props ? { props } : undefined)
}

export function trackModuleOpen(moduleId: string) {
  track('Module Open', { module: moduleId })
}

export function trackQuizComplete(mode: string, score: number, categories: number) {
  track('Quiz Complete', { mode, score, categories })
}

export function trackExamComplete(passed: boolean, score: number) {
  track('Exam Complete', { passed: String(passed), score })
}

export function trackLlmDownload(status: string) {
  track('LLM Download', { status })
}

export function trackPwaInstall() {
  track('PWA Install')
}

export function trackCredentialIssued(type: string) {
  track('Credential Issued', { type })
}
