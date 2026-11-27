import { VisualSearchError, failureKind, type VisualFailure } from './searchDiagnostics'
import { documentaryResponse, documentaryPrefix, type DocumentaryAsset } from './documentaryContract'
import { type ImageCredit, licenseTerms, toCredit } from './contract'
import { automaticOriginal, fetchExternalImage, fetchOriginal, searchImages } from './openverse'
import { canonicalImage, creditKeys, documentaryId, evaluateCandidate, evaluateCatalog, prepareImage, similarImage,
  requestFor, type AutomaticImage, type VisualRelevance, type VisualRequest, type VisualStatus } from './automaticSearch'
import { narrativeAssignment } from './visualAllocation'
import { refineVisualFit, useOcr, useSemantics } from './visualEnrichment'
import { readVisualMemory, rememberVisual, type RememberedVisual } from './visualMemory'
import { audiovisualIntent, campaignContext, phraseKey, researchUrl, words, type CampaignContext } from './visualContext'
import { nextVisualQuery, visualQueryKey, type SearchOutcome } from './adaptiveSearch'

type Candidate = {
  credit: ImageCredit; document?: DocumentaryAsset; metadata?: string; illustrated?: boolean
  download: (signal: AbortSignal) => Promise<File>; remembered?: boolean
}
type Discovery = { approvalUrls?: string[]; candidates: DocumentaryAsset[]; state?: string; renderTicket?: string; audiovisualAvailable?: boolean; channelTicket?: string }
const empty: Discovery = { candidates: [] }
const poolSize = 8
const maxPreparedBytes = 22_000_000
const resultsLifetime = 8 * 60_000
const negativeLifetime = 25_000
const transferGrace = 850
const pools = new Map<string, Pool>()
type Job = { controller: AbortController; users: number; task: Promise<unknown>; expires: number; abortTimer?: ReturnType<typeof setTimeout> }
type Pool = { jobs: Map<string, Job>; usedUntil: number; candidates: Map<string, Candidate>; prepared: Map<string, AutomaticImage>;
  bytes: number; options: Map<string, string[]>; braveQueries: Set<string>; complement?: Discovery; downloads: Set<Promise<unknown>>; revisions: Map<string, number> }
let braveQueue = Promise.resolve()
let nextBraveAt = 0

function poolFor(key: string) {
  const now = Date.now()
  for (const [key, pool] of pools) if (pool.usedUntil < now && ![...pool.jobs.values()].some(job => job.users > 0)) pools.delete(key)
  let pool = pools.get(key)
  if (!pool) {
    const idle = [...pools].find(([, item]) => ![...item.jobs.values()].some(job => job.users > 0))
    if (pools.size >= poolSize && idle) pools.delete(idle[0])
    pool = { jobs: new Map(), usedUntil: now, candidates: new Map(), prepared: new Map(), bytes: 0, options: new Map(),
      braveQueries: new Set(), downloads: new Set(), revisions: new Map() }
  }
  pools.delete(key)
  pools.set(key, pool)
  pool.usedUntil = now + resultsLifetime
  return pool
}

function pooled<T>(pool: Pool, key: string, signal: AbortSignal, load: (signal: AbortSignal) => Promise<T>,
  ttl: (value: T) => number = () => resultsLifetime): Promise<T> {
  signal.throwIfAborted()
  let job = pool.jobs.get(key)
  if (!job || job.expires <= Date.now() || job.controller.signal.aborted) {
    const controller = new AbortController()
    const entry: Job = { controller, users: 0, expires: Infinity,
      task: Promise.resolve().then(() => load(controller.signal)).then(value => {
        entry.expires = Date.now() + ttl(value)
        return value
      }, cause => { entry.expires = Date.now() + negativeLifetime; throw cause }),
    }
    if (pool.jobs.size >= 70) {
      const oldest = [...pool.jobs].find(([, entry]) => !entry.users)
      if (oldest) { oldest[1].controller.abort(); pool.jobs.delete(oldest[0]) }
    }
    pool.jobs.set(key, entry)
    job = entry
  }
  const entry = job
  entry.users++
  clearTimeout(entry.abortTimer)
  let abort: () => void
  return new Promise<T>((resolve, reject) => {
    abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    void (entry.task as Promise<T>).then(resolve, reject)
  }).finally(() => {
    signal.removeEventListener('abort', abort)
    if (--entry.users === 0 && entry.expires === Infinity) {
      entry.abortTimer = setTimeout(() => { if (!entry.users && entry.expires === Infinity) entry.controller.abort() }, transferGrace)
    }
  })
}

const approvalStorage = 'post-machine:source-approvals'
function sourceApprovals(): [string, string][] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(approvalStorage) ?? '[]')
    return Array.isArray(saved) ? saved.filter((entry): entry is [string, string] => Array.isArray(entry) &&
      typeof entry[0] === 'string' && typeof entry[1] === 'string' && /^[\w.-]{1,1000}$/.test(entry[1])).slice(0, 12) : []
  } catch { return [] }
}

export async function approveVisualSource(url: string) {
  const response = await post('approve-source', { url }, AbortSignal.timeout(5500))
  if (!response.ok) throw Error('Não foi possível autorizar a origem.')
  const { host, approval } = await response.json()
  if (host !== researchUrl(url)?.hostname || typeof approval !== 'string' || !/^[\w.-]{1,1000}$/.test(approval))
    throw Error('A autorização da origem é inválida.')
  localStorage.setItem(approvalStorage, JSON.stringify([[host, approval], ...sourceApprovals().filter(([saved]) => saved !== host)].slice(0, 12)))
}

async function post(route: string, body: object, signal: AbortSignal, timeout = 4700) {
  const approvals = ['page', 'download'].includes(route) ? sourceApprovals() : []
  return fetch(documentaryPrefix + '/' + route, { method: 'POST', headers: { 'content-type': 'application/json',
    ...(approvals.length && { 'x-visual-source-approvals': approvals.map(([, grant]) => grant).join(',') }) },
    body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]), cache: 'no-store' })
}

class VisualDownloadError extends VisualSearchError {
  constructor(readonly retryable: boolean) { super('download') }
}

export async function workerImage(route: 'download' | 'import', body: object, signal: AbortSignal, filename = 'Imagem da fonte') {
  const response = await post(route, body, signal, 6000)
  const mime = response.headers.get('content-type')?.split(';')[0]
  if (!response.ok || !mime || !['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    if (response.ok) { await response.body?.cancel(); throw new VisualSearchError('incompatible') }
    const inspect = response.status === 422 && mime === 'application/json'
    const error = inspect ? await response.json().catch(() => null) : null
    if (!inspect) await response.body?.cancel()
    if (error?.error === 'invalid_image') throw new VisualSearchError('incompatible')
    const transient = error?.error === 'source_unavailable'
    throw new VisualDownloadError(transient || response.status === 502 || response.status === 504)
  }
  const blob = await response.blob()
  if (!blob.size || blob.size > 10_000_000) throw Error('Imagem fora do limite de download.')
  return new File([blob], filename, { type: mime })
}

export async function importVisualUrl(raw: string, signal: AbortSignal) {
  const url = researchUrl(raw.trim())
  if (!url) throw Error('Informe uma URL HTTPS pública de imagem.')
  const filename = url.pathname.split('/').at(-1)?.slice(0, 140) || 'Imagem externa'
  let file: File
  try { file = await fetchExternalImage(url.href, signal) }
  catch {
    signal.throwIfAborted()
    try { file = await workerImage('import', { url: url.href }, signal, filename) }
    catch { throw Error('O provedor não liberou o original por link direto ou a conexão falhou. Baixe na fonte e importe o arquivo.') }
  }
  const credit: ImageCredit = { schemaVersion: 1, provider: 'imported', sourceId: documentaryId({ url: url.href }),
    originalUrl: url.href, retrievedAt: new Date().toISOString(), source: url.hostname }
  return { file, credit }
}

interface SearchProvider<T> { name: string; discover(input: T, signal: AbortSignal): Promise<Discovery> }
type PageQuery = { url: string; title?: string; image?: string; primary: boolean; preferredImages?: string[] }
type BraveQuery = { kind: 'web' | 'images'; query: string; language?: string; anchors: string[] }
const originalPage: SearchProvider<PageQuery> = { name: 'source', discover: (input, signal) => lookup('page', input, signal) }
const brave: SearchProvider<BraveQuery> = { name: 'brave', discover(input, signal) {
  const job = braveQueue.then(async () => {
    await pause(Math.max(0, nextBraveAt - Date.now()), signal)
    signal.throwIfAborted()
    if (workerBlockedUntil > Date.now() || braveBlockedUntil > Date.now()) return empty
    nextBraveAt = Date.now() + 1050
    return lookup('brave', input, signal)
  })
  braveQueue = job.then(() => undefined, () => undefined)
  return job
} }
let workerBlockedUntil = 0
let braveBlockedUntil = 0
async function lookup(route: 'page' | 'brave' | 'complement', input: object, signal: AbortSignal): Promise<Discovery> {
  if (workerBlockedUntil > Date.now() || (route === 'brave' && braveBlockedUntil > Date.now())) return empty
  const response = await post(route, input, signal, route === 'complement' ? 9000 : undefined)
  if (response.status === 401 || response.status === 404 || response.status === 503 || !response.headers.get('content-type')?.includes('application/json')) {
    if (route !== 'complement' && (response.status === 503 || response.status === 401 || response.status === 404 || response.ok)) {
      workerBlockedUntil = Date.now() + negativeLifetime
    }
    await response.body?.cancel()
    return { ...empty, state: 'unavailable' }
  }
  if (!response.ok) {
    if (response.status === 429) {
      if (route === 'brave') braveBlockedUntil = Date.now() + 60_000
      else if (route === 'page') workerBlockedUntil = Date.now() + 60_000
    }
    await response.body?.cancel()
    throw new VisualSearchError(response.status === 403 ? 'blocked' : response.status === 429 ? 'limited' : response.status === 504 ? 'timeout' : 'connection')
  }
  const raw = await response.json()
  const parsed = documentaryResponse.safeParse(raw)
  if (!parsed.success) throw Error('Resposta visual incompatível.')
  if (route === 'page' && raw.state === 'disabled') workerBlockedUntil = Date.now() + negativeLifetime
  if (route === 'brave' && (raw.state === 'disabled' || raw.state === 'unavailable')) braveBlockedUntil = Date.now() + negativeLifetime
  return { ...parsed.data, state: raw.state }
}

function fromDocument(asset: DocumentaryAsset, memory?: RememberedVisual): Candidate {
  const url = asset.licenseUrl && new URL(asset.licenseUrl)
  const cc = url && url.hostname === 'creativecommons.org' &&
    /^\/(licenses\/(by(?:-(?:nc|nd|sa))*?)|publicdomain\/(zero|mark))\/(\d\.\d)\//.exec(url.pathname)
  const creator = asset.provider !== 'brave' ? asset.author : undefined
  const title = asset.provider !== 'brave' ? asset.caption || asset.title : undefined
  const license = cc ? cc[2] ?? (cc[3] === 'mark' ? 'pdm' : 'cc0') : undefined
  const credit = memory?.credit ?? { schemaVersion: 1 as const, provider: asset.evidence === 'poster' ? 'audiovisual' as const : asset.provider,
    sourceId: documentaryId(asset), retrievedAt: new Date().toISOString(), originalUrl: asset.url, sourcePage: asset.page,
    source: new URL(asset.page).hostname, title, creator, licenseUrl: asset.licenseUrl, license, licenseVersion: cc ? cc[4] : undefined,
    evidence: 'Página pública em que o material foi encontrado.',
  }
  return {
    credit, document: asset, remembered: !!memory,
    download: signal => memory ? Promise.resolve(new File([memory.blob], title || 'Imagem da fonte', { type: memory.blob.type }))
      : workerImage('download', { ticket: asset.ticket }, signal, title),
  }
}

function collect(pool: Pool, found: Candidate[]) {
  for (const candidate of found) {
    const url = candidate.credit.originalUrl
    if (!url) continue
    const key = canonicalImage(url)
    const before = pool.candidates.get(key)
    if (before?.remembered || (before?.document && (!candidate.document || candidate.document.evidence === 'search' && before.document.evidence !== 'search'))) continue
    const prior = before?.document
    const current = candidate.document
    // Keep a captioned rendition when later versions from the same page carry less evidence.
    if (prior?.caption && prior.page === current?.page && !current.caption) continue
    pool.candidates.set(key, candidate)
  }
  while (pool.candidates.size > 90) pool.candidates.delete(pool.candidates.keys().next().value!)
}

async function discover<T>(pool: Pool, provider: SearchProvider<T>, key: string, input: T, signal: AbortSignal) {
  const response = await pooled(pool, provider.name + ':' + key, signal, inner => provider.discover(input, inner),
    result => result.candidates.length ? resultsLifetime : negativeLifetime)
  collect(pool, response.candidates.map(asset => fromDocument(asset)))
  return response
}

function catalog(request: VisualRequest, pool: Pool, signal: AbortSignal, query: string) {
  const illustrated = /\b(ilustracao|illustration)\b/i.test(request.copy.visualContext?.imageType?.normalize('NFD').replace(/\p{M}/gu, '') ?? '')
  return pooled(pool, JSON.stringify(['openverse', query, illustrated, request.revision]), signal, async inner => {
    const { results } = await searchImages({ query: query.slice(0, 160), page: 1, photographs: !illustrated, illustrations: illustrated,
      license: '', commercial: true, ratio: '', source: '' }, AbortSignal.any([inner, AbortSignal.timeout(6400)]))
    const found = results.flatMap(result => {
      const credit = toCredit(result)
      const terms = licenseTerms(credit)
      if (result.category !== (illustrated ? 'illustration' : 'photograph') || result.mature || !credit.sourcePage ||
        !terms.valid || !terms.commercial || terms.noDerivatives || (terms.attribution && !credit.creator && !credit.attribution) ||
        !automaticOriginal(result) || Math.min(result.width ?? 0, result.height ?? 0) < 480) return []
      return [{ credit, illustrated, metadata: [result.title, result.description, ...result.tags?.map(tag => tag.name) ?? []].filter(Boolean).join(' '),
        download: (signal: AbortSignal) => fetchOriginal(result, signal) }]
    })
    collect(pool, found)
    return found.length
  }, count => count ? resultsLifetime : negativeLifetime)
}

function relevance(candidate: Candidate, request: VisualRequest, manual = false, onReferenceFailure?: (reason: VisualFailure) => void) {
  if (!candidate.document) {
    const metadata = candidate.metadata ?? ''
    const fit = evaluateCatalog(candidate.credit, metadata, request, !!candidate.illustrated)
    if (fit?.match.classification !== 'support') return fit
    if (request.campaign.sources.length || request.campaign.campaignName || candidate.illustrated) return
    const object = words(request.copy.visualContext?.visualIntent || request.copy.imageBrief || request.copy.title)
    const asset = ' ' + phraseKey(metadata) + ' '
    return object.length >= 2 && object.every(term => asset.includes(' ' + term + ' ')) ? fit : undefined
  }
  const asset = candidate.document
  const isCited = (hint: CampaignContext['visualCandidates'][number]) => {
    const url = researchUrl(hint.imageUrl)?.href
    return !!url && ['figure', 'structured', 'body', 'poster'].includes(asset.evidence) &&
      researchUrl(hint.sourceUrl)?.href === asset.page && (url === asset.url || !!asset.alternateUrls?.includes(url))
  }
  const slideCandidates = request.copy.visualContext?.visualCandidates
  const slideRank = slideCandidates?.findIndex(isCited) ?? -1
  const cited = slideRank >= 0 || (!slideCandidates?.length || manual) && request.campaign.visualCandidates.some(isCited)
  const fit = evaluateCandidate(asset, request, { cited, requireIntent: !manual && !!slideCandidates?.length })
  if ('rejected' in fit) {
    if (slideRank < 0 || !['unverified_specific_object', 'campaign_not_established_on_asset',
      'subject_not_established', 'object_not_established'].includes(fit.reason)) {
      if (slideRank >= 0) onReferenceFailure?.(fit.reason === 'resolution_below_480' ? 'incompatible' : 'contradiction')
      return
    }
    return { score: 80 + 64 * (6 - slideRank), match: { strategy: 'documental-expandida' as const,
      classification: 'related' as const, referenceReview: true as const,
      reason: 'O arquivo aparece na página indicada. Confira se a imagem corresponde ao conteúdo do slide.' } }
  }
  return { ...fit, score: fit.score + (slideRank >= 0 && fit.match.classification === 'confirmed' ? 64 * (6 - slideRank) : cited ? 6 : 0) }
}
function rememberOption(pool: Pool, key: string, chosen: string) {
  const prior = pool.options.get(key) ?? []
  pool.options.set(key, [chosen, ...prior.filter(item => item !== chosen)].slice(0, 8))
  if (pool.options.size > 30) pool.options.delete(pool.options.keys().next().value!)
}

function preparedImage(pool: Pool, candidate: Candidate, signal: AbortSignal, confirmed: boolean) {
  const id = candidate.credit.sourceId
  const ready = pool.prepared.get(id)
  if (ready) return Promise.resolve(ready)
  return pooled(pool, 'load:' + id, signal, async inner => {
    while (pool.downloads.size >= 3) {
      inner.throwIfAborted()
      await Promise.race(pool.downloads)
    }
    inner.throwIfAborted()
    const task = load()
    const settled = task.then(() => undefined, () => undefined)
    pool.downloads.add(settled)
    try { return await task } finally { pool.downloads.delete(settled) }

    async function load() {
      const bounded = AbortSignal.any([inner, AbortSignal.timeout(6000)])
      const file = await candidate.download(bounded).catch(async cause => {
        if (!confirmed || !candidate.document || bounded.aborted ||
            !(cause instanceof TypeError || (cause instanceof VisualDownloadError && cause.retryable))) throw cause
        await pause(180, bounded)
        bounded.throwIfAborted()
        return candidate.download(bounded)
      })
      const image = await prepareImage(file, candidate.credit, bounded).catch(cause => {
        bounded.throwIfAborted(); void cause; throw new VisualSearchError('incompatible')
      })
      const size = file.size + String(image.object.src).length * 2
      if (size <= maxPreparedBytes) {
        for (const [key, prior] of pool.prepared) {
          if (pool.bytes + size <= maxPreparedBytes) break
          pool.prepared.delete(key)
          pool.bytes -= prior.file.size + String(prior.object.src).length * 2
          pool.jobs.delete('load:' + key)
        }
        pool.prepared.set(id, image)
        pool.bytes += size
      }
      return image
    }
  }, () => 4000)
}

const scopeOf = (request: VisualRequest) => request.key.split('/')[0] + ':' + request.campaign.scope

async function localVisuals(pool: Pool, scope: string, signal: AbortSignal) {
  const memory = await pooled(pool, 'memory', signal, () => readVisualMemory(scope)).catch(() => [])
  collect(pool, memory.map(item => fromDocument({ ...item.asset, ticket: '' }, item)))
}

function searchBrave(pool: Pool, campaign: CampaignContext, kind: BraveQuery['kind'], query: string, signal: AbortSignal) {
  return discover(pool, brave, kind + ':' + phraseKey(query), { kind, query,
    language: campaign.language === 'en' || campaign.language === 'pt' ? campaign.language : undefined,
    anchors: campaign.names.filter(name => name.length <= 160).slice(0, 8) }, signal)
}

export async function visualAlternatives(request: VisualRequest, used: ReadonlySet<string>, signal: AbortSignal, query?: string) {
  const scope = scopeOf(request)
  const pool = poolFor(scope)
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(14_000)])
  const copy = query && !request.campaign.subject ? { title: query, role: 'cover' } : undefined
  const target = copy && requestFor(request.key, copy, campaignContext({ title: copy.title, slides: [copy] }), request.ratio)
  const context = target || request
  await localVisuals(pool, scope, deadline)
  const discovery = query ? await searchBrave(pool, request.campaign, 'images', query, deadline).catch(() => empty) : undefined
  const searched = new Set(discovery?.candidates.map(asset => documentaryId(asset)))
  const ranked = [...pool.candidates.values()].flatMap(candidate => {
    if (creditKeys(candidate.credit).some(key => used.has(key) || request.discarded.has(key))) return []
    const fit = relevance(candidate, context, true)
    if (!fit || fit.match.classification === 'support') return []
    return [{ candidate, ...fit, fresh: searched.has(candidate.credit.sourceId) }]
  }).sort((left, right) => Number(right.match.classification === 'confirmed') - Number(left.match.classification === 'confirmed') ||
    Number(right.fresh) - Number(left.fresh) || right.score - left.score)
  const distinct = new Set(used)
  const results: AutomaticImage[] = []
  for (let offset = 0; offset < Math.min(9, ranked.length) && results.length < 6 && !deadline.aborted; offset += 3) {
    const images = await Promise.allSettled(ranked.slice(offset, offset + 3).map(async ({ candidate, match }) => {
      const image = await preparedImage(pool, candidate, deadline, match.classification === 'confirmed')
      return { ...image, match: { ...match, fingerprint: image.fingerprint, fingerprintVertical: image.fingerprintVertical, fileHash: image.fileHash } }
    }))
    for (const result of images) {
      if (result.status !== 'fulfilled' || results.length >= 6) continue
      const image = result.value
      if (image.keys.some(key => distinct.has(key) || request.discarded.has(key)) ||
          image.fingerprint && (similarImage(image.fingerprint, distinct, image.fingerprintVertical) ||
            similarImage(image.fingerprint, request.discarded, image.fingerprintVertical))) continue
      image.keys.forEach(key => distinct.add(key))
      results.push(image)
    }
  }
  return { results, searched: discovery?.state === 'ok' || !!discovery?.candidates.length }
}

export function rememberManualVisual(request: VisualRequest, image: AutomaticImage) {
  const scope = scopeOf(request)
  const source = image.object.imageCredit as ImageCredit
  const asset = source.originalUrl && pools.get(scope)?.candidates.get(canonicalImage(source.originalUrl))?.document
  if (asset) void rememberVisual(scope, asset, source, image.file).catch(() => undefined)
}

type Events = { image: (request: VisualRequest, image: AutomaticImage, provisional: boolean) => void; finish: (request: VisualRequest, status: VisualStatus, authorization?: { page: string; url: string }[]) => void;
  used: () => ReadonlySet<string>; trace?: (event: { stage: string; ms: number; slide?: string; url?: string; reason?: string }) => void }
export async function investigateVisuals(requests: VisualRequest[], config: Events, signal: AbortSignal) {
  if (!requests.length) return
  const campaign = requests[0].campaign
  const scope = scopeOf(requests[0])
  const pool = poolFor(scope)
  const retry = requests.some(request => request.revision > (pool.revisions.get(request.key) ?? 0))
  for (const request of requests) pool.revisions.set(request.key, request.revision)
  if (retry) {
    for (const [key, job] of pool.jobs) if (!job.users && job.expires <= Date.now() + negativeLifetime) pool.jobs.delete(key)
  }
  const initial = performance.now()
  const trace = (stage: string, request?: VisualRequest, candidate?: Candidate, reason?: string) =>
    config.trace?.({ stage, ms: performance.now() - initial, slide: request?.key, url: candidate?.credit.originalUrl, reason })
  const fast = AbortSignal.any([signal, AbortSignal.timeout(14_000)])
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(28_000)])
  const remaining = new Set(requests)
  const used = new Set(config.used())
  let downloads = 0
  let discovered = false
  let failed = false
  const failures = new Set<VisualFailure>()
  const referenceFailures = new Map<string, VisualFailure>()
  const recordFailure = (cause: unknown) => { failed = true; failures.add(failureKind(cause)) }
  let first = true
  let sourceChecks = 0
  let braveChecks = 0
  let catalogChecks = 0
  let extraChecks = 0
  let examinedPixels = false
  const examined = new Map<string, AutomaticImage>()
  const failedDownloads = new WeakSet<Candidate>()
  const refinements = new Map<string, number | null>()
  const provisionalIds = new Map<string, string>()
  const provisionalKeys = new Map<string, Set<string>>()
  const fitKey = (request: VisualRequest, candidate: Candidate) => request.key + '\0' + candidate.credit.sourceId
  let allocation = Promise.resolve()
  const emit = (request: VisualRequest, image: AutomaticImage, match: VisualRelevance['match'], sourceId: string) => {
    if (first) {
      performance.clearMeasures('post-machine:visual:first')
      performance.measure('post-machine:visual:first', { start: initial, end: performance.now() })
      first = false
    }
    image.keys.forEach(key => used.add(key))
    const provisional = match.classification !== 'confirmed' && !match.referenceReview
    if (provisional) {
      provisionalIds.set(request.key, sourceId)
      provisionalKeys.set(request.key, new Set(image.keys))
    } else {
      provisionalIds.delete(request.key)
      provisionalKeys.delete(request.key)
      remaining.delete(request)
    }
    rememberOption(pool, request.key, image.id)
    config.image(request, { ...image, match: { ...match, fingerprint: image.fingerprint,
      fingerprintVertical: image.fingerprintVertical, fileHash: image.fileHash } }, provisional)
  }

  function allocate(fallback: boolean, phase: AbortSignal) {
    allocation = allocation.then(async () => {
      const tried = new Set<string>()
      while (remaining.size && (downloads < 14 || examined.size) && !phase.aborted) {
        config.used().forEach(key => used.add(key))
        let evaluations = [...remaining].flatMap(request => [...pool.candidates.values()].flatMap(candidate => {
          const { sourceId } = candidate.credit
          const keys = creditKeys(candidate.credit)
          const shown = provisionalIds.get(request.key)
          if (tried.has(sourceId) || failedDownloads.has(candidate)) return []
          if (keys.some(key => used.has(key) && shown !== sourceId || request.discarded.has(key))) {
            trace('discard', request, candidate, 'used_or_manually_discarded'); return []
          }
          const fit = relevance(candidate, request, false, reason => referenceFailures.set(request.key, reason))
          if (!fit) {
            const decision = candidate.document && evaluateCandidate(candidate.document, request)
            trace('discard', request, candidate, decision && 'rejected' in decision ? decision.reason : 'insufficient_evidence'); return []
          }
          if (!fallback && fit.match.classification !== 'confirmed' && !fit.match.referenceReview) return []
          if (shown && shown !== sourceId && fit.match.classification !== 'confirmed') return []
          if (shown === sourceId && fit.match.classification !== 'confirmed') return []
          const order = pool.options.get(request.key)?.indexOf(sourceId) ?? -1
          const adjusted = fit.match.classification === 'confirmed' ? undefined : refinements.get(fitKey(request, candidate))
          if (adjusted === null) return []
          return [{ candidate, request, ...fit, score: fit.score + (adjusted ?? 0) +
            (request.copy.role === 'cover' ? 5 : 0) + (order === 0 ? 2 : 0) }]
        })).sort((a, b) => b.score - a.score || a.candidate.credit.sourceId.localeCompare(b.candidate.credit.sourceId))
        if (fallback && !examinedPixels && (useSemantics || useOcr) && !fast.aborted) {
          const confirmed = new Set(evaluations.filter(entry => entry.match.classification === 'confirmed').map(entry => entry.candidate.credit.sourceId))
          const options = [...new Set(evaluations.flatMap(({ candidate }) => confirmed.has(candidate.credit.sourceId) ? [] : [candidate]))]
            .slice(0, Math.min(3, 14 - downloads))
          if (options.length >= (useOcr ? 1 : 2)) {
            examinedPixels = true
            const analysis = AbortSignal.any([fast, AbortSignal.timeout(3200)])
            await Promise.allSettled(options.map(async candidate => {
              downloads++
              examined.set(candidate.credit.sourceId, await preparedImage(pool, candidate, analysis, false))
            }))
            if (!analysis.aborted) {
              const refined = await refineVisualFit(evaluations, examined, analysis)
              const eligible = new Map(refined.map(entry => [fitKey(entry.request, entry.candidate), entry.score]))
              for (const entry of evaluations) {
                const key = fitKey(entry.request, entry.candidate)
                const score = eligible.get(key)
                refinements.set(key, score === undefined ? null : score - entry.score)
              }
              evaluations = refined
            }
          }
        }
        let available = 14 - downloads
        const selected = narrativeAssignment(evaluations.filter(entry => available > 0 || examined.has(entry.candidate.credit.sourceId)))
          .filter(entry => examined.has(entry.candidate.credit.sourceId) || available-- > 0).slice(0, 3)
        for (const entry of selected) tried.add(entry.candidate.credit.sourceId)
        if (!selected.length) break
        downloads += selected.filter(entry => !examined.has(entry.candidate.credit.sourceId)).length
        // The cover can arrive before other downloads. Check deduplication again when each file is ready.
        await Promise.all(selected.map(async ({ request, candidate, match }) => {
          try {
            trace('download_start', request, candidate)
            const image = examined.get(candidate.credit.sourceId) ?? await preparedImage(pool, candidate, phase, match.classification === 'confirmed')
            trace('download_ready', request, candidate)
            examined.delete(candidate.credit.sourceId)
            phase.throwIfAborted()
            const shown = provisionalIds.get(request.key) === candidate.credit.sourceId
            const shownKeys = provisionalKeys.get(request.key)
            const comparableUsed = shown && shownKeys ? new Set([...used].filter(key => !shownKeys.has(key))) : used
            if (image.keys.some(key => (used.has(key) && !(shown && shownKeys?.has(key))) || request.discarded.has(key)) || image.fingerprint &&
                (similarImage(image.fingerprint, comparableUsed, image.fingerprintVertical) ||
                  similarImage(image.fingerprint, request.discarded, image.fingerprintVertical))) {
              trace('discard', request, candidate, 'duplicate_pixels_or_manual_discard'); return
            }
            emit(request, image, match, candidate.credit.sourceId)
            trace('allocated', request, candidate, match.classification)
            if (candidate.document && !candidate.remembered && ['original', 'official'].includes(candidate.document.provider)) {
              void rememberVisual(scope, candidate.document, candidate.credit, image.file).catch(() => undefined)
            }
          } catch (cause) {
            if (!phase.aborted) failedDownloads.add(candidate)
            recordFailure(cause)
            referenceFailures.set(request.key, failureKind(cause))
            trace('download_failed', request, candidate, failureKind(cause))
          }
        }))
      }
    })
    return allocation
  }

  const hints = [...campaign.slideCandidates, ...campaign.visualCandidates]
  const blockedSlides = new Set<string>()
  const approvals = new Map<string, { page: string; url: string }[]>()
  const inspected = new Set<string>()
  const recordBlockedPage = (url: string) => {
    failures.add('blocked')
    for (const request of remaining) {
      const visual = request.copy.visualContext
      const pages = [...visual?.preferredSourceUrls ?? [], ...visual?.visualCandidates?.map(hint => hint.sourceUrl) ?? []]
      if (pages.some(page => researchUrl(page)?.href === url)) blockedSlides.add(request.key)
    }
  }
  const sourceWork = async (source: typeof campaign.sources[number]) => {
    try {
      const first = source.url === campaign.sources[0]?.url
      const limit = first && campaign.sourceImage ? 2700 : 4400
      const preferredImages: string[] = []
      let length = 0
      for (const hint of hints) {
        const image = researchUrl(hint.imageUrl)?.href
        if (!image || researchUrl(hint.sourceUrl)?.href !== source.url || preferredImages.includes(image) || length + image.length > limit) continue
        preferredImages.push(image)
        length += image.length
        if (preferredImages.length === 3) break
      }
      sourceChecks++
      const discovery = await discover(pool, originalPage, JSON.stringify([source.url, preferredImages, sourceApprovals()]), { url: source.url, title: source.title || undefined,
        image: first ? campaign.sourceImage : undefined, primary: first,
        preferredImages: preferredImages.length ? preferredImages : undefined }, fast)
      if (discovery.state === 'ok') inspected.add(source.url)
      for (const request of remaining) {
        const candidates = request.copy.visualContext?.visualCandidates ?? []
        const preferredPages = request.copy.visualContext?.preferredSourceUrls ?? []
        const citePage = candidates.some(hint => researchUrl(hint.sourceUrl)?.href === source.url) ||
          preferredPages.some(page => researchUrl(page)?.href === source.url)
        if (!citePage) continue
        for (const url of discovery.approvalUrls ?? []) {
          if (url !== source.url && !candidates.some(hint => researchUrl(hint.imageUrl)?.href === url)) continue
          approvals.set(request.key, [...approvals.get(request.key) ?? [], { page: source.url, url }])
        }
      }
      if (discovery.state === 'blocked') recordBlockedPage(source.url)
      if (discovery.state === 'unavailable') failures.add('connection')
      if (first) pool.complement = discovery
    } catch (cause) {
      if (!signal.aborted) {
        if (failureKind(cause) === 'blocked') recordBlockedPage(source.url)
        else recordFailure(cause)
      }
    }
  }
  const braveWork = async (kind: BraveQuery['kind'], query: string, phase: AbortSignal) => {
    if (phase.aborted || workerBlockedUntil > Date.now() || braveBlockedUntil > Date.now() || !remaining.size) return
    const key = visualQueryKey(kind, query)
    if (!pool.braveQueries.has(key) && pool.braveQueries.size >= 5) { failures.add('limited'); return }
    pool.braveQueries.add(key)
    try {
      braveChecks++
      const result = await searchBrave(pool, campaign, kind, query, phase)
      if (result.state === 'limited') failures.add('limited')
      if (result.state === 'unavailable') failures.add('connection')
      await allocate(false, phase)
      return { kind, query, cause: result.state === 'blocked' ? 'blocked' :
        failures.has('download') ? 'download' : result.candidates.length ? 'unusable' : 'empty' } as SearchOutcome
    } catch (cause) { if (!signal.aborted) recordFailure(cause) }
  }

  try {
    await localVisuals(pool, scope, fast)
    const activeHintPages = new Set(requests.flatMap(request =>
      request.copy.visualContext?.visualCandidates?.map(hint => hint.sourceUrl) ?? []))
    const hinted = [
      ...campaign.slideCandidates.filter(hint => activeHintPages.has(hint.sourceUrl)).map(hint => hint.sourceUrl),
      ...[...remaining].flatMap(request => request.copy.visualContext?.preferredSourceUrls ?? []),
      ...campaign.visualCandidates.map(hint => hint.sourceUrl),
    ].flatMap(raw => {
      const url = researchUrl(raw)?.href
      return url ? [{ url, title: '' }] : []
    })
    const indicatedPages = [...new Map(hinted.map(source => [source.url, source])).values()]
    const firstPages = indicatedPages.slice(0, Math.max(2, Math.min(5, activeHintPages.size)))
    if (remaining.size && firstPages.length) await Promise.all(firstPages.map(source => sourceWork(
      campaign.sources.find(item => item.url === source.url) ?? source)))
    await allocate(false, fast)
    if (remaining.size && campaign.sources.length) {
      const sources = campaign.sources.filter(source => !firstPages.some(page => page.url === source.url)).slice(0, Math.min(3, 5 - firstPages.length))
      if (sources.length) {
        await sourceWork(sources[0])
        await allocate(false, fast)
      }
      if (remaining.size) {
        await Promise.all(sources.slice(1).map(sourceWork))
        await allocate(false, fast)
      }
    }
    await allocate(true, fast.aborted ? deadline : fast)
    const queried = new Set<string>()
    let outcome: SearchOutcome | undefined
    for (let attempt = 0; attempt < 5; attempt++) {
      const pending = [...remaining].sort((a, b) => Number(provisionalIds.has(a.key)) - Number(provisionalIds.has(b.key)))
      const next = nextVisualQuery(pending, queried, outcome)
      if (!next || !remaining.size || deadline.aborted || braveBlockedUntil > Date.now() || workerBlockedUntil > Date.now()) break
      queried.add(visualQueryKey(next.kind, next.query))
      // The provider queue already enforces spacing; a second sleep wasted time.
      const previousOutcome = outcome
      outcome = await braveWork(next.kind, next.query, deadline)
      await allocate(true, deadline)
      // Two channels with candidates but no eligible object need better editorial
      // evidence, not another equivalent headline. Proceed to licensed photographs.
      if (next.kind === 'web' && previousOutcome?.cause === 'unusable' && outcome?.cause === 'unusable' &&
          ![...remaining].some(request => [...pool.candidates.values()].some(candidate => relevance(candidate, request)))) break
    }
    // Openverse is shared support. Duplicate queries share one response and all results enter the same pool.
    const targets = [...remaining].slice(0, 5)
    for (let index = 0; remaining.size && index < targets.length && !deadline.aborted; index += 2) {
      await Promise.all(targets.slice(index, index + 2).filter(target => remaining.has(target)).map(async request => {
        for (const query of request.catalogQueries) {
          try {
            catalogChecks++
            await catalog(request, pool, deadline, query)
            discovered = true
            await allocate(true, deadline)
          } catch (cause) { recordFailure(cause) }
          if (!remaining.has(request) || deadline.aborted) break
        }
      }))
    }
    const extra = pool.complement
    const videoSlide = [...remaining].find(request => audiovisualIntent(request.copy, campaign.subject))
    const videoQuery = extra?.audiovisualAvailable && videoSlide
      ? campaign.campaignName ? campaign.query : videoSlide.query ?? campaign.query : undefined
    if (remaining.size && !deadline.aborted && performance.now() - initial < 24_000 &&
        (extra?.renderTicket || videoQuery) && extra) {
      try {
        const provider: SearchProvider<object> = { name: 'complement', discover: (input, phase) => lookup('complement', input, phase) }
        const anchors = campaign.names.filter(name => name.length <= 160).slice(0, 8)
        extraChecks++
        await discover(pool, provider, campaign.scope, {
          renderTicket: extra.renderTicket, query: videoQuery,
          channelTicket: videoQuery ? extra.channelTicket : undefined,
          campaign: campaign.campaignName, anchors, excluded: campaign.excluded.filter(name => name.length <= 160).slice(0, 16),
          year: /^\d{4}$/.test(String(campaign.year)) ? String(campaign.year) : undefined,
        }, deadline)
        await allocate(true, deadline)
      } catch { if (!deadline.aborted) failed = true }
    }
  } catch { if (!signal.aborted) failed = true }
  await allocate(true, deadline)
  if (!signal.aborted) {
    performance.clearMeasures('post-machine:visual:settled')
    performance.measure('post-machine:visual:settled', { start: initial, end: performance.now(),
      detail: { slides: requests.length, pending: remaining.size, sourceChecks, braveChecks, catalogChecks, extraChecks, downloadAttempts: downloads } })
    for (const request of remaining) {
      const authorization = approvals.get(request.key)
      const missing = request.copy.visualContext?.visualCandidates?.some(hint =>
        inspected.has(researchUrl(hint.sourceUrl)?.href ?? ''))
      const status = authorization?.length ? 'blocked' : referenceFailures.get(request.key) ??
        (blockedSlides.has(request.key) ? 'blocked' : missing ? 'reference_missing' : deadline.aborted ? 'timeout' :
          [...failures][0] ?? (pool.candidates.size ? 'insufficient' : failed && !discovered ? 'connection' : 'empty'))
      config.finish(request, status, authorization)
    }
  }
}

function pause(ms: number, signal: AbortSignal) {
  if (!ms || signal.aborted) return Promise.resolve()
  return new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', finish, { once: true })
  })
}
