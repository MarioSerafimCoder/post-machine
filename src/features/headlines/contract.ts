import { z } from 'zod'

export const approaches = ['direta', 'provocativa', 'curiosidade', 'informativa', 'reflexiva', 'editorial', 'narrativa'] as const
export type Approach = typeof approaches[number]
export const approachNames: Record<Approach, string> = {
  direta: 'Direta', provocativa: 'Provocativa', curiosidade: 'Curiosidade', informativa: 'Informativa',
  reflexiva: 'Reflexiva', editorial: 'Editorial', narrativa: 'Narrativa',
}
const suggestionSchema = z.object({
  id: z.string().regex(/^[\w-]{1,64}$/), text: z.string().trim().min(1).max(500),
  approach: z.enum(approaches), rationale: z.string().trim().min(1).max(600),
  source: z.enum(['rules', 'external-ai']),
})
export type Suggestion = z.infer<typeof suggestionSchema>
const imported = z.object({
  schemaVersion: z.literal(1),
  suggestions: z.array(suggestionSchema.extend({ source: z.literal('external-ai') })).min(1).max(21),
}).refine(result => new Set(result.suggestions.map(item => item.id)).size === result.suggestions.length, 'Use um ID diferente por sugestão.')

export function importSuggestions(raw: string): Suggestion[] {
  if (raw.length > 50_000) throw Error('A resposta excede 50 mil caracteres.')
  const trimmed = raw.trim()
  const fenced = /^```(?:json)?\s*([\s\S]+?)\s*```$/i.exec(trimmed)
  let value: unknown
  try { value = JSON.parse(fenced?.[1] ?? trimmed) } catch { throw Error('Cole um JSON válido com schemaVersion 1 e suggestions.') }
  const parsed = imported.safeParse(value)
  if (!parsed.success) throw Error(parsed.error.issues.map(issue => `${issue.path.join('.') || 'Resposta'} — ${issue.message}`).join(' · '))
  return parsed.data.suggestions
}

export const headlineSessionSchema = z.object({
  schemaVersion: z.literal(1), original: z.string().max(8000),
  approaches: z.array(z.enum(approaches)).min(1).max(7),
  notes: z.string().max(3000), maxChars: z.number().int().min(0).max(500),
  maxWords: z.number().int().min(0).max(100),
  suggestions: z.array(suggestionSchema).max(21), favorites: z.array(z.string().max(64)).max(21),
  applications: z.array(z.object({ at: z.iso.datetime(), previous: z.string().max(8000), applied: z.string().max(500), suggestionId: z.string().max(64).optional() })).max(20),
})
export type HeadlineSession = z.infer<typeof headlineSessionSchema>
export const newSession = (original: string): HeadlineSession => ({
  schemaVersion: 1, original, approaches: ['direta'], notes: '', maxChars: 90, maxWords: 16, suggestions: [], favorites: [], applications: [],
})

export type HeadlineContext = {
  briefing?: string
  audience?: string
  objective?: string
  tone?: string
  format: string
  selectedSlide?: number
  slides: { title: string; body: string }[]
  sources: { title: string; url: string; summary?: string }[]
}
