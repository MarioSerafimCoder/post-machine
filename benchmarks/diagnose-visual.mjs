// Real providers once; subsequent comparisons reuse identical bounded network responses.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { build } from 'esbuild'
import { Miniflare } from 'miniflare'
import { chromium } from '@playwright/test'
const dir = 'benchmarks/.cache/evolution131'
await mkdir(dir, { recursive: true })
const live = process.argv.includes('--live')
const version = process.argv.includes('--before') ? 'before' : 'after'
const root = version === 'before' ? './benchmarks/.baseline/evolution131/' : './'
const read = file => readFile(file, 'utf8').then(JSON.parse)
const hash = value => createHash('sha256').update(value).digest('hex')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const key = live ? await readFile('benchmarks/.cache/brave-key.local', 'utf8') : ''
const budget = await read(dir + '/budget.json')
if (live && (!budget.autoReloadDisabled || budget.purchasedCredit !== 0 || budget.grantedCredit < .5 || Date.now() - Date.parse(budget.checkedAt) > 86400000)) throw Error('Orçamento gratuito não confirmado hoje.')
const ledger = await read(dir + '/ledger.json').catch(() => [])
const sample = await read('benchmarks/evolution131-sample.json')
const bundled = await build({ stdin: { resolveDir: process.cwd(), contents: `export { externalFetch,externalUrl,readLimited,rasterSignature,verifiedPortfolioPage } from '${root}worker/security'; export { braveSearch } from '${root}worker/brave'; export { phraseKey } from '${root}src/features/images/visualContext'; export { documentaryAssetSchema } from '${root}src/features/images/documentaryContract'` }, bundle: true, write: false, platform: 'node', format: 'esm' })
await writeFile(dir + '/helper-' + version + '.mjs', bundled.outputFiles[0].text)
const h = await import('./.cache/evolution131/helper-' + version + '.mjs?t=' + Date.now())
const extracted = await build({ stdin: { resolveDir: process.cwd(), contents: `import {extractArticle} from '${root}worker/extract'; export default {async fetch(r){const {html,url,provider}=await r.json();return Response.json(await extractArticle(html,new URL(url),provider))}}` }, bundle: true, write: false, format: 'esm' })
const runtime = new Miniflare({ workers: [{ config: { name: 'visual-diagnostic', compatibilityDate: '2026-11-13', manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': { type: 'esm', contents: extracted.outputFiles[0].text } } } } }] })
let events = []
async function cached(kind, input, load) {
  const file = dir + '/' + hash(kind + JSON.stringify(input)) + '.json'
  let value = await read(file).catch(() => null)
  if (!value) {
    if (!live) throw Error('Uncaptured response: ' + kind + ' ' + JSON.stringify(input))
    const started = performance.now()
    try { value = { data: await load(), ms: performance.now() - started } }
    catch (error) { value = { error: error.message, ms: performance.now() - started } }
    await writeFile(file, JSON.stringify(value))
  } else await sleep(value.ms)
  events.push({ stage: kind, input, ...value })
  if (value.error) throw Error(value.error)
  return value.data
}
async function pageImages(raw) {
  const url = h.externalUrl(raw)
  if (!url) { events.push({ stage: 'origin', url: raw, reason: 'blocked_host' }); return { images: [], links: [] } }
  const capture = await cached('html', url.href, async () => {
    const { response, url: final } = await h.externalFetch(url, '', 'text/html,application/xhtml+xml', AbortSignal.timeout(4200))
    if (!response.ok || !/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(response.headers.get('content-type') ?? '') || /\b(noindex|noimageindex|none)\b/i.test(response.headers.get('x-robots-tag') ?? '')) { await response.body?.cancel(); return { blocked: true, status: response.status, url: final.href } }
    return { html: new TextDecoder().decode(await h.readLimited(response, 3000000)), url: final.href, status: response.status }
  })
  if (capture.blocked) return { images: [], links: [], blocked: true }
  const start = performance.now()
  const result = await runtime.dispatchFetch('http://bench.test/', { method: 'POST', body: JSON.stringify({ ...capture, provider: h.verifiedPortfolioPage(new URL(capture.url)) ? 'official' : 'original' }) }).then(r => r.json())
  events.push({ stage: 'extract', url: capture.url, ms: performance.now() - start, ...result })
  return result
}
function candidates(images) {
  const seen = new Set()
  const priority = { figure: 6, structured: 5, poster: 4, body: 3, social: 2, feed: 1, search: 0 }
  return images.sort((a, b) => priority[b.evidence] - priority[a.evidence]).flatMap(image => {
    const reason = !h.externalUrl(image.url) ? 'blocked_host' : seen.has(image.url) ? 'duplicate_url' : seen.size >= 24 ? 'candidate_limit' : null
    if (reason) { events.push({ stage: 'candidate_filter', image, reason }); return [] }
    seen.add(image.url)
    const parsed = h.documentaryAssetSchema.safeParse({ ...image, ticket: image.url })
    if (!parsed.success) { events.push({ stage: 'candidate_filter', image, reason: 'invalid_contract' }); return [] }
    return [parsed.data]
  })
}
async function api(route, input) {
  if (route === 'complement') return { state: 'disabled', candidates: [] }
  if (route === 'page') {
    const result = await pageImages(input.url)
    const link = result.links.map(url => h.externalUrl(url)).find(url => url && (url.hostname === new URL(input.url).hostname || h.verifiedPortfolioPage(url)))
    const related = link ? await pageImages(link.href).catch(() => ({ images: [] })) : { images: [] }
    return { state: result.blocked ? 'blocked' : 'ok', candidates: candidates([...result.images, ...related.images]) }
  }
  if (route === 'brave') {
    const lookup = await cached('brave', { kind: input.kind, query: input.query, language: input.language }, async () => {
      if (ledger.length >= budget.maxQueries || (ledger.length + 1) * .005 > budget.grantedCredit - .5) throw Error('Free query ceiling reached')
      ledger.push({ kind: input.kind, query: input.query, at: new Date().toISOString() })
      await writeFile(dir + '/ledger.json', JSON.stringify(ledger, null, 2))
      return h.braveSearch(input.kind, input.query, input.language, key, AbortSignal.timeout(4200))
    })
    const rawPages = lookup.pages.length ? lookup.pages : lookup.images.map(image => ({ url: image.page, title: image.title, description: image.description }))
    const anchors = (input.anchors ?? []).map(h.phraseKey).filter(anchor => anchor.length >= 3)
    const pages = rawPages.flatMap(page => {
      const url = h.externalUrl(page.url)
      const evidence = h.phraseKey([page.title, page.description].join(' '))
      const matches = anchors.filter(anchor => (' ' + evidence + ' ').includes(' ' + anchor + ' ')).length
      if (!url || (anchors.length && !matches)) { events.push({ stage: 'source_filter', ...page, reason: !url ? 'blocked_host' : 'missing_anchor' }); return [] }
      return [{ url, score: matches * 2 }]
    }).sort((a, b) => b.score - a.score)
    const unique = [...new Map(pages.map(page => [page.url.href, page])).values()].slice(0, 2)
    const extracts = await Promise.all(unique.map(page => pageImages(page.url.href).catch(() => ({ images: [] }))))
    return { state: lookup.state, candidates: candidates([...lookup.images, ...extracts.flatMap(result => result.images)]) }
  }
  throw Error('Unknown route')
}
async function download(url) {
  return cached('download', url, async () => {
    const allowed = h.externalUrl(url)
    if (!allowed) throw Error('blocked_host')
    const { response } = await h.externalFetch(allowed, '', 'image/png,image/jpeg,image/webp', AbortSignal.timeout(5500))
    const type = response.headers.get('content-type')?.split(';')[0]
    if (!response.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) { await response.body?.cancel(); throw Error('HTTP/MIME ' + response.status + ' ' + type) }
    const bytes = await h.readLimited(response, 10000000)
    if (!h.rasterSignature(bytes, type)) throw Error('invalid_raster')
    const file = dir + '/' + hash(url) + '.bin'
    await writeFile(file, bytes)
    return { file, contentType: type, bytes: bytes.length }
  })
}
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '44180', '--strictPort'], { stdio: 'ignore', windowsHide: true })
let browser
const results = []
try {
  for (let n = 0; !await fetch('http://127.0.0.1:44180').then(r => r.ok, () => false); n++) { if (n > 50) throw Error('Vite unavailable'); await sleep(200) }
  browser = await chromium.launch()
  for (const [index, row] of sample.entries()) {
    events = []
    const context = await browser.newContext()
    const page = await context.newPage()
    const discovered = []
    const operations = []
    await page.route('**/api/visual/**', route => {
      const job = (async () => {
        const name = new URL(route.request().url()).pathname.split('/').at(-1)
        const input = route.request().postDataJSON()
        const started = performance.now()
        try {
          if (name === 'download') {
            const file = await download(input.ticket)
            await route.fulfill({ body: await readFile(file.file), contentType: file.contentType })
          } else {
            const result = await api(name, input)
            discovered.push(...result.candidates)
            events.push({ stage: 'request', name, input, ms: performance.now() - started, state: result.state, candidates: result.candidates.length })
            await route.fulfill({ json: result })
          }
        } catch (error) {
          events.push({ stage: 'request_failure', name, input, ms: performance.now() - started, reason: error.message })
          await route.fulfill({ status: 422, json: { error: 'source_unavailable' } }).catch(() => undefined)
        }
      })()
      operations.push(job); return job
    })
    await page.route('https://api.openverse.org/**', async route => {
      try { const result = await cached('openverse', route.request().url(), async () => { const response = await fetch(route.request().url(), { signal: AbortSignal.timeout(6400), redirect: 'error' }); return { status: response.status, body: await response.text() } }); await route.fulfill({ ...result, contentType: 'application/json' }) }
      catch { await route.fulfill({ status: 503, body: '' }).catch(() => undefined) }
    })
    await page.goto('http://127.0.0.1:44180')
    const result = await page.evaluate(async ({ version, row, index }) => {
      const root = version === 'before' ? '/benchmarks/.baseline/evolution131/src/features' : '/src/features'
      const { campaignContext } = await import(/* @vite-ignore */ root + '/images/visualContext.ts')
      const { requestFor } = await import(/* @vite-ignore */ root + '/images/automaticSearch.ts')
      const { investigateVisuals } = await import(/* @vite-ignore */ root + '/images/searchOrchestrator.ts')
      await import(/* @vite-ignore */ root + '/studio/objects.ts')
      const slides = row.slides ?? [{ title: row.title, role: 'cover' }]
      const campaign = campaignContext({ title: row.title, sources: [{ url: row.url, title: row.title }], slides })
      const requests = slides.map((copy, i) => requestFor('diag-' + index + '/' + i, copy, campaign, .8)).filter(Boolean)
      const start = performance.now(), allocations = [], statuses = [], decisions = []
      await investigateVisuals(requests, { used: () => new Set(), trace: event => decisions.push(event), image: (request, image, provisional) => allocations.push({ slide: request.key, ms: performance.now() - start, url: image.object.imageCredit?.originalUrl, match: image.match, provisional }), finish: (request, status) => statuses.push({ slide: request.key, status }) }, AbortSignal.timeout(28000))
      return { totalMs: performance.now() - start, allocations, statuses, decisions, requests: requests.map(r => ({ ...r, discarded: [] })) }
    }, { version, row, index })
    await Promise.allSettled(operations)
    const evaluations = await page.evaluate(async ({ version, candidates, requests }) => {
      const root = version === 'before' ? '/benchmarks/.baseline/evolution131/src/features' : '/src/features'
      const { evaluateCandidate } = await import(/* @vite-ignore */ root + '/images/automaticSearch.ts')
      return requests.map(request => ({ slide: request.key, candidates: [...new Map(candidates.map(c => [c.url, c])).values()].map(candidate => ({ ...candidate, fit: evaluateCandidate(candidate, request) })) }))
    }, { version, candidates: discovered, requests: result.requests })
    // Omit raw HTML in the report (kept in the ignored, keyed network cache).
    const trace = events.map(event => event.stage === 'html' ? { ...event, data: event.data && { ...event.data, html: undefined } } : event)
    results.push({ index, row, ...result, evaluations, trace })
    await writeFile(dir + '/' + version + (live ? '-capture' : '-replay') + '.json', JSON.stringify(results, null, 2))
    console.log(JSON.stringify({ version, index, images: result.allocations.length, totalMs: Math.round(result.totalMs), queriesConsumed: ledger.length }))
    await context.close()
  }
} finally { await browser?.close(); await runtime.dispose(); server.kill() }
