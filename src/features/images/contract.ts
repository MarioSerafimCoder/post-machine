import { z } from 'zod'

export const openverseOrigin = 'https://api.openverse.org'
export const originalHosts = ['upload.wikimedia.org', 'live.staticflickr.com']
export const licenses = ['pdm', 'cc0', 'by', 'by-sa', 'by-nd', 'by-nc', 'by-nc-sa', 'by-nc-nd'] as const
const names: Record<string, string> = { pdm: 'Marca de Domínio Público', cc0: 'CC0', by: 'CC BY', 'by-sa': 'CC BY-SA', 'by-nd': 'CC BY-ND', 'by-nc': 'CC BY-NC', 'by-nc-sa': 'CC BY-NC-SA', 'by-nc-nd': 'CC BY-NC-ND' }

export function safeWebUrl(input: string) {
  try {
    const url = new URL(input)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : undefined
  } catch { return undefined }
}
const link = z.string().max(3000).refine(value => !!safeWebUrl(value), 'URL inválida')
const metadataFields = {
  title: z.string().max(1000).optional(), creator: z.string().max(500).optional(), creatorUrl: link.optional(),
  originalUrl: link.optional(), sourcePage: link.optional(), source: z.string().max(100).optional(), catalogProvider: z.string().max(100).optional(),
  license: z.string().max(80).optional(), licenseVersion: z.string().max(50).optional(), licenseUrl: link.optional(),
  attribution: z.string().max(4000).optional(),
}
const openverseCredit = z.strictObject({
  schemaVersion: z.literal(1), provider: z.literal('openverse'), sourceId: z.uuid(),
  retrievedAt: z.iso.datetime(), ...metadataFields,
})
export const imageCreditSchema = z.discriminatedUnion('provider', [openverseCredit, openverseCredit.extend({
  provider: z.enum(['original', 'official', 'brave', 'audiovisual', 'imported', 'manual']),
  sourceId: z.string().regex(/^[\w:.-]{1,160}$/),
  evidence: z.string().max(500).optional(),
})])
export type ImageCredit = z.infer<typeof imageCreditSchema>
export const creditProvider = { openverse: 'Openverse', original: 'Fonte original', official: 'Fonte oficial',
  brave: 'Busca de imagens', audiovisual: 'Material audiovisual', imported: 'Link externo', manual: 'Arquivo local' }

const field = (max: number) => z.unknown().optional().transform(value => typeof value === 'string' ? value.trim().slice(0, max) || undefined : undefined)
const urlField = field(3000).transform(value => value && safeWebUrl(value) ? value : undefined)
const dimension = z.unknown().optional().transform(value => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined)
const resultSchema = z.object({
  id: z.uuid(), title: field(1000), creator: field(500), creator_url: urlField, url: urlField, foreign_landing_url: urlField,
  thumbnail: urlField, license: field(80), license_version: field(50), license_url: urlField, attribution: field(4000),
  width: dimension, height: dimension, source: field(100), provider: field(100), filetype: field(30),
  category: field(40), mature: z.boolean().optional().catch(undefined),
  tags: z.array(z.object({ name: z.string().max(160) })).max(200).optional().catch(undefined),
  description: field(1000),
})
export type ImageResult = z.infer<typeof resultSchema>
export const responseSchema = z.object({
  page_count: z.number().int().nonnegative(),
  results: z.array(z.unknown()).max(50),
}).transform(value => ({ pages: value.page_count, results: value.results.flatMap(item => {
  const parsed = resultSchema.safeParse(item)
  return parsed.success ? [parsed.data] : []
}) }))

export function toCredit(result: ImageResult): ImageCredit {
  return { schemaVersion: 1, provider: 'openverse', sourceId: result.id, retrievedAt: new Date().toISOString(),
    title: result.title, creator: result.creator, creatorUrl: result.creator_url, originalUrl: result.url,
    sourcePage: result.foreign_landing_url, source: result.source, catalogProvider: result.provider,
    license: result.license, licenseVersion: result.license_version, licenseUrl: result.license_url, attribution: result.attribution,
  }
}
export function licenseName(code?: string) { return code ? names[code] ?? code.toUpperCase() : 'Licença desconhecida' }

export function licenseTerms(credit: Pick<ImageCredit, 'license' | 'licenseUrl' | 'licenseVersion'>) {
  const slug = credit.license ?? ''
  const url = credit.licenseUrl ? safeWebUrl(credit.licenseUrl) : undefined
  const version = credit.licenseVersion
  const isCC = licenses.some(value => value === slug)
  const prefix = slug === 'pdm' ? '/publicdomain/mark/' : slug === 'cc0' ? '/publicdomain/zero/' : '/licenses/' + slug + '/'
  const valid = !!(isCC && version && /^\d\.\d$/.test(version) && url?.hostname === 'creativecommons.org' && url.pathname.startsWith(prefix + version + '/'))
  return {
    valid,
    commercial: valid ? !slug.includes('-nc') : undefined,
    attribution: valid ? slug.startsWith('by') : undefined,
    shareAlike: valid && slug.endsWith('-sa'),
    noDerivatives: valid && slug.endsWith('-nd'),
  }
}
