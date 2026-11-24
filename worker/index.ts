import { z } from 'zod'
import { documentaryAssetSchema, documentaryPrefix } from '../src/features/images/documentaryContract'
import { researchUrl, phraseKey } from '../src/features/images/visualContext'
import { braveSearch } from './brave'
import { discoverVideos, officialChannel } from './audiovisual'
import { renderVisualPage, type BrowserBinding } from './browser'
import { extractArticle, type Extracted } from './extract'
import { accessRequestSubject, externalFetch, externalUrl, issueTicket, rasterSignature, readLimited, readJson, verifyTicket } from './security'

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
  VISUAL_BROWSER_FREE?: string
  VISUAL_BROWSER_HOSTS?: string
  VISUAL_YOUTUBE_QUOTA?: string
  VISUAL_YOUTUBE_CHANNELS?: string
  YOUTUBE_API_KEY?: string
}
const commonHeaders = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }
const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers: { ...commonHeaders, ...headers } })
const pageInput = z.object({ url: z.string().max(2048), image: z.string().max(2048).optional(),
  title: z.string().max(500).optional(), primary: z.boolean().optional() }).strict()
const queryInput = z.object({ kind: z.enum(['web', 'images']), query: z.string().trim().min(2).max(240),
  language: z.enum(['en', 'pt']).optional(), anchors: z.array(z.string().max(160)).max(8).optional() }).strict()
const ticketInput = z.object({ ticket: z.string().max(4200) }).strict()
const extraInput = z.object({
  renderTicket: z.string().max(4200).optional(), query: z.string().trim().min(2).max(240).optional(), campaign: z.string().max(240).optional(),
  anchors: z.array(z.string().max(160)).max(8).optional(), excluded: z.array(z.string().max(160)).max(16).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
}).strict()
const urlInput = z.object({ url: z.string().max(2048) }).strict()
const routes = new Set(['page', 'brave', 'download', 'import', 'complement'])
const rasterAccept = 'image/png,image/jpeg,image/webp'

const hostsFor = (env: Env) => [env.VISUAL_EXTERNAL_HOSTS, env.VISUAL_OFFICIAL_HOSTS].filter(Boolean).join(',')
const official = (host: string, env: Env) => (env.VISUAL_OFFICIAL_HOSTS ?? '').split(',').some(item => item.trim().toLowerCase() === host)
const browserEnabled = (host: string, env: Env) => env.VISUAL_BROWSER_FREE === 'confirmed' && !!env.BROWSER &&
  (env.VISUAL_BROWSER_HOSTS ?? '').split(',').some(item => item.trim().toLowerCase() === host)
const audiovisualEnabled = (env: Env) => env.VISUAL_YOUTUBE_QUOTA === 'confirmed' && !!env.YOUTUBE_API_KEY && !!env.VISUAL_YOUTUBE_CHANNELS
type Extraction = { images: Extracted[]; links: string[]; blocked?: boolean; requiresRendering?: boolean }
async function pageImages(url: URL, provider: 'original' | 'official', hosts: string, signal: AbortSignal): Promise<Extraction> {
  const { response, url: final } = await externalFetch(url, hosts, 'text/html,application/xhtml+xml', signal)
  if (!response.ok || !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type') ?? '') ||
      response.headers.get('x-robots-tag')?.match(/\b(?:noindex|noimageindex|none)\b/i)) {
    await response.body?.cancel()
    return { images: [], links: [], blocked: true }
  }
  const html = new TextDecoder().decode(await readLimited(response, 1_800_000))
  return extractArticle(html, final, provider)
}

async function download(url: URL, hosts: string, signal: AbortSignal) {
  const { response } = await externalFetch(url, hosts, rasterAccept, signal)
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
  if (!response.ok || !rasterAccept.split(',').includes(type)) {
    await response.body?.cancel()
    return json({ error: 'image_unavailable' }, 422)
  }
  const bytes = await readLimited(response, 10_000_000)
  return rasterSignature(bytes, type) ? new Response(bytes, { headers: { ...commonHeaders, 'content-type': type } })
    : json({ error: 'invalid_image' }, 422)
}

async function candidates(images: Extracted[], person: string, env: Env, key: string) {
  const hosts = hostsFor(env)
  const order = { figure: 6, structured: 5, poster: 4, body: 3, social: 2, feed: 1, search: 0 }
  const seen = new Set<string>()
  const eligible = images.sort((a, b) => order[b.evidence] - order[a.evidence]).filter(image => {
    if (seen.has(image.url) || !externalUrl(image.url, hosts) || !researchUrl(image.page)) return false
    seen.add(image.url)
    return true
  }).slice(0, 24)
  return (await Promise.all(eligible.map(async image => documentaryAssetSchema.safeParse({
    ...image, ticket: await issueTicket(image.url, person, key),
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
    const hosts = hostsFor(env)
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(route === 'complement' ? 8200 : route === 'download' || route === 'import' ? 5500 : 4200)])
    try {
      const payload = await readJson(request, 8192)
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
        const channelId = audiovisualEnabled(env) && input.query && officialChannel(env.VISUAL_YOUTUBE_CHANNELS, input.anchors ?? [])
        if ((!render && !channelId) || !env.VISUAL_EXTRA_LIMIT) return json({ state: 'disabled', candidates: [] })
        if (!(await env.VISUAL_EXTRA_LIMIT.limit({ key: 'visual-complement' })).success) return json({ state: 'limited', candidates: [] }, 429)
        const rendering = render && env.BROWSER
          ? renderVisualPage(env.BROWSER, page, official(page.hostname, env) ? 'official' : 'original', signal) : undefined
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
        if (!page) return json({ error: 'invalid_destination' }, 403)
        const provider = official(page.hostname, env) ? 'official' : 'original'
        const feed: Extracted[] = input.primary && input.image && externalUrl(input.image, hosts) ?
          [{ url: input.image, page: page.href, provider, evidence: 'feed', title: input.title }] : []
        let extraction: Awaited<ReturnType<typeof pageImages>>
        try { extraction = await pageImages(page, provider, hosts, signal) }
        catch { return json({ candidates: await candidates(feed, person, env, key), partial: true }) }
        const link = extraction.links.map(url => externalUrl(url, hosts)).find(url => url &&
          (url.hostname === page.hostname || official(url.hostname, env)))
        const related = link && !signal.aborted ? await pageImages(link, official(link.hostname, env) ? 'official' : provider, hosts, signal)
          .catch(() => undefined) : undefined
        const images = [...extraction.images, ...related?.images ?? [], ...feed]
        const ready = images.some(image => !['social', 'feed'].includes(image.evidence) &&
          externalUrl(image.url, hosts) && (image.width ?? 480) >= 480 && (image.height ?? 480) >= 480)
        const renderTicket = input.primary && !ready && !extraction.blocked && extraction.requiresRendering && browserEnabled(page.hostname, env)
          ? await issueTicket(page.href, person, key, 'render') : undefined
        return json({ candidates: await candidates(images, person, env, key), renderTicket,
          audiovisualAvailable: input.primary && !extraction.blocked && audiovisualEnabled(env) ? true : undefined })
      }
      if (env.BRAVE_VISUAL_ZERO_SPEND !== 'confirmed' || !env.BRAVE_SEARCH_API_KEY) return json({ state: 'disabled', candidates: [] })
      const input = queryInput.parse(payload)
      if (!(await env.BRAVE_LIMIT.limit({ key: 'brave-visual' })).success) return json({ state: 'limited', candidates: [] }, 429)
      const lookup = await braveSearch(input.kind, input.query, input.language, env.BRAVE_SEARCH_API_KEY, signal)
      const backendImages = [...lookup.images]
      if (lookup.pages.length) {
        const anchors = (input.anchors ?? []).map(phraseKey).filter(anchor => anchor.length >= 3)
        const pages = lookup.pages.flatMap(page => {
          const url = externalUrl(page.url, hosts)
          const evidence = phraseKey([page.title, page.description].filter(Boolean).join(' '))
          const matches = anchors.filter(anchor => (' ' + evidence + ' ').includes(' ' + anchor + ' ')).length
          return url && (matches || !anchors.length) ? [{ url, score: matches * 2 + Number(official(url.hostname, env)) }] : []
        }).sort((a, b) => b.score - a.score)
        for (const { url } of pages.slice(0, 2)) {
          const result = await pageImages(url, official(url.hostname, env) ? 'official' : 'original', hosts, signal).catch(() => undefined)
          backendImages.push(...result?.images ?? [])
        }
      }
      return json({ state: lookup.state, candidates: await candidates(backendImages, person, env, key) }, lookup.state === 'limited' ? 429 : 200)
    } catch (cause) {
      return cause instanceof z.ZodError || cause instanceof SyntaxError ? json({ error: 'invalid_input' }, 400) :
        json({ error: 'source_unavailable' }, signal.aborted ? 504 : 422)
    }
  },
}
