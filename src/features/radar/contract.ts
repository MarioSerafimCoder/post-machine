import { z } from 'zod'
import { editorialCategories } from './categories.ts'

const date = z.iso.datetime()
export const webUrl = z.url().refine(value => {
  const url = new URL(value)
  return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
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
  source: z.string().min(1), feedId: z.string().min(1), category: z.string().min(1),
  language: z.string().optional(), country: z.string().optional(),
  publishedAt: date.nullable(), collectedAt: date, trend: z.string().optional(),
  editorial: z.object({
    category: z.enum(editorialCategories),
    scope: z.enum(['direct', 'adjacent']),
  }).optional(),
  feedTags: z.array(z.string().max(100)).max(12).optional(),
})
export const snapshotSchema = z.object({
  version: z.literal(1), attemptedAt: date, collectedAt: date.nullable(),
  sources: z.array(z.object({ id: z.string(), name: z.string(), url: webUrl, count: z.number().int().nonnegative(), error: z.string().optional() })),
  items: z.array(articleSchema).max(600),
})
export type Snapshot = z.infer<typeof snapshotSchema>
export type Article = z.infer<typeof articleSchema>
export const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
