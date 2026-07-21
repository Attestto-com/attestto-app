// Onboarding flow registry. Add rows here to define new citizen entry paths.
// See memory `pluggable-onboarding` for the full architecture rationale.

export interface OnboardingStep {
  id: string
  component: string
}

export interface OnboardingFlow {
  id: string
  label: string
  steps: OnboardingStep[]
}

export const flows: Record<string, OnboardingFlow> = {
  citizen: {
    id: 'citizen',
    label: 'Citizen (default)',
    steps: [
      { id: 'phone', component: 'PhoneStep' },
      { id: 'code', component: 'CodeStep' },
    ],
  },
}

export function resolveFlow(code?: string | null): OnboardingFlow {
  if (code && flows[code]) return flows[code]
  return flows.citizen
}
