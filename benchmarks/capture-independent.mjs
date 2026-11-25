import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { Miniflare } from 'miniflare'
import independent from './independent-sample.json' with { type: 'json' }
import regression from '../src/features/images/fixtures/documentary-sample.json' with { type: 'json' }

const file = new URL('./.cache/', import.meta.url)
await mkdir(file, { recursive: true })
const harness = await build({ stdin: { resolveDir: '.', contents: `
  import { extractArticle } from './worker/extract'
  import { externalUrl } from './worker/security'
  import { evaluateCandidate, requestFor } from './src/features/images/automaticSearch'
  import { campaignContext } from './src/features/images/visualContext'
  export default { async fetch(request) {
    const { url, title } = JSON.parse(request.headers.get('x-fixture'))
    const result = await extractArticle(request.body, new URL(url), 'original')
    const copy = { title: title || result.title || '', role: 'cover' }
    const campaign = campaignContext({ title: copy.title, sources: [{ url, title: copy.title }], slides: [copy] })
    const frame = requestFor('benchmark/cover', copy, campaign, .8)
    return Response.json({ title: copy.title, blocked: !!result.blocked, candidates: result.images.filter(asset => externalUrl(asset.url))
      .map(asset => ({...asset, fit: frame ? evaluateCandidate({...asset,ticket:''}, frame) : null}))
      .filter(asset => asset.fit && !asset.fit.rejected).sort((a,b) => b.fit.score-a.fit.score).slice(0,3),
      recovered: result.images.filter(asset => externalUrl(asset.url)).length })
  } }
` }, bundle: true, write: false, format: 'esm' })
const runtime = new Miniflare({ workers: [{ config: { name: 'independent-visual', compatibilityDate: '2026-11-13',
  manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': { type: 'esm', contents: harness.outputFiles[0].text } } } } }] })
const samplePath = process.argv.find(arg => arg.startsWith('--sample='))?.slice(9)
const outputName = process.argv.find(arg => arg.startsWith('--output='))?.slice(9)
const rows = samplePath ? JSON.parse(await readFile(samplePath, 'utf8')) : process.argv.includes('--regression') ? regression.filter(row => row.status === 'body_limit') : independent
async function sample(row) {
  const started = performance.now()
  try {
    const response = await fetch(row.url, { signal: AbortSignal.timeout(6500), redirect: 'follow',
      headers: { accept: 'text/html,application/xhtml+xml' } })
    const base = { ...row, finalUrl: response.url, status: response.status }
    if (!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('text/html') ||
        /\b(?:noindex|noimageindex|none)\b/i.test(response.headers.get('x-robots-tag') ?? '')) {
      await response.body?.cancel()
      return { ...base, ms: performance.now() - started }
    }
    let bytes = 0
    const stream = response.body.pipeThrough(new TransformStream({
      transform(chunk, controller) {
        bytes += chunk.byteLength
        if (bytes > 3_000_000) throw Error('body_limit')
        controller.enqueue(chunk)
      },
    }))
    const extracted = await runtime.dispatchFetch('http://visual-bench.test/', {
      method: 'POST', body: stream, duplex: 'half',
      headers: { 'x-fixture': JSON.stringify({ url: response.url, title: row.title ?? '' }).replace(/[^\x20-\x7e]/g, char =>
        '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')) },
    })
    return { ...base, ...await extracted.json(), bytes, ms: performance.now() - started }
  } catch (error) {
    return { ...row, error: error.message, ms: performance.now() - started }
  }
}
try {
  const results = []
  for (let offset = 0; offset < rows.length; offset += 3) results.push(...await Promise.all(rows.slice(offset, offset + 3).map(sample)))
  const name = outputName ?? (process.argv.includes('--regression') ? 'regression-large-pages.json' : 'independent-network.json')
  await writeFile(new URL(name, file), JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ sample: results.length, parsed: results.filter(row => row.recovered !== undefined).length,
    withEligible: results.filter(row => row.candidates?.length).length, overPreviousLimit: results.filter(row => row.bytes > 1_800_000).length }))
} finally { await runtime.dispose() }
