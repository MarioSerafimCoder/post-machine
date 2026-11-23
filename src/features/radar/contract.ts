import { z } from 'zod'
import { editorialCategories } from './categories.ts'

const date = z.iso.datetime()
const observation = z.object({ query: z.string().min(1), feed: z.string(), startedAt: date, at: date, bucket: z.number().int().positive() })
export const webUrl = z.url().refine(value => {
  const url = new URL(value)
  return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
})
export const articleImageHosts: Readonly<Record<string, string>> = {
  b9: 'storage.ghost.io',
  'creative-bloq': 'cdn.mos.cms.futurecdn.net',
  guardian: 'i.guim.co.uk',
  designboom: 'www.designboom.com',
  archdaily: 'images.adsttc.com',
}
export const articleImageUrl = webUrl.refine(value => {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.port && Object.values(articleImageHosts).includes(url.hostname)
    && /\.(?:jpe?g|png|webp|avif)$/i.test(url.pathname)
})
export const sourceSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), url: webUrl,
  category: z.string().min(1), language: z.string().optional(), country: z.string().optional(),
  kind: z.enum(['rss', 'trends']), redirectHosts: z.array(z.string()).default([]),
  editorialProfile: z.enum(['specialist', 'selective', 'adjacent']).default('selective'),
  editorialTags: z.array(z.string()).default([]),
})
export const articleSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{32}$/), title: z.string().min(1).max(500),
  summary: z.string().max(420).optional(), url: webUrl, canonicalUrl: webUrl,
  imageUrl: articleImageUrl.optional().catch(undefined),
  source: z.string().min(1), feedId: z.string().min(1), category: z.string().min(1),
  language: z.string().optional(), country: z.string().optional(),
  publishedAt: date.nullable(), collectedAt: date, trend: z.string().optional(),
  editorial: z.object({
    category: z.enum(editorialCategories),
    scope: z.enum(['direct', 'adjacent']),
  }).optional(),
  feedTags: z.array(z.string().max(100)).max(12).optional(),
})
export const opportunityTypes = ['Em alta', 'Boa oportunidade de pauta', 'Assunto do momento', 'Conteúdo atemporal'] as const
export const opportunitySchema = z.object({
  type: z.enum(opportunityTypes), reason: z.string(), angle: z.string(),
  approach: z.enum(['Explicação', 'Análise crítica', 'Comparação', 'Contextualização']),
  articles: z.array(articleSchema).min(1).max(4),
})
export const snapshotSchema = z.object({
  version: z.literal(1), attemptedAt: date, collectedAt: date.nullable(),
  sources: z.array(z.object({ id: z.string(), name: z.string(), url: webUrl, count: z.number().int().nonnegative(), error: z.string().optional() })),
  items: z.array(articleSchema).max(600),
  observations: z.array(observation).max(120).optional(),
  opportunities: z.array(opportunitySchema).max(48).optional(),
})
export type Snapshot = z.infer<typeof snapshotSchema>
export type Article = z.infer<typeof articleSchema>
export type Observation = z.infer<typeof observation>
export type Opportunity = z.infer<typeof opportunitySchema>
export const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
