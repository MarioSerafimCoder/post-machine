import { z } from 'zod'
import { contrastFocalPoint } from '../studio/vision/signals'
import { readImage } from '../studio/images'
import type { ImageCredit } from './contract'
import type { DocumentaryAsset } from './documentaryContract'
import { needsImage, phraseKey, researchUrl, visualDigest, visualText, words, type CampaignContext, type VisualCopy } from './visualContext'

export const matchSchema = z.object({
  strategy: z.enum(['documental', 'documental-expandida', 'editorial', 'illustration']),
  classification: z.enum(['confirmed', 'related', 'support']).optional(),
  reason: z.string().max(500),
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/).optional(),
  fingerprintVertical: z.string().regex(/^[0-9a-f]{16}$/).optional(),
  fileHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
})
export type VisualMatch = z.infer<typeof matchSchema>
export const visualChoiceSchema = z.object({
  reviewRequired: z.boolean().optional(),
  mode: z.enum(['automatic', 'manual', 'locked', 'none']),
  decision: z.enum(['approved', 'rejected', 'replaced']).optional(),
  match: matchSchema.optional(),
  signature: z.string().max(1500).optional(),
  revision: z.number().int().nonnegative().optional(),
  discarded: z.array(z.string().max(260)).max(24).optional(),
})
export type VisualChoice = z.infer<typeof visualChoiceSchema>
export type VisualDecision = NonNullable<VisualChoice['decision']>
export type VisualStatus = import('./searchDiagnostics').VisualFailure | 'documental' | 'editorial' | 'illustration' | 'provisional' | 'empty' | 'error'
export type VisualRequest = {
  key: string; slideId: string; signature: string; revision: number; campaign: CampaignContext; ratio: number; copy: VisualCopy
  query?: string; imageQueries: string[]; catalogQueries: string[]; terms: string[]; neighbors: string[]; discarded: ReadonlySet<string>
}
export function prioritizedImageQueries(requests: readonly Pick<VisualRequest, 'imageQueries'>[], excluded: ReadonlySet<string> = new Set()) {
  const seen = new Set(excluded)
  const queries: string[] = []
  for (let index = 0; index < 3; index++) for (const request of requests) {
    const query = request.imageQueries[index]
    if (query && !seen.has(query)) { queries.push(query); seen.add(query) }
  }
  return queries
}
const generic = /\b(?:conceitual|conceptual|metafora|metaphor|abstrat\w*|abstract|clipart|mockup|generic\w*|icon|icone|stock photo|ai generated|gerad[ao] por ia)\b/

function queryText(value: string, limit: number) {
  return value.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function queryWithAnchor(query: string, anchor: string) {
  const normalized = phraseKey(query)
  const anchorKey = phraseKey(anchor)
  if (!anchorKey) return queryText(query, 240)
  if ((' ' + normalized + ' ').includes(' ' + anchorKey + ' ')) {
    const literal = anchor.replace(/[.*+?^$${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`(?<![\\p{L}\\p{N}])${literal}(?![\\p{L}\\p{N}])`, 'iu').exec(query)
    if (match) return queryText(`${match[0]} ${query.slice(0, match.index)} ${query.slice(match.index + match[0].length)}`, 240)
    return queryText(query, 240)
  }
  const context = queryText(anchor, 180)
  const detail = queryText(query, Math.max(40, 239 - context.length))
  return queryText(`${context} ${detail}`, 240)
}

export function requestFor(key: string, copy: VisualCopy, campaign: CampaignContext, ratio: number, revision = 0,
  neighbors: VisualCopy[] = [], discarded: string[] = [], manual = false): VisualRequest | undefined {
  if (!manual && !needsImage(copy)) return
  const detail = [copy.imageBrief, copy.visualContext?.visualIntent, copy.visualContext?.imageType, copy.subtitle, copy.title]
    .filter(Boolean).find(text => !generic.test(phraseKey(text)))
  const search = copy.visualContext?.searchQueries?.[0] || [campaign.subject !== detail ? campaign.subject : '', detail].filter(Boolean).join(' ')
  const catalog = copy.visualContext?.searchQueries?.[0] || detail || copy.body
  const anchor = campaign.campaignName || campaign.names.find(name => /\p{L}/u.test(name) && contains(phraseKey(campaign.subject), phraseKey(name))) || campaign.subject
  const imageQueries = [...new Set([
    ...copy.visualContext?.searchQueries ?? [],
    detail,
    [copy.imageBrief, copy.visualContext?.visualIntent, copy.visualContext?.imageType, copy.title].filter(Boolean).join(' '),
  ].flatMap(value => value?.trim() ? [queryWithAnchor(value, anchor)] : []))]
    .filter(query => query && phraseKey(query) !== phraseKey(campaign.query ?? '')).slice(0, 3)
  const groupTerms = words(campaign.subject)
  const terms = words([visualText(copy), ...copy.visualContext?.searchQueries ?? []].join(' '))
  const catalogQueries = [...new Set([catalog, copy.visualContext?.searchQueries?.[1]].flatMap(value => value
    ? [words(value).filter(word => !generic.test(word)).slice(0, 5).join(' ') || groupTerms.slice(0, 4).join(' ')] : []))].filter(Boolean)
  return {
    key, slideId: key.slice(key.indexOf('/') + 1), campaign, ratio, copy, revision,
    query: search ? queryText(search, 240) : undefined,
    imageQueries,
    catalogQueries,
    terms, neighbors: words(neighbors.map(visualText).join(' ')), discarded: new Set(discarded),
    signature: 'visual-a2:' + visualDigest([campaign.scope, campaign.context, visualText(copy), copy.visualContext, copy.role, neighbors.map(visualText), revision, discarded]),
  }
}

function visualFingerprint(image: ImageData, vertical = false) {
  const sample = (column: number, row: number) => {
    const x = Math.round((vertical ? row + .5 : column) / 8 * (image.width - 1))
    const y = Math.round((vertical ? column : row + .5) / 8 * (image.height - 1))
    const at = (y * image.width + x) * 4
    return .21 * image.data[at] + .72 * image.data[at + 1] + .07 * image.data[at + 2]
  }
  let hash = 0n
  let visibleEdges = 0
  for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
    const difference = sample(column, row) - sample(column + 1, row)
    hash = (hash << 1n) | (difference > 2 ? 1n : 0n)
    if (Math.abs(difference) > 8) visibleEdges++
  }
  return visibleEdges >= 9 ? hash.toString(16).padStart(16, '0') : undefined
}
function perceptualDistance(fingerprint: string, prior: string) {
  let bits = BigInt('0x' + fingerprint) ^ BigInt('0x' + prior)
  let difference = 0
  while (bits && difference <= 4) { bits &= bits - 1n; difference++ }
  return difference
}
export function similarImage(fingerprint: string, used: ReadonlySet<string>, vertical?: string) {
  for (const item of used) {
    const match = /^foto:([0-9a-f]{16})(?::([0-9a-f]{16}))?$/.exec(item)
    if (match && perceptualDistance(fingerprint, match[1]) <= 4 &&
        (!vertical || !match[2] || perceptualDistance(vertical, match[2]) <= 4)) return true
  }
  return false
}

export function canonicalImage(value: string) {
  const url = researchUrl(value)
  if (!url) return value
  url.pathname = url.pathname.replace(/(\/conversions\/[a-f0-9]{24,64})-(?:thumb|small|medium|large|xlarge)(?=\.[a-z]{3,4}$)/i, '$1')
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_.+|fbclid|gclid|width|height|w|h|resize|fit|q|quality|format)$/i.test(key)) url.searchParams.delete(key)
  }
  url.searchParams.sort()
  return url.href
}
const imageKey = (value: string) => 'url:' + canonicalImage(value)
export function creditKeys(credit: ImageCredit | undefined, match?: VisualMatch) {
  return [credit?.sourceId, credit?.originalUrl && imageKey(credit.originalUrl),
    match?.fingerprint && ['foto', match.fingerprint, match.fingerprintVertical].filter(Boolean).join(':'), match?.fileHash && 'sha:' + match.fileHash]
    .filter((value): value is string => !!value)
}

export function rememberRejectedVisual(previous?: string[], credit?: ImageCredit, match?: VisualMatch) {
  return [...new Set([...previous ?? [], ...creditKeys(credit, match)])].slice(-24)
}
export function documentaryId(asset: Pick<DocumentaryAsset, 'url'>) { return 'image:' + visualDigest(canonicalImage(asset.url)) }
const contains = (value: string, term: string) => !!term && (' ' + value + ' ').includes(' ' + term + ' ')
const count = (terms: readonly string[], text: string) => terms.filter(term => contains(text, phraseKey(term))).length
const documentaryPhrase = (value: string) => phraseKey(value).replace(/(\d) (?:percent|por cento)\b/g, '$1')
const generalMediaWords = /^(?:foto|photo|image|imagem|filme|film|video|still|frame|campaign|campanha|ad|ads|publicidade|holiday|natal|christmas|design|novo|nova|new|first|primeiro|primeira)$/
const documentaryOrigin = /\b(?:documentary|documental|photojournal\w*|reportagem|arquivo|archive|historical|historico|historic|press photo|fotografia de imprensa|on location)\b/

export type VisualRelevance = { score: number; match: Omit<VisualMatch, 'fingerprint' | 'fingerprintVertical' | 'fileHash'> }
type Evaluation = VisualRelevance | { score: 0; rejected: true; reason: string }
const rejected = (reason: string) => ({ score: 0, rejected: true, reason }) as const
export function evaluateCandidate(asset: DocumentaryAsset, request: VisualRequest, reference?: { cited: boolean; requireIntent: boolean }): Evaluation {
  const { campaign, terms, copy } = request
  const assetLabel = documentaryPhrase([asset.caption, asset.evidence === 'search' ? asset.title : undefined,
    asset.evidence === 'search' ? asset.description : undefined, decodePath(asset.url).split('/').at(-1)].filter(Boolean).join(' '))
  const local = [assetLabel, documentaryPhrase(asset.section ?? '')].filter(Boolean).join(' ')
  const text = phraseKey([asset.title, asset.description, local, decodePath(asset.page)].filter(Boolean).join(' '))
  const publication = campaign.sources[0]
  const direct = publication?.url.replace(/\/$/, '') === asset.page.replace(/\/$/, '')
  const explicitCampaign = campaign.campaignName
  if (count(campaign.excluded, local || text)) return rejected('excluded_subject')
  if ((asset.evidence === 'search' || !direct) && generic.test(local || text)) return rejected('generic_or_conceptual')
  if ((asset.width && asset.width < 480) || (asset.height && asset.height < 480)) return rejected('resolution_below_480')
  const explicitMatch = explicitCampaign ? contains(documentaryPhrase(text), documentaryPhrase(explicitCampaign)) : false
  // Quoted campaign titles in the asset caption take precedence over the title of the surrounding article.
  const caption = asset.caption ?? ''
  const otherTitle = /\b(?:campaign|campanha|film|filme|trailer|commercial|comercial)\s*[:–—-]?\s*["“«‘']([^"”»’']{4,120})["”»’']/giu
  if (explicitCampaign && !contains(documentaryPhrase(caption), documentaryPhrase(explicitCampaign)) &&
      [...caption.matchAll(otherTitle)].some(match => !contains(documentaryPhrase(match[1]), documentaryPhrase(explicitCampaign)))) return rejected('different_campaign')
  const named = count(campaign.names, text)
  const subject = count(campaign.primary, text)
  const year = typeof campaign.year === 'number' ? String(campaign.year) : undefined
  const publishedYear = asset.publishedAt?.match(/^\d{4}/)?.[0]
  if (year && publishedYear && Math.abs(Number(year) - Number(publishedYear)) > 1 && !explicitMatch) return rejected('different_year')
  const overlap = count(terms, assetLabel || text)
  const near = count(request.neighbors, local)
  const documentary = ['figure', 'structured', 'body', 'poster'].includes(asset.evidence)
  const identity = explicitCampaign ? explicitMatch : named >= 2 || subject >= Math.max(2, Math.ceil(campaign.primary.length * .53))
  const assetMatch = explicitCampaign ? contains(assetLabel, documentaryPhrase(explicitCampaign))
    : count(campaign.names, assetLabel) >= 1 || count(campaign.primary.filter(term => !generalMediaWords.test(term)), assetLabel) >= 2
  const objectTerms = words(copy.visualContext?.visualIntent || copy.imageBrief)
    .filter(term => !campaign.primary.includes(term) && !generalMediaWords.test(term))
  const confirmsObject = objectTerms.length >= 2 && count(objectTerms, local) >= 2
  if (reference?.requireIntent && !reference.cited && objectTerms.length >= 2 && !confirmsObject) return rejected('unverified_specific_object')
  const editorialPlacement = ['figure', 'poster'].includes(asset.evidence) && !!asset.caption &&
    count(terms.filter(term => !generalMediaWords.test(term)), phraseKey(asset.caption)) >= 2
  const identityWork = /\b(rebrand\w*|identidade visual|visual identity|brand identity|redesign)\b/.test(phraseKey(campaign.subject))
  const contextualPoster = identityWork && copy.role === 'cover' && asset.evidence === 'poster' && !assetMatch
  const declaredCover = !explicitCampaign && direct && copy.role === 'cover' && asset.evidence === 'structured' &&
    !!asset.width && !!asset.height && !!publication?.title && phraseKey(asset.title) === phraseKey(publication.title) &&
    (!asset.caption || assetMatch || editorialPlacement)
  const corroborated = documentary && (direct || asset.provider === 'official' || reference?.cited) && identity &&
    !contextualPoster && (assetMatch || declaredCover || !explicitCampaign && editorialPlacement || reference?.cited && confirmsObject)
  const actual = corroborated && (copy.role === 'cover' || overlap > 0 && !!local)
  const related = identity && (assetMatch || asset.evidence === 'search' && named >= 1 || !explicitCampaign && editorialPlacement)
  if (!actual && (!related || (copy.role !== 'cover' && !overlap))) return rejected(!identity ? 'subject_not_established' : 'object_not_established')
  const fit = asset.width && asset.height ? Math.min(asset.width / asset.height / request.ratio, request.ratio / (asset.width / asset.height)) : .5
  const intent = words([copy.imageBrief, copy.visualContext?.visualIntent, copy.visualContext?.imageType].filter(Boolean).join(' '))
    .filter(term => !campaign.primary.includes(term) && !request.neighbors.includes(term) && !generalMediaWords.test(term))
  const specific = count(intent, assetLabel)
  if (asset.evidence === 'search' && intent.length && !specific) return rejected('search_missing_visual_intent')
  const distinctive = copy.role === 'cover' ? 0 : intent.slice(0, 3)
    .reduce((score, term, index) => score + (term.length >= 5 && contains(assetLabel, term) ? 12 - 3 * index : 0), 0)
  const score = (actual ? 85 : 55) + Math.min(10, overlap * 3) + Math.min(4, near) + Math.min(8, named * 2) + fit * 3 +
    (asset.evidence === 'figure' ? 4 : 0) + (declaredCover ? 18 : 0) + Math.min(20, specific * (copy.role === 'cover' ? 3 : 8)) + distinctive
  return { score, match: actual ? {
    strategy: 'documental', classification: 'confirmed',
    reason: 'O material aparece no conteúdo ou nos dados estruturados de uma fonte associada à pauta.',
  } : { strategy: 'documental-expandida', classification: 'related',
    reason: 'Os metadados relacionam a imagem à pauta. Confira na fonte se ela pertence ao acontecimento.' } }
}
function decodePath(value: string) {
  try { return decodeURIComponent(new URL(value).pathname) } catch { return '' }
}

export function evaluateCatalog(credit: ImageCredit, metadata: string, request: VisualRequest, illustrated: boolean): VisualRelevance | undefined {
  const text = phraseKey(metadata)
  if (generic.test(text.replace('stock photo', '')) || count(request.campaign.excluded, text)) return
  const exact = request.campaign.sources.some(source => source.url === credit.sourcePage)
  const campaignName = request.campaign.campaignName
  const identity = !campaignName || contains(documentaryPhrase(text), documentaryPhrase(campaignName))
  if (exact && !illustrated && identity) return { score: 89, match: { strategy: 'documental', classification: 'confirmed',
    reason: 'O catálogo associa esta imagem à publicação original e informa a licença de uso.' } }
  const relevant = count(request.terms, text)
  const nameMatches = count(request.campaign.names, text)
  const anchored = request.campaign.names.some(name => words(name).length > 1 && contains(text, phraseKey(name)))
  if (!identity &&
      !request.copy.visualContext?.searchQueries?.some(query => count(words(query), text) >= Math.max(2, Math.ceil(words(query).length * .7)))) return
  if (relevant < Math.min(2, request.terms.length) && !anchored) return
  const factual = !illustrated && documentaryOrigin.test(text) && (anchored || relevant >= 2)
  return { score: (factual ? 44 : 22) + Math.min(7, relevant) + Math.min(5, nameMatches),
    match: { strategy: illustrated ? 'illustration' : factual ? 'documental-expandida' : 'editorial',
      classification: factual ? 'related' : 'support',
      reason: factual ? 'O catálogo oferece indícios de procedência para este material. Confira na fonte a cena e a data do registro.'
        : 'Imagem de apoio para o assunto do slide. A fonte pode informar a cena, a data e as condições de uso.' } }
}

export type AutomaticImage = Awaited<ReturnType<typeof prepareImage>>
export async function prepareImage(file: File, credit: ImageCredit, signal: AbortSignal) {
  const image = await readImage(file)
  try {
    signal.throwIfAborted()
    if (Math.min(image.width, image.height) < 480) throw Error('Resolução insuficiente.')
    const scale = 64 / Math.max(image.width, image.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    context?.drawImage(image.getElement(), 0, 0, canvas.width, canvas.height)
    const data = context?.getImageData(0, 0, canvas.width, canvas.height)
    const fingerprint = data && visualFingerprint(data)
    const fingerprintVertical = data && visualFingerprint(data, true)
    const bytes = await file.arrayBuffer()
    const fileHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
    const keys = creditKeys(credit, { strategy: 'editorial', reason: '', fingerprint, fingerprintVertical, fileHash })
    image.set({ imageCredit: credit, semantic: 'image', originX: 'left', originY: 'top' })
    return { file, id: credit.sourceId, name: credit.title || 'Imagem da fonte', keys, fingerprint, fingerprintVertical, fileHash, element: image.getElement(),
      object: image.toObject() as unknown as Record<string, unknown>,
      match: { strategy: 'editorial', reason: '', fingerprint, fileHash } as VisualMatch,
      focalPoint: data && contrastFocalPoint(data.data, canvas.width, canvas.height) }
  } finally { image.dispose() }
}
