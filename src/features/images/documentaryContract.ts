import { z } from 'zod'
import { researchUrl } from './visualContext'

export const documentaryAssetSchema = z.object({
  url: z.string().refine(value => !!researchUrl(value)),
  alternateUrls: z.array(z.string().refine(value => !!researchUrl(value))).max(12).optional(),
  page: z.string().refine(value => !!researchUrl(value)),
  provider: z.enum(['original', 'official', 'brave', 'audiovisual']),
  evidence: z.enum(['feed', 'social', 'structured', 'figure', 'body', 'poster', 'search']),
  title: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
  caption: z.string().max(600).optional(),
  section: z.string().max(300).optional(),
  publishedAt: z.string().max(50).optional(),
  width: z.number().int().positive().max(40000).optional(),
  height: z.number().int().positive().max(40000).optional(),
  author: z.string().max(500).optional(),
  licenseUrl: z.string().refine(value => !!researchUrl(value)).optional(),
  ticket: z.string().max(4200),
})
export type DocumentaryAsset = z.infer<typeof documentaryAssetSchema>
export const documentaryResponse = z.object({
  candidates: z.array(documentaryAssetSchema).max(32),
  renderTicket: z.string().max(4200).optional(),
  channelTicket: z.string().max(4200).optional(),
  audiovisualAvailable: z.boolean().optional(),
})
export const documentaryPrefix = '/api/visual'
