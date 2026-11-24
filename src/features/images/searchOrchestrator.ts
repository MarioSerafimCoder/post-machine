import { documentaryResponse, documentaryPrefix, type DocumentaryAsset } from './documentaryContract'
import { type ImageCredit, licenseTerms, toCredit } from './contract'
import { automaticOriginal, fetchExternalImage, fetchOriginal, searchImages } from './openverse'
import { canonicalImage, creditKeys, documentaryId, evaluateCandidate, evaluateCatalog, prepareImage, similarImage,
  type AutomaticImage, type VisualRelevance, type VisualRequest, type VisualStatus } from './automaticSearch'
import { narrativeAssignment } from './visualAllocation'
import { refineVisualFit, useOcr, useSemantics } from './visualEnrichment'
import { readVisualMemory, rememberVisual, type RememberedVisual } from './visualMemory'
import { researchUrl } from './visualContext'

type Candidate = {
  credit: ImageCredit; document?: DocumentaryAsset; metadata?: string; illustrated?: boolean
  download: (signal: AbortSignal) => Promise<File>; remembered?: boolean
}
type Discovery = { candidates: DocumentaryAsset[]; state?: string }
const empty: Discovery = { candidates: [] }
const poolSize = 8
const maxPreparedBytes = 22_000_000
const resultsLifetime = 8 * 60_000
const negativeLifetime = 25_000
const transferGrace = 850
const pools = new Map<string, Pool>()
type Job = { controller: AbortController; users: number; task: Promise<unknown>; expires: number; abortTimer?: ReturnType<typeof setTimeout> }
type Pool = { jobs: Map<string, Job>; usedUntil: number; candidates: Map<string, Candidate>; prepared: Map<string, AutomaticImage>;
  bytes: number; options: Map<string, string[]>; braveQueries: Set<string> }

function poolFor(key: string) {
  const now = Date.now()
  for (const [key, pool] of pools) if (pool.usedUntil < now && ![...pool.jobs.values()].some(job => job.users > 0)) pools.delete(key)
  let pool = pools.get(key)
  if (!pool) {
    const idle = [...pools].find(([, item]) => ![...item.jobs.values()].some(job => job.users > 0))
    if (pools.size >= poolSize && idle) pools.delete(idle[0])
    pool = { jobs: new Map(), usedUntil: now, candidates: new Map(), prepared: new Map(), bytes: 0, options: new Map(), braveQueries: new Set() }
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

async function post(route: string, body: object, signal: AbortSignal, timeout = 4700) {
  return fetch(documentaryPrefix + '/' + route, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]), cache: 'no-store' })
}

class VisualDownloadError extends Error {
  constructor(readonly retryable: boolean) { super('Imagem indisponível na fonte.') }
}

export async function workerImage(route: 'download' | 'import', body: object, signal: AbortSignal, filename = 'Imagem da fonte') {
  const response = await post(route, body, signal, 6000)
  const mime = response.headers.get('content-type')?.split(';')[0]
  if (!response.ok || !mime || !['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    const inspect = response.status === 422 && mime === 'application/json'
    const error = inspect ? await response.json().catch(() => null) : null
    if (!inspect) await response.body?.cancel()
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
type PageQuery = { url: string; title?: string; image?: string; primary: boolean }
type BraveQuery = { kind: 'web' | 'images'; query: string; language?: string; anchors: string[] }
const originalPage: SearchProvider<PageQuery> = { name: 'source', discover: (input, signal) => lookup('page', input, signal) }
const brave: SearchProvider<BraveQuery> = { name: 'brave', discover: (input, signal) => lookup('brave', input, signal) }
let workerBlockedUntil = 0
let braveBlockedUntil = 0
async function lookup(route: 'page' | 'brave', input: object, signal: AbortSignal): Promise<Discovery> {
  if (workerBlockedUntil > Date.now() || (route === 'brave' && braveBlockedUntil > Date.now())) return empty
  const response = await post(route, input, signal)
  if (response.status === 401 || response.status === 404 || response.status === 503 || !response.headers.get('content-type')?.includes('application/json')) {
    if (response.status === 503 || response.status === 401 || response.status === 404 || response.ok) {
      workerBlockedUntil = Date.now() + negativeLifetime
    }
    await response.body?.cancel()
    return empty
  }
  if (!response.ok) {
    if (response.status === 429) {
      if (route === 'brave') braveBlockedUntil = Date.now() + 60_000
      else workerBlockedUntil = Date.now() + 60_000
    }
    await response.body?.cancel()
    return empty
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
    // A rendition can have fewer fields than the very same asset in a figure.
    // Keep the caption from the shared publication when it adds direct evidence.
    const caption = prior?.page === current?.page ? prior?.caption : undefined
    pool.candidates.set(key, current && !current.caption && caption
      ? fromDocument({ ...current, caption }) : candidate)
  }
  while (pool.candidates.size > 90) pool.candidates.delete(pool.candidates.keys().next().value!)
}

async function discover<T>(pool: Pool, provider: SearchProvider<T>, key: string, input: T, signal: AbortSignal) {
  const response = await pooled(pool, provider.name + ':' + key, signal, inner => provider.discover(input, inner),
    result => result.candidates.length ? resultsLifetime : negativeLifetime)
  collect(pool, response.candidates.map(asset => fromDocument(asset)))
}

function catalog(request: VisualRequest, pool: Pool, signal: AbortSignal, query: string) {
  const illustrated = /\b(ilustracao|illustration)\b/i.test(request.copy.visualContext?.imageType?.normalize('NFD').replace(/\p{M}/gu, '') ?? '')
  return pooled(pool, JSON.stringify(['openverse', query, illustrated, request.revision]), signal, async inner => {
    const { results } = await searchImages({ query: query.slice(0, 160), page: 1, photographs: !illustrated, illustrations: illustrated,
      license: '', commercial: true, ratio: '', source: '' }, AbortSignal.any([inner, AbortSignal.timeout(4200)]))
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

function relevance(candidate: Candidate, request: VisualRequest) {
  if (!candidate.document) return evaluateCatalog(candidate.credit, candidate.metadata ?? '', request, !!candidate.illustrated)
  const relevance = evaluateCandidate(candidate.document, request)
  return 'rejected' in relevance ? undefined : relevance
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
    const bounded = AbortSignal.any([inner, AbortSignal.timeout(6000)])
    const file = await candidate.download(bounded).catch(async cause => {
      if (!confirmed || !candidate.document || bounded.aborted ||
          !(cause instanceof TypeError || (cause instanceof VisualDownloadError && cause.retryable))) throw cause
      await pause(180, bounded)
      bounded.throwIfAborted()
      return candidate.download(bounded)
    })
    const image = await prepareImage(file, candidate.credit, bounded)
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
  }, () => 4000)
}

type Events = { image: (request: VisualRequest, image: AutomaticImage) => void; finish: (request: VisualRequest, status: VisualStatus) => void;
  used: () => ReadonlySet<string> }
export async function investigateVisuals(requests: VisualRequest[], config: Events, signal: AbortSignal) {
  if (!requests.length) return
  const campaign = requests[0].campaign
  const project = requests[0].key.split('/')[0]
  const scope = project + ':' + campaign.scope
  const pool = poolFor(scope)
  const initial = performance.now()
  const fast = AbortSignal.any([signal, AbortSignal.timeout(14_000)])
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(28_000)])
  const remaining = new Set(requests)
  const used = new Set(config.used())
  let downloads = 0
  let discovered = false
  let failed = false
  let first = true
  let sourceChecks = 0
  let braveChecks = 0
  let catalogChecks = 0
  let examinedPixels = false
  const examined = new Map<string, AutomaticImage>()
  const refinements = new Map<string, number | null>()
  const fitKey = (request: VisualRequest, candidate: Candidate) => request.key + '\0' + candidate.credit.sourceId
  let allocation = Promise.resolve()
  const emit = (request: VisualRequest, image: AutomaticImage, match: VisualRelevance['match']) => {
    if (first) {
      performance.clearMeasures('post-machine:visual:first')
      performance.measure('post-machine:visual:first', { start: initial, end: performance.now() })
      first = false
    }
    image.keys.forEach(key => used.add(key))
    remaining.delete(request)
    rememberOption(pool, request.key, image.id)
    config.image(request, { ...image, match: { ...match, fingerprint: image.fingerprint,
      fingerprintVertical: image.fingerprintVertical, fileHash: image.fileHash } })
  }

  function allocate(fallback: boolean, phase: AbortSignal) {
    allocation = allocation.then(async () => {
      const tried = new Set<string>()
      while (remaining.size && (downloads < 14 || examined.size) && !phase.aborted) {
        config.used().forEach(key => used.add(key))
        let evaluations = [...remaining].flatMap(request => [...pool.candidates.values()].flatMap(candidate => {
          const { sourceId } = candidate.credit
          const keys = creditKeys(candidate.credit)
          if (tried.has(sourceId) || keys.some(key => used.has(key) || request.discarded.has(key))) return []
          const fit = relevance(candidate, request)
          if (!fit || (!fallback && fit.match.classification !== 'confirmed')) return []
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
            const image = examined.get(candidate.credit.sourceId) ?? await preparedImage(pool, candidate, phase, match.classification === 'confirmed')
            examined.delete(candidate.credit.sourceId)
            phase.throwIfAborted()
            if (image.keys.some(key => used.has(key) || request.discarded.has(key)) || image.fingerprint &&
                (similarImage(image.fingerprint, used, image.fingerprintVertical) ||
                  similarImage(image.fingerprint, request.discarded, image.fingerprintVertical))) return
            emit(request, image, match)
            if (candidate.document && !candidate.remembered && ['original', 'official'].includes(candidate.document.provider)) {
              void rememberVisual(scope, candidate.document, candidate.credit, image.file).catch(() => undefined)
            }
          } catch { failed = true }
        }))
      }
    })
    return allocation
  }

  const sourceWork = async (source: typeof campaign.sources[number], index: number) => {
    try {
      const first = index === 0
      sourceChecks++
      await discover(pool, originalPage, source.url, { url: source.url, title: source.title || undefined,
        image: first ? campaign.sourceImage : undefined, primary: first }, fast)
      await allocate(false, fast)
    } catch { if (!fast.aborted) failed = true }
  }
  const braveWork = async (kind: BraveQuery['kind'], query: string, phase: AbortSignal) => {
    if (phase.aborted || workerBlockedUntil > Date.now() || braveBlockedUntil > Date.now() || !remaining.size) return
    const key = kind + ':' + query
    if (!pool.braveQueries.has(key) && pool.braveQueries.size >= 5) return
    pool.braveQueries.add(key)
    try {
      braveChecks++
      await discover(pool, brave, key, { kind, query,
        language: campaign.language === 'en' || campaign.language === 'pt' ? campaign.language : undefined,
        anchors: campaign.names.filter(name => name.length <= 160).slice(0, 8) }, phase)
      await allocate(false, phase)
    } catch { if (!phase.aborted) failed = true }
  }

  try {
    const memory = await pooled(pool, 'memory', fast, () => readVisualMemory(scope)).catch(() => [])
    collect(pool, memory.map(item => fromDocument({ ...item.asset, ticket: '' }, item)))
    await allocate(false, fast)
    if (remaining.size && campaign.sources.length) {
      await sourceWork(campaign.sources[0], 0)
      if (remaining.size) await Promise.all(campaign.sources.slice(1, 3).map((source, index) => sourceWork(source, index + 1)))
    }
    if (campaign.query && remaining.size && !fast.aborted) {
      const started = Date.now()
      await braveWork('web', campaign.query, fast)
      if (remaining.size && braveBlockedUntil <= Date.now() && workerBlockedUntil <= Date.now()) {
        await pause(Math.max(0, 1150 - (Date.now() - started)), fast)
        await braveWork('images', campaign.query, fast)
      }
    }
    await allocate(true, fast.aborted ? deadline : fast)
    const unresolved = [...remaining]
    const details = [...new Set([...unresolved.flatMap(request => request.copy.visualContext?.searchQueries?.slice(0, 2) ??
      (request.query && request.query !== campaign.query ? [request.query] : [])), ...campaign.extraQueries])].slice(0, 3)
    for (const query of details) {
      if (!remaining.size || deadline.aborted || !campaign.query || braveBlockedUntil > Date.now() || workerBlockedUntil > Date.now()) break
      if (performance.now() - initial < 1500) await pause(1150, deadline)
      else await pause(1050, deadline)
      await braveWork('images', query, deadline)
      await allocate(true, deadline)
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
          } catch { failed = true }
          if (!remaining.has(request) || deadline.aborted) break
        }
      }))
    }
  } catch { if (!signal.aborted) failed = true }
  if (!signal.aborted) {
    performance.clearMeasures('post-machine:visual:settled')
    performance.measure('post-machine:visual:settled', { start: initial, end: performance.now(),
      detail: { slides: requests.length, pending: remaining.size, sourceChecks, braveChecks, catalogChecks, downloadAttempts: downloads } })
    for (const request of remaining) config.finish(request, failed && !discovered ? 'error' : 'empty')
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
