<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ExamQuestion } from '../types'

const props = defineProps<{
  question: ExamQuestion
  questionNumber: number
  totalQuestions: number
  progress: number
  score: number
  timeRemaining: number
  feedbackVisible: boolean
  lastAnswer: { selected: number; correct: number; isCorrect: boolean } | null
  faceStatus?: string
  lockdownActive?: boolean
  voiceActive?: boolean
  violationCount?: number
}>()

const emit = defineEmits<{
  answer: [selected: number]
  next: []
}>()

const selected = ref<number | null>(null)

const timerDisplay = computed(() => {
  const m = Math.floor(props.timeRemaining / 60)
  const s = props.timeRemaining % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

const timerUrgent = computed(() => props.timeRemaining < 120)

// Reset selection on new question
watch(
  () => props.question.id,
  () => {
    selected.value = null
  },
)

// Auto-advance after feedback
watch(
  () => props.feedbackVisible,
  (visible) => {
    if (visible) {
      setTimeout(() => emit('next'), 3000)
    }
  },
)

function selectOption(index: number) {
  if (props.feedbackVisible) return
  selected.value = index
  emit('answer', index)
}

function optionClass(index: number): string {
  if (!props.feedbackVisible) {
    return selected.value === index ? 'selected' : ''
  }
  if (index === props.lastAnswer?.correct) return 'correct'
  if (index === props.lastAnswer?.selected && !props.lastAnswer?.isCorrect) return 'wrong'
  return 'dimmed'
}
</script>

<template>
  <div class="question-screen">
    <!-- Top bar -->
    <div class="top-bar">
      <div class="counter">{{ questionNumber }}/{{ totalQuestions }}</div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progress * 100}%` }" />
      </div>
      <div :class="['timer', { urgent: timerUrgent }]">{{ timerDisplay }}</div>
    </div>

    <!-- Score circle -->
    <div class="score-circle">
      <span class="score-number">{{ score }}</span>
      <span v-if="feedbackVisible && lastAnswer?.isCorrect" class="score-plus">+1</span>
    </div>

    <!-- Question card -->
    <div class="question-card">
      <div class="category-tag">{{ question.category }}</div>
      <p class="question-text">{{ question.question }}</p>
    </div>

    <!-- Options -->
    <div class="options">
      <button
        v-for="(opt, i) in question.options"
        :key="i"
        :class="['option-card', optionClass(i)]"
        :disabled="feedbackVisible"
        @click="selectOption(i)"
      >
        <span v-if="feedbackVisible && i === lastAnswer?.correct" class="option-icon">&#10003;</span>
        <span v-else-if="feedbackVisible && i === lastAnswer?.selected && !lastAnswer?.isCorrect" class="option-icon">&#10007;</span>
        {{ opt }}
      </button>
    </div>

    <!-- Why explanation (feedback) -->
    <div v-if="feedbackVisible" class="why-card">
      <div class="why-header">&#128161; ¿Por que?</div>
      <p class="why-text">{{ question.why }}</p>
      <div class="auto-advance">Siguiente en 3s...</div>
    </div>

    <!-- Bottom proctoring status bar -->
    <div class="status-bar">
      <div class="status-item" :title="'Rostro: ' + (faceStatus ?? 'unknown')">
        <q-icon
          name="face"
          size="16px"
          :color="faceStatus === 'present' ? 'positive' : faceStatus === 'multiple' ? 'negative' : 'warning'"
        />
      </div>
      <div class="status-item" title="Pantalla bloqueada">
        <q-icon
          name="lock"
          size="16px"
          :color="lockdownActive ? 'positive' : 'negative'"
        />
      </div>
      <div v-if="voiceActive" class="status-item" title="Voz detectada">
        <q-icon name="mic" size="16px" color="negative" />
      </div>
      <div v-if="(violationCount ?? 0) > 0" class="status-item violation-count">
        {{ violationCount }}
      </div>
      <div :class="['status-dot', faceStatus === 'present' && lockdownActive ? 'ok' : 'warn']" />
    </div>
  </div>
</template>

<style scoped>
.question-screen {
  min-height: 100dvh;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.top-bar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.counter {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 10px;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-card);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.timer {
  font-size: 13px;
  font-weight: 600;
  font-family: monospace;
  padding: 4px 10px;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
}

.timer.urgent {
  color: var(--critical);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  50% { opacity: 0.5; }
}

.score-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  align-self: center;
}

.score-number {
  font-size: 36px;
  font-weight: 700;
}

.score-plus {
  font-size: 16px;
  font-weight: 600;
  color: var(--success);
  animation: float-up 0.5s ease-out;
}

@keyframes float-up {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-20px); }
}

.question-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.category-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-sm);
}

.question-text {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.option-card {
  padding: var(--space-md);
  background: var(--bg-card);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
}

.option-card:active:not(:disabled) {
  background: var(--bg-elevated);
}

.option-card.selected {
  border-color: var(--primary);
  background: rgba(89, 79, 211, 0.1);
}

.option-card.correct {
  border-color: var(--success);
  background: rgba(74, 222, 128, 0.1);
  color: var(--success);
}

.option-card.wrong {
  border-color: var(--warning);
  background: rgba(249, 115, 22, 0.1);
  color: var(--warning);
}

.option-card.dimmed {
  opacity: 0.4;
}

.option-icon {
  font-weight: 700;
  flex-shrink: 0;
}

.why-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  border-left: 3px solid var(--alert);
}

.why-header {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: var(--space-sm);
}

.why-text {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.auto-advance {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  margin-top: var(--space-sm);
}

.status-bar {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  margin-top: auto;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.ok {
  background: var(--success);
}

.status-dot.warn {
  background: var(--warning);
}

.violation-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--critical);
  background: rgba(239, 68, 68, 0.15);
  padding: 2px 6px;
  border-radius: var(--radius-full);
}
</style>
