import { z } from 'zod'
import { formatIds } from './catalog'
import { identifyUrl } from './urls'

const short = z.string().trim().max(180)
const notes = z.string().trim().max(1600)
const url = z.string().trim().max(2048).refine(value => {
  try { identifyUrl(value); return true } catch { return false }
}, 'Informe uma URL pública válida.')

export const analysisFields = { hook: 'Gancho', structure: 'Estrutura', language: 'Linguagem', mechanism: 'Mecanismo criativo', application: 'Aplicabilidade', notes: 'Observações' } as const
const analysisSchema = z.object({ hook: notes, structure: notes, language: notes, mechanism: notes, application: notes, notes }).strict()
export const contentTypes = ['Vídeo', 'Carrossel', 'Imagem', 'Artigo', 'Outro'] as const
export const referenceSchema = z.object({
  id: z.uuid(), title: short.min(1), url, author: short, publication: z.iso.date().or(z.literal('')),
  type: z.enum(contentTypes), format: z.enum(formatIds), niche: short, description: notes,
  analysis: analysisSchema, favorite: z.boolean(), createdAt: z.iso.datetime(),
}).strict()
export const librarySchema = z.object({ schemaVersion: z.literal(1), references: z.array(referenceSchema).max(2000) }).strict()
export type Reference = z.infer<typeof referenceSchema>
export type AnalysisField = keyof Reference['analysis']
export const newReference = (): Reference => ({
  id: crypto.randomUUID(), title: '', url: '', author: '', publication: '', type: 'Vídeo', format: 'provocativa',
  niche: '', description: '', analysis: { hook: '', structure: '', language: '', mechanism: '', application: '', notes: '' },
  favorite: false, createdAt: new Date().toISOString(),
})
export function duplicates(a: Reference, b: Reference) {
  const one = identifyUrl(a.url), two = identifyUrl(b.url)
  return one.canonical === two.canonical || !!(one.platformId && one.platform === two.platform && one.platformId === two.platformId)
}
