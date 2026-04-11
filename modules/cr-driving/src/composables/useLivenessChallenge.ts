/**
 * useLivenessChallenge — Pre-exam liveness verification.
 *
 * Asks user to perform natural movements (blink, turn head) to prove
 * they are a live person, not a static image or video replay.
 *
 * Uses FaceLandmarker blendshapes from useFaceDetection.
 * All processing is local — no frames leave the device.
 */
import { ref, computed, watch, type Ref } from 'vue'
import type { BlendshapeValues } from './useFaceDetection'

export type ChallengeStep = 'blink' | 'turn-left' | 'turn-right'

export interface LivenessResult {
  passed: boolean
  steps: { step: ChallengeStep; completed: boolean; timestamp: number }[]
  durationMs: number
}

const BLINK_THRESHOLD = 0.4
const HEAD_TURN_THRESHOLD = 15 // degrees

export function useLivenessChallenge(blendshapes: Ref<BlendshapeValues>) {
  const active = ref(false)
  const currentStep = ref<ChallengeStep>('blink')
  const stepIndex = ref(0)
  const result = ref<LivenessResult | null>(null)

  const steps: ChallengeStep[] = ['blink', 'turn-left', 'turn-right']
  const completedSteps: { step: ChallengeStep; completed: boolean; timestamp: number }[] = []
  let startTime = 0

  const stepLabel = computed(() => {
    switch (currentStep.value) {
      case 'blink': return 'Parpadea naturalmente'
      case 'turn-left': return 'Gira la cabeza a la izquierda'
      case 'turn-right': return 'Gira la cabeza a la derecha'
    }
  })

  const stepIcon = computed(() => {
    switch (currentStep.value) {
      case 'blink': return 'visibility'
      case 'turn-left': return 'arrow_back'
      case 'turn-right': return 'arrow_forward'
    }
  })

  const progress = computed(() => stepIndex.value / steps.length)

  function start(): void {
    active.value = true
    stepIndex.value = 0
    currentStep.value = steps[0]
    completedSteps.length = 0
    result.value = null
    startTime = Date.now()
  }

  function stop(): void {
    active.value = false
  }

  // Watch blendshapes to detect completion of each step
  let stopWatcher: (() => void) | null = null

  function startWatching(): void {
    stopWatcher = watch(
      blendshapes,
      (bs) => {
        if (!active.value) return

        let passed = false

        switch (currentStep.value) {
          case 'blink':
            passed = bs.eyeBlinkLeft > BLINK_THRESHOLD || bs.eyeBlinkRight > BLINK_THRESHOLD
            break
          case 'turn-left':
            passed = bs.headYaw < -HEAD_TURN_THRESHOLD
            break
          case 'turn-right':
            passed = bs.headYaw > HEAD_TURN_THRESHOLD
            break
        }

        if (passed) {
          completedSteps.push({
            step: currentStep.value,
            completed: true,
            timestamp: Date.now(),
          })

          stepIndex.value++

          if (stepIndex.value >= steps.length) {
            // All steps completed
            active.value = false
            result.value = {
              passed: true,
              steps: [...completedSteps],
              durationMs: Date.now() - startTime,
            }
          } else {
            currentStep.value = steps[stepIndex.value]
          }
        }
      },
      { deep: true },
    )
  }

  function cleanup(): void {
    stopWatcher?.()
    stopWatcher = null
  }

  return {
    active,
    currentStep,
    stepLabel,
    stepIcon,
    progress,
    result,
    start,
    stop,
    startWatching,
    cleanup,
  }
}
