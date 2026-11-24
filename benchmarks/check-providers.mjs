import { mkdir, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { Miniflare } from 'miniflare'
import sample from '../src/features/images/fixtures/documentary-sample.json' with { type: 'json' }
import rubric from './visual-subjects.json' with { type: 'json' }

const outputDir = new URL('./.cache/', import.meta.url)
await mkdir(outputDir, { recursive: true })
const outputFile = new URL('provider-check.json', outputDir)
const apiKey = process.env.BRAVE_SEARCH_API_KEY

const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
  import { campaignContext, phraseKey } from './src/features/images/visualContext'
  import { evaluateCandidate, requestFor } from './src/features/images/automaticSearch'
  import { externalFetch, externalUrl, rasterSignature, readLimited } from './worker/security'
  import { extractArticle } from './worker/extract'
  export { campaignContext, phraseKey, evaluateCandidate, requestFor, externalFetch, externalUrl, rasterSignature, readLimited, extractArticle }
` }, bundle: true, write: false, format: 'esm', platform: 'node' })
const helperFile = new URL('provider-harness.mjs', outputDir)
await writeFile(helperFile, bundle.outputFiles[0].text)

const extractor = await build({ stdin: { resolveDir: process.cwd(), contents: `
  import { extractArticle } from './worker/extract'
  export default { async fetch(request) {
    const input = await request.json()
    return Response.json(await extractArticle(input.html, new URL(input.url), 'original'))
  } }
` }, bundle: true, write: false, format: 'esm' })
const helper = await import(helperFile.href + `?t=${Date.now()}`)
const runtime = new Miniflare({ workers: [{ config: {
  name: 'brave-image-check', compatibilityDate: '2026-11-13',
  manifest: { mainModule: 'index.mjs', modules: {
    'index.mjs': { type: 'esm', contents: extractor.outputFiles[0].text },
  } },
} }] })
if (process.argv.includes('--compile-only')) {
  try {
    const smoke = await runtime.dispatchFetch('http://visual-bench.test/', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com/story', html: '<html><article></article></html>' }) })
    if (!smoke.ok || !(await smoke.json()).images) throw Error('A extração HTMLRewriter não concluiu o teste local.')
  } finally { await runtime.dispose() }
  console.log('Compilação e smoke test de Brave e HTMLRewriter concluídos.')
  process.exit(0)
}
if (!apiKey || process.env.BRAVE_VISUAL_ZERO_SPEND !== 'confirmed') {
  await runtime.dispose()
  throw Error('A Brave exige chave de produção e confirmação de custo zero.')
}

const cases = [
  { id: '15f6be0:detail', brief: 'A multicolored grid of nine Ryvita crispbread boxes', role: 'content' },
  { id: '1e988a6:cover', brief: 'Original PlayStation startup screen', role: 'cover' },
  { id: '9054471:cover', brief: 'The redesigned Australian logo discussed in the article', role: 'cover' },
  { id: 'c4d64ea:cover', brief: 'A painterly still of the animated cat in Pixar Gatto trailer', role: 'cover' },
  { id: '6ea14fa:cover', brief: 'A nova marca azul, laranja e branca da Caixa', role: 'cover' },
]
const hosts = process.env.VISUAL_EXTERNAL_HOSTS ?? ''
const report = { provider: 'Brave Images', network: true, zeroSpendFlag: true, cases: [], startedAt: new Date().toISOString() }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const hostOf = value => { try { return new URL(value).hostname } catch { return undefined } }
const summarize = (candidate, request) => {
  const result = helper.evaluateCandidate(candidate, request)
  return result.rejected ? { classification: 'rejected', score: 0 } : {
    classification: result.match.classification, score: Math.round(result.score),
  }
}

async function download(candidate, signal) {
  const url = helper.externalUrl(candidate.url, hosts)
  if (!url) return { state: 'blocked_host', host: hostOf(candidate.url) }
  try {
    const { response } = await helper.externalFetch(url, hosts, 'image/png,image/jpeg,image/webp', signal)
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
    if (!response.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(type)) {
      await response.body?.cancel()
      return { state: 'unavailable', status: response.status, host: url.hostname }
    }
    const bytes = await helper.readLimited(response, 10_000_000)
    return { state: helper.rasterSignature(bytes, type) ? 'ok' : 'invalid_raster', status: response.status,
      host: url.hostname, bytes: bytes.byteLength, type }
  } catch (error) {
    return { state: signal.aborted ? 'timeout' : 'failed', host: url.hostname,
      reason: error instanceof Error ? error.message.slice(0, 120) : 'network_error' }
  }
}

async function extractSourcePage(page, request, signal) {
  const url = helper.externalUrl(page, hosts)
  if (!url) return { state: 'blocked_host', host: hostOf(page), images: [] }
  try {
    const { response, url: finalUrl } = await helper.externalFetch(url, hosts, 'text/html,application/xhtml+xml', signal)
    if (!response.ok || !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type') ?? '') ||
        /\b(?:noindex|noimageindex|none)\b/i.test(response.headers.get('x-robots-tag') ?? '')) {
      await response.body?.cancel()
      return { state: 'unavailable', status: response.status, host: finalUrl.hostname, images: [] }
    }
    const bytes = await helper.readLimited(response, 3_000_000)
    const html = new TextDecoder().decode(bytes)
    const parsed = await runtime.dispatchFetch('http://visual-bench.test/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: finalUrl.href, html }),
    }).then(response => response.json())
    const images = parsed.images.map(image => ({ ...image, sourceHost: finalUrl.hostname,
      ...summarize(image, request) })).sort((a, b) => b.score - a.score)
    return { state: images.length ? 'ok' : 'no_images', status: response.status, host: finalUrl.hostname,
      extracted: parsed.images.length, eligible: images.filter(image => image.classification !== 'rejected').length, images }
  } catch (error) {
    return { state: signal.aborted ? 'timeout' : 'failed', host: url.hostname,
      reason: error instanceof Error ? error.message.slice(0, 120) : 'network_error', images: [] }
  }
}

try {
  for (const [index, target] of cases.entries()) {
    if (index) await sleep(8_100)
    const [id] = target.id.split(':')
    const row = rubric.find(([key]) => id.startsWith(key))
    const story = sample.find(item => item.id.startsWith(row?.[0] ?? id))
    if (!row || !story) throw Error(`Caso de benchmark indisponível: ${target.id}`)
    const copy = { title: story.title, subtitle: target.role === 'content' ? target.brief : undefined,
      imageBrief: target.brief, role: target.role }
    const campaign = helper.campaignContext({ title: story.title,
      sources: [{ title: story.title, url: story.finalUrl ?? story.url }], slides: [copy] })
    const request = helper.requestFor(target.id, copy, campaign, .8)
    const query = request?.imageQueries[0] ?? `${campaign.subject} ${target.brief}`.slice(0, 240)
    const endpoint = new URL('https://api.search.brave.com/res/v1/images/search')
    endpoint.search = new URLSearchParams({ q: query, count: '12', safesearch: 'strict', spellcheck: 'false' }).toString()
    if (campaign.language === 'en' || campaign.language === 'pt') endpoint.searchParams.set('search_lang', campaign.language)
    const entry = { id: target.id, query, startedAt: new Date().toISOString() }
    report.cases.push(entry)
    try {
      const response = await fetch(endpoint, { headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
        credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(8_000) })
      entry.status = response.status
      entry.quotaRemaining = response.headers.get('x-ratelimit-remaining')
      entry.quotaReset = response.headers.get('x-ratelimit-reset')
      if (!response.ok) {
        await response.body?.cancel()
        entry.state = response.status === 402 || response.status === 429 ? 'limited' : 'unavailable'
        break
      }
      const payload = await response.json()
      const results = Array.isArray(payload.results) ? payload.results.slice(0, 12) : []
      const parsed = results.flatMap(raw => {
        if (!raw || typeof raw.url !== 'string' || typeof raw.properties?.url !== 'string') return []
        const image = { url: raw.properties.url, page: raw.url, provider: 'brave', evidence: 'search',
          title: typeof raw.title === 'string' ? raw.title.slice(0, 500) : undefined,
          description: typeof raw.description === 'string' ? raw.description.slice(0, 1000) : undefined,
          width: raw.properties.width, height: raw.properties.height }
        return [{ image, ...summarize(image, request) }]
      })
      entry.state = 'ok'
      entry.discovery = { received: results.length, malformed: results.filter(raw => !raw || typeof raw.url !== 'string').length,
        missingImageUrl: results.filter(raw => raw?.url && typeof raw.properties?.url !== 'string').length,
        imageUrls: parsed.length }
      entry.classification = { confirmed: parsed.filter(item => item.classification === 'confirmed').length,
        related: parsed.filter(item => item.classification === 'related').length,
        rejected: parsed.filter(item => item.classification === 'rejected').length }

      const extracted = []
      const sourcePages = [...new Set(parsed.slice(0, 4).map(item => item.image.page))].slice(0, 2)
      for (const page of sourcePages) extracted.push(await extractSourcePage(page, request, AbortSignal.timeout(6_000)))
      entry.sourcePages = extracted.map(page => ({ state: page.state, status: page.status, host: page.host,
        extracted: page.extracted, eligible: page.eligible, reason: page.reason }))
      const candidates = [...parsed.map(item => ({ ...item.image, classification: item.classification, score: item.score })),
        ...extracted.flatMap(page => page.images ?? [])]
        .filter(item => item.classification !== 'rejected')
        .sort((a, b) => b.score - a.score)
      const checked = new Set()
      entry.downloads = []
      for (const candidate of candidates) {
        if (checked.has(candidate.url)) continue
        checked.add(candidate.url)
        entry.downloads.push({ classification: candidate.classification, ...await download(candidate, AbortSignal.timeout(7_000)) })
        if (entry.downloads.length >= 2) break
      }
      entry.downloadsSummary = { attempted: entry.downloads.filter(item => item.state !== 'blocked_host').length,
        ok: entry.downloads.filter(item => item.state === 'ok').length,
        blockedHost: entry.downloads.filter(item => item.state === 'blocked_host').length }
      entry.elapsedMs = Math.round(Date.now() - Date.parse(entry.startedAt))
      delete entry.startedAt
    } catch (error) {
      entry.state = 'failed'
      entry.reason = error instanceof Error ? error.message.slice(0, 160) : 'network_error'
    }
  }
} finally {
  report.finishedAt = new Date().toISOString()
  await runtime.dispose()
  await writeFile(outputFile, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ cases: report.cases.length, states: Object.fromEntries(report.cases.map(item => [item.id, item.state])),
    output: 'benchmarks/.cache/provider-check.json' }))
}
