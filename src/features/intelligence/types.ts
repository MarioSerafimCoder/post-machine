export const channels = ['Instagram', 'LinkedIn', 'Threads', 'Pinterest', 'X', 'Facebook'] as const
export const accessStates = ['metadata', 'unavailable', 'reviewed'] as const

export type Assessment = 'verified' | 'heuristic' | 'experimental' | 'insufficient_data' | 'needs_review'
export const assessments: Record<Assessment, string> = {
  verified: 'Verificação objetiva',
  heuristic: 'Sugestão editorial',
  experimental: 'Hipótese de teste',
  insufficient_data: 'Dados insuficientes',
  needs_review: 'Revisão humana',
}

export type Insight = {
  id: string
  ruleId?: string
  title: string
  detail: string
  assessment: Assessment
  alternative?: string
  actions?: readonly { label: string; run: () => void }[]
}

export const preferences = ['carousel', 'post', 'comparison', 'explanation', 'headline-question', 'headline-declarative'] as const
export type Preference = typeof preferences[number]
