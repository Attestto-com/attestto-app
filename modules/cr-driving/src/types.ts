export interface ExamQuestion {
  id: string
  category: string
  question: string
  options: string[]
  correct: number
  why: string
  licenses: string[]
}

export interface ExamAnswer {
  questionId: string
  selected: number
  correct: boolean
  timestamp: number
}

export interface CategoryScore {
  correct: number
  total: number
  /** ISO date of last practice for this category */
  lastPracticed: string
  /** Content version this score was tested against */
  contentVersion: string
}

export interface MasteryState {
  totalAttempts: number
  lastScore: number
  lastAttemptDate: string
  streak: number
  categoryScores: Record<string, CategoryScore>
  weakTopics: string[]
  /** Number of completed license renewals (0 = first-timer) */
  renewalCount: number
  /** Whether all categories are green (above threshold) — gate for VC issuance */
  allGreen: boolean
  /** Categories reset due to law changes, pending acknowledgement */
  pendingLawChanges: string[]
}

export interface ExamConfig {
  questionCount: number
  timeLimitMinutes: number
  passThreshold: number
  maxRetries: number
  cooldownHours: number
  licenseType: 'B' | 'A' | 'C' | 'PRO'
}

export interface ExamSession {
  id: string
  startedAt: number
  config: ExamConfig
  questions: ExamQuestion[]
  answers: ExamAnswer[]
  phase: 'consent' | 'pre-exam' | 'in-progress' | 'feedback' | 'result' | 'credential'
  currentIndex: number
  score: number
  incidents: ExamIncident[]
  chainHead: string
}

export interface ExamIncident {
  type: 'face-absent' | 'face-multiple' | 'face-mismatch' | 'voice-detected' | 'gaze-off' | 'focus-lost'
  severity: 'warning' | 'critical' | 'terminal'
  timestamp: number
  count: number
}

export type ExamResult = {
  passed: boolean
  score: number
  correct: number
  wrong: number
  total: number
  durationSeconds: number
  categoryBreakdown: { category: string; correct: number; total: number; percent: number }[]
  weakTopics: string[]
  chainHead: string
  incidents: ExamIncident[]
}
