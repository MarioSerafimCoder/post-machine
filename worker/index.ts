import { z } from 'zod'
import { documentaryAssetSchema, documentaryPrefix } from '../src/features/images/documentaryContract'
import { researchUrl, phraseKey, identifiesReference } from '../src/features/images/visualContext'
import { braveSearch, cleanQuery } from './brave'
import { BraveBudget, budgetConfig, budgetStatus, type BudgetBinding } from './braveBudget'
import { discoverVideos, officialChannel } from './audiovisual'
import { renderVisualPage, type BrowserBinding } from './browser'
import { extractArticle, type Extracted } from './extract'
import { automaticPublicSources, accessRequestSubject, externalFetch, externalUrl, issueTicket, publicDns, rasterSignature, readLimited, readJson, verifiedPortfolioPage, verifyTicket } from './security'

type Limiter = { limit(input: { key: string }): Promise<{ success: boolean }> }
type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> }
  VISUAL_LIMIT: Limiter
  BRAVE_LIMIT: Limiter
  VISUAL_EXTRA_LIMIT?: Limiter
  BROWSER?: BrowserBinding
  CLOUDFLARE_ACCESS_ISSUER?: string
  CLOUDFLARE_ACCESS_AUD?: string
  VISUAL_DOWNLOAD_KEY?: string
  VISUAL_EXTERNAL_HOSTS?: string
  VISUAL_OFFICIAL_HOSTS?: string
  BRAVE_SEARCH_API_KEY?: string
  BRAVE_VISUAL_ZERO_SPEND?: string
  BRAVE_ATTRIBUTION_CONFIRMED?: string
  BRAVE_BUDGET?: BudgetBinding
  BRAVE_CYCLE_START?: string
  BRAVE_CYCLE_END?: string
  BRAVE_BALANCE_CONFIRMED_AT?: string
  BRAVE_FREE_CREDIT_CENTS?: string
  BRAVE_PRIOR_USAGE_CENTS?: string
  BRAVE_PRICE_CENTS?: string
  BRAVE_AUTOMATIC_LIMIT?: string
  BRAVE_TOTAL_LIMIT?: string
  BRAVE_SAFETY_RESERVE_CENTS?: string
  BRAVE_BUDGET_OWNER_SUB?: string
  VISUAL_BROWSER_FREE?: string
  VISUAL_BROWSER_HOSTS?: string
  VISUAL_YOUTUBE_QUOTA?: string
  VISUAL_YOUTUBE_CHANNELS?: string
  YOUTUBE_API_KEY?: string
}
const commonHeaders = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }
const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers: { ...commonHeaders, ...headers } })
const pageInput = z.object({ url: z.string().max(2048), image: z.string().max(2048).optional(),
  preferredImages: z.array(z.string().max(2048).refine(value => !!researchUrl(value))).max(126).optional(),
  title: z.string().max(500).optional(), primary: z.boolean().optional() }).strict()
const queryInput = z.object({ kind: z.enum(['web', 'images']), query: z.string().trim().min(2).max(240),
  language: z.enum(['en', 'pt']).optional(), anchors: z.array(z.string().max(160)).max(8).optional(),
  purpose: z.enum(['automatic', 'manual', 'diagnostic']).optional() }).strict()
const budgetInput = z.union([
  z.object({}).strict().transform(() => ({ action: 'status' as const })),
  z.object({ action: z.literal('settings'), settings: z.object({ enabled: z.boolean().optional(),
    totalLimit: z.number().int().min(0).max(1000).optional(), automaticLimit: z.number().int().min(0).max(900).optional() }).strict()
    .refine(value => value.totalLimit === undefined || value.automaticLimit === undefined || value.automaticLimit <= value.totalLimit) }).strict(),
  z.object({ action: z.literal('confirm'), availableCents: z.number().int().min(0).max(500) }).strict(),
])
const ticketInput = z.object({ ticket: z.string().max(4200) }).strict()
const extraInput = z.object({
  renderTicket: z.string().max(4200).optional(), channelTicket: z.string().max(4200).optional(), query: z.string().trim().min(2).max(240).optional(), campaign: z.string().max(240).optional(),
  anchors: z.array(z.string().max(160)).max(8).optional(), excluded: z.array(z.string().max(160)).max(16).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
}).strict()
const urlInput = z.object({ url: z.string().max(2048) }).strict()
const routes = new Set(['page', 'brave', 'budget', 'download', 'import', 'complement', 'approve-source'])
const rasterAccept = 'image/png,image/jpeg,image/webp'

const hostsFor = (env: Env) => [env.VISUAL_EXTERNAL_HOSTS, env.VISUAL_OFFICIAL_HOSTS].filter(Boolean).join(',')
const official = (url: URL, env: Env) => verifiedPortfolioPage(url) ||
  (env.VISUAL_OFFICIAL_HOSTS ?? '').split(',').some(item => item.trim().toLowerCase() === url.hostname)
const browserEnabled = (host: string, env: Env) => env.VISUAL_BROWSER_FREE === 'confirmed' && !!env.BROWSER &&
  (env.VISUAL_BROWSER_HOSTS ?? '').split(',').some(item => item.trim().toLowerCase() === host)
const audiovisualEnabled = (env: Env) => env.VISUAL_YOUTUBE_QUOTA === 'confirmed' && !!env.YOUTUBE_API_KEY
type Extraction = { images: Extracted[]; links: string[]; blocked?: boolean; notFound?: boolean; truncated?: boolean; requiresRendering?: boolean; channelId?: string; finalUrl?: URL }
function pageFailure(cause: unknown, signal: AbortSignal) {
  if (signal.aborted) return 'timeout'
  if (cause instanceof Error && /Destination rejected|Redirect rejected/.test(cause.message)) return 'blocked'
  return cause instanceof Error && /HTML size limit/.test(cause.message) ? 'extraction' : 'connection'
}
async function pageImages(url: URL, provider: 'original' | 'official', hosts: string, signal: AbortSignal): Promise<Extraction> {
  const { response, url: final } = await externalFetch(url, hosts, 'text/html,application/xhtml+xml', signal)
  if (!response.ok || !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type') ?? '') ||
      response.headers.get('x-robots-tag')?.match(/\b(?:noindex|noimageindex|none)\b/i)) {
    await response.body?.cancel()
    return { images: [], links: [], blocked: true, notFound: [404, 410].includes(response.status) }
  }
  const limit = 3_000_000
  if (!response.body || Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel()
    throw Error('HTML size limit')
  }
  let bytes = 0
  const html = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength
      if (bytes > limit) throw Error('HTML size limit')
      controller.enqueue(chunk)
    },
  }))
  return { ...await extractArticle(html, final, provider === 'official' && final.origin !== url.origin ? 'original' : provider), finalUrl: final }
}

async function download(url: URL, hosts: string, signal: AbortSignal) {
  const { response } = await externalFetch(url, hosts, rasterAccept, signal)
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
  if (!response.ok || !rasterAccept.split(',').includes(type)) {
    await response.body?.cancel()
    return json({ error: [404, 410].includes(response.status) ? 'image_not_found' : 'image_unavailable' }, 422)
  }
  const bytes = await readLimited(response, 10_000_000)
  return rasterSignature(bytes, type) ? new Response(bytes, { headers: { ...commonHeaders, 'content-type': type } })
    : json({ error: 'invalid_image' }, 422)
}

async function candidates(images: Extracted[], person: string, env: Env, key: string, preferred = new Set<string>(), hosts = hostsFor(env)) {
  const order = { figure: 6, structured: 5, poster: 4, body: 3, social: 2, feed: 1, search: 0 }
  const seen = new Set<string>()
  const priority = (image: Extracted) => order[image.evidence] + (image.evidence !== 'feed' &&
    [...preferred].some(url => identifiesReference(image, url)) ? 10 : 0)
  const ranked = [...images].sort((a, b) => priority(b) - priority(a))
  const indicated = [...preferred].flatMap(url => ranked.find(image => identifiesReference(image, url)) ?? [])
  const discovered = ranked.flatMap(image => [image, ...preferred.size && [...preferred].some(url => identifiesReference(image, url))
    ? (image.alternateUrls ?? []).filter(url => externalUrl(url, hosts)).slice(0, 2).map(url => ({ ...image, url,
      alternateUrls: [image.url, ...image.alternateUrls ?? []].filter(other => other !== url).slice(0, 12), width: undefined, height: undefined })) : []])
  // Each reference gets its actual source rendition before extra files consume the ceiling.
  const eligible = [...indicated, ...discovered, ...ranked].filter(image => {
    if (seen.has(image.url) || !externalUrl(image.url, hosts) || !researchUrl(image.page)) return false
    seen.add(image.url)
    return true
  }).slice(0, Math.min(150, 24 + preferred.size * 3))
  return (await Promise.all(eligible.map(async image => documentaryAssetSchema.safeParse({
    ...image, alternateUrls: image.alternateUrls?.filter(url => externalUrl(url, hosts)),
    ticket: await issueTicket(image.url, person, key),
  })))).flatMap(result => result.success ? [result.data] : [])
}

export default {
  async fetch(request: Request, env: Env, context?: { waitUntil(promise: Promise<unknown>): void }) {
    const incoming = new URL(request.url)
    if (!incoming.pathname.startsWith(documentaryPrefix + '/')) return env.ASSETS.fetch(request)
    const route = incoming.pathname.slice(documentaryPrefix.length + 1)
    const person = await accessRequestSubject(request, env.CLOUDFLARE_ACCESS_ISSUER, env.CLOUDFLARE_ACCESS_AUD)
    if (!person) return json({ error: 'access_required' }, 401)
    if (!routes.has(route)) return json({ error: 'not_found' }, 404)
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' })
    if (request.headers.get('origin') !== incoming.origin ||
      !/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) return json({ error: 'invalid_origin' }, 403)
    const key = env.VISUAL_DOWNLOAD_KEY
    if (!key || key.length < 32) return json({ error: 'unconfigured' }, 503)
    const rate = await env.VISUAL_LIMIT.limit({ key: person })
    if (!rate.success) return json({ error: 'limited' }, 429, { 'retry-after': '60' })
    const grants = ['page', 'download'].includes(route) ? (request.headers.get('x-visual-source-approvals') ?? '').split(',') : []
    if (grants.length > 12 || grants.some(grant => grant.length > 1000)) return json({ error: 'invalid_input' }, 400)
    const granted = await Promise.all(grants.filter(Boolean).map(grant => verifyTicket(grant, person, key, 'source-host')))
    // Page discovery and signed downloads may use public sources automatically.
    // externalFetch still validates DNS at every redirect; downloads require a ticket.
    const hosts = [hostsFor(env), ...granted.filter(Boolean),
      ...(['page', 'download'].includes(route) ? [automaticPublicSources] : [])].filter(Boolean).join(',')
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(route === 'complement' ? 8200 : route === 'download' || route === 'import' ? 5500 : 4200)])
    try {
      // 20 slides × 6 references + 6 campaign references, each at most 2048 chars.
      // Other routes retain their smaller payload ceiling.
      const payload = await readJson(request, route === 'page' ? 280_000 : 8192)
      const braveEnabled = env.BRAVE_VISUAL_ZERO_SPEND === 'confirmed' && env.BRAVE_ATTRIBUTION_CONFIRMED === 'confirmed' && !!env.BRAVE_SEARCH_API_KEY
      if (route === 'budget') {
        const command = budgetInput.parse(payload)
        const canManage = !!env.BRAVE_BUDGET_OWNER_SUB && person === env.BRAVE_BUDGET_OWNER_SUB
        if (command.action !== 'status' && !canManage) return json({ error: 'owner_required' }, 403)
        const result = await budgetStatus(env.BRAVE_BUDGET, budgetConfig(env), command, braveEnabled)
        return json({ ...result, canManage, freeOnly: true },
          result.state === 'invalid' ? 409 : command.action !== 'status' && result.reason === 'storage' ? 503 : 200)
      }
      if (route === 'approve-source') {
        const url = researchUrl(urlInput.parse(payload).url)
        if (!url || !externalUrl(url.href, url.hostname)) return json({ error: 'invalid_destination' }, 403)
        await publicDns(url.hostname, signal)
        return json({ host: url.hostname, approval: await issueTicket(url.hostname, person, key, 'source-host') })
      }
      if (route === 'download' || route === 'import') {
        const raw = route === 'import' ? urlInput.parse(payload).url : await verifyTicket(ticketInput.parse(payload).ticket, person, key)
        const url = raw && externalUrl(raw, hosts)
        return url ? await download(url, hosts, signal) : json({ error: 'invalid_destination' }, 403)
      }
      if (route === 'complement') {
        const input = extraInput.parse(payload)
        const raw = input.renderTicket && await verifyTicket(input.renderTicket, person, key, 'render')
        const page = raw && externalUrl(raw, hosts)
        const render = page && browserEnabled(page.hostname, env)
        const verified = input.channelTicket && await verifyTicket(input.channelTicket, person, key, 'channel')
        const channelId = audiovisualEnabled(env) && input.query && (verified && /^UC[\w-]{22}$/.test(verified)
          ? verified : officialChannel(env.VISUAL_YOUTUBE_CHANNELS, input.anchors ?? []))
        if ((!render && !channelId) || !env.VISUAL_EXTRA_LIMIT) return json({ state: 'disabled', candidates: [] })
        if (!(await env.VISUAL_EXTRA_LIMIT.limit({ key: 'visual-complement' })).success) return json({ state: 'limited', candidates: [] }, 429)
        const rendering = render && env.BROWSER
          ? renderVisualPage(env.BROWSER, page, official(page, env) ? 'official' : 'original', signal) : undefined
        if (rendering) context?.waitUntil(rendering.catch(() => undefined))
        const results = await Promise.allSettled([
          rendering ?? [],
          channelId && input.query && env.YOUTUBE_API_KEY
            ? discoverVideos({ ...input, query: input.query, channelId }, env.YOUTUBE_API_KEY, signal) : { images: [], limited: false },
        ])
        const rendered = results[0].status === 'fulfilled' ? results[0].value : []
        const video = results[1].status === 'fulfilled' ? results[1].value : { images: [], limited: false }
        const found = await candidates([...rendered, ...video.images], person, env, key)
        return json({ state: video.limited ? 'limited' : 'ready', candidates: found }, video.limited && !found.length ? 429 : 200)
      }
      if (route === 'page') {
        const input = pageInput.parse(payload)
        const page = externalUrl(input.url, hosts)
        if (!page) {
          const requested = researchUrl(input.url)
          if (requested && externalUrl(requested.href, requested.hostname))
            return json({ state: 'authorization', approvalUrls: [requested.href], candidates: [] })
          return json({ error: 'invalid_destination' }, 403)
        }
        const provider = official(page, env) ? 'official' : 'original'
        const feed: Extracted[] = input.primary && input.image && externalUrl(input.image, hosts) ?
          [{ url: input.image, page: page.href, provider, evidence: 'feed', title: input.title }] : []
        let extraction: Awaited<ReturnType<typeof pageImages>>
        try { extraction = await pageImages(page, provider, hosts, signal) }
        catch (cause) {
          const state = pageFailure(cause, signal)
          return json({ candidates: await candidates(feed, person, env, key, undefined, hosts), partial: true, state,
            pages: [{ url: page.href, state, extracted: 0, eligible: 0 }] })
        }
        const link = extraction.links.map(url => externalUrl(url, hosts)).find(url => url &&
          (url.hostname === page.hostname || official(url, env)))
        const describe = (url: URL, result: Extraction) => ({ url: (result.finalUrl ?? url).href, state: result.notFound ? 'not_found' : result.blocked ? 'blocked' : result.truncated ? 'extraction' : 'ok',
          extracted: result.images.length, eligible: result.images.filter(image => externalUrl(image.url, hosts)).length })
        const pages = [describe(page, extraction)]
        let related: Extraction | undefined
        if (link && !extraction.blocked && !signal.aborted) {
          try {
            related = await pageImages(link, official(link, env) ? 'official' : provider, hosts, signal)
            pages.push(describe(link, related))
          } catch (cause) {
            pages.push({ url: link.href, state: pageFailure(cause, signal), extracted: 0, eligible: 0 })
          }
        }
        const images = [...extraction.images, ...related?.images ?? [], ...feed]
        const ready = images.some(image => !['social', 'feed'].includes(image.evidence) &&
          externalUrl(image.url, hosts) && (image.width ?? 480) >= 480 && (image.height ?? 480) >= 480)
        const finalPage = extraction.finalUrl
        const renderTicket = input.primary && !ready && !extraction.blocked && extraction.requiresRendering && finalPage &&
          browserEnabled(finalPage.hostname, env) ? await issueTicket(finalPage.href, person, key, 'render') : undefined
        const channelTicket = input.primary && audiovisualEnabled(env) && extraction.channelId &&
          await issueTicket(extraction.channelId, person, key, 'channel') || undefined
        const preferred = new Set(input.preferredImages?.flatMap(raw => researchUrl(raw)?.href ?? []) ?? [])
        const found = await candidates(images, person, env, key, preferred, hosts)
        const references = [...preferred].map(url => {
          // Presence in metadata is a real reference check, even when it is not editorial proof.
          const identified = images.find(image => !['feed', 'search'].includes(image.evidence) && identifiesReference(image, url))
          return { url, state: identified ? (externalUrl(identified.url, hosts) ?
            (found.some(image => identifiesReference(image, url)) ? 'found' : 'limited') : 'authorization') :
            extraction.truncated || related?.truncated ? 'limited' : 'missing' }
        })
        const approvalUrls = references.filter(reference => reference.state === 'authorization').map(reference => reference.url)
        return json({ state: extraction.notFound ? 'not_found' : extraction.blocked ? 'blocked' : extraction.truncated ? 'extraction' : 'ok', candidates: found, references, approvalUrls, pages, renderTicket, channelTicket,
          audiovisualAvailable: input.primary && !extraction.blocked && audiovisualEnabled(env) ? true : undefined })
      }
      const braveKey = env.BRAVE_SEARCH_API_KEY
      if (!braveEnabled || !braveKey)
        return json({ state: 'disabled', candidates: [] })
      const input = queryInput.parse(payload)
      if (cleanQuery(input.query).length < 2) return json({ error: 'invalid_query' }, 400)
      if (!(await env.BRAVE_LIMIT.limit({ key: 'brave-visual' })).success) return json({ state: 'limited', candidates: [] }, 429)
      signal.throwIfAborted()
      const config = budgetConfig(env)
      const reserved = await budgetStatus(env.BRAVE_BUDGET, config, { action: 'reserve', kind: input.kind, purpose: input.purpose ?? 'automatic' })
      if (!reserved.allowed || !reserved.lease) {
        if (reserved.state === 'busy') return json({ state: 'busy', candidates: [] }, 409)
        const limited = ['exhausted', 'limited'].includes(reserved.state)
        return json({ state: limited ? 'limited' : reserved.state === 'unavailable' ? 'unavailable' : 'disabled', candidates: [],
          ...(limited ? { reason: reserved.reason } : {}) }, limited ? 429 : 200,
          limited ? { 'retry-after': '60' } : undefined)
      }
      const lease = reserved.lease
      const dispatched = (async () => {
        let outcome: 'complete' | 'payment' | 'rate' = 'complete'
        let until: number | undefined
        try {
          const result = await braveSearch(input.kind, input.query, input.language, braveKey, signal)
          outcome = result.providerExhausted ? 'payment' : result.providerBlockUntil ? 'rate' : 'complete'
          until = result.providerBlockUntil
          return result
        } finally {
          await budgetStatus(env.BRAVE_BUDGET, config, { action: 'finish', lease, outcome, until })
        }
      })()
      context?.waitUntil(dispatched.catch(() => undefined))
      const lookup = await dispatched
      const backendImages = [...lookup.images]
      const sourcePages = lookup.pages.length ? lookup.pages : lookup.images.map(image => ({
        url: image.page, title: image.title, description: image.description,
      }))
      if (sourcePages.length) {
        const anchors = (input.anchors ?? []).map(phraseKey).filter(anchor => anchor.length >= 3)
        const pages = sourcePages.flatMap(page => {
          const url = externalUrl(page.url, hosts)
          const evidence = phraseKey([page.title, page.description].filter(Boolean).join(' '))
          const matches = anchors.filter(anchor => (' ' + evidence + ' ').includes(' ' + anchor + ' ')).length
          return url && (matches || !anchors.length) ? [{ url, score: matches * 2 + Number(official(url, env)) }] : []
        }).sort((a, b) => b.score - a.score)
        const uniquePages = [...new Map(pages.map(page => [page.url.href, page])).values()]
        const extracts = await Promise.all(uniquePages.slice(0, 2).map(({ url }) =>
          pageImages(url, official(url, env) ? 'official' : 'original', hosts, signal).catch(() => undefined)))
        backendImages.push(...extracts.flatMap(result => result?.images ?? []))
      }
      return json({ state: lookup.state, candidates: await candidates(backendImages, person, env, key) }, lookup.state === 'limited' ? 429 : 200)
    } catch (cause) {
      return cause instanceof z.ZodError || cause instanceof SyntaxError ? json({ error: 'invalid_input' }, 400) :
        json({ error: 'source_unavailable' }, signal.aborted ? 504 : 422)
    }
  },
}
export { BraveBudget }
