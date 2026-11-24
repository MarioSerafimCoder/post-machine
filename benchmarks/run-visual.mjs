import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'
import { chromium } from '@playwright/test'
import sample from '../src/features/images/fixtures/documentary-sample.json' with { type: 'json' }
import rubric from './visual-subjects.json' with { type: 'json' }

const cache = new URL('./.cache/', import.meta.url)
const ocrOnly = process.argv.includes('--ocr')
const modelMode = ocrOnly || process.argv.includes('--models')
const capture = process.argv.includes('--catalog')
const port = modelMode ? 44177 : capture ? 44178 : 44179
const origin = `http://127.0.0.1:${port}`
const rows = rubric.map(([id, cover, imageBrief, detailLabels, detail]) => {
  const story = sample.find(row => row.id.startsWith(id))
  if (!story) throw Error(`Pauta ausente: ${id}`)
  return { story, cover, detailLabels, input: { id, title: story.title, url: story.finalUrl ?? story.url, imageBrief, detail } }
})
const load = file => readFile(new URL(file, cache), 'utf8').then(JSON.parse)
const assets = await load('candidates.json')
const catalogFile = 'catalog-commercial.json'
const catalog = await load(catalogFile).catch(() => ({}))
const size = { width: 1440, height: 1000 }
await mkdir(cache, { recursive: true })
if (!modelMode) {
  for (const [name, sha] of [['old', '4721bb2'], ['a', '3884ebc']]) {
    const directory = fileURLToPath(new URL(`./.baseline/${name}/`, import.meta.url))
    if (existsSync(new URL(`./.baseline/${name}/src/features/images/automaticSearch.ts`, import.meta.url))) continue
    const archive = fileURLToPath(new URL(`${name}.tar`, cache))
    await mkdir(directory, { recursive: true })
    execFileSync('git', ['archive', '--output', archive, sha, 'src'])
    execFileSync('tar', ['-xf', archive, '-C', directory])
  }
}
const env = { ...process.env }
delete env.VITE_VISUAL_SEMANTIC
delete env.VITE_VISUAL_OCR
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env, stdio: 'inherit' })
let browser
try {
  for (let retries = 0; !await fetch(origin).then(response => response.ok, () => false); retries++) {
    if (retries === 50 || server.exitCode !== null) throw Error('O servidor de benchmark não abriu.')
    await pause(200)
  }
  browser = await chromium.launch({ args: ['--enable-precise-memory-info'] })
  const page = await browser.newPage({ viewport: size })
  await page.route('**/benchmarks/harness', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><title>Benchmark visual</title></html>' }))
  await page.goto(origin + '/benchmarks/harness')
  page.on('pageerror', error => console.error(error.message))
  await page.evaluate(async () => {
    const modulePath = '/benchmarks/visual-browser.ts'
    globalThis.benchmark = await import(modulePath)
  })
  if (capture) {
    let count = 0
    const known = await load('catalog-queries.json').catch(() => [])
    const queries = known.length ? known : await page.evaluate(async inputs => {
      return Promise.all(inputs.map(item => globalThis.benchmark.oldQueries(item)))
    }, rows.map(row => row.input))
    for (const query of new Set(queries)) {
      if (catalog[query]) continue
      const address = new URL('https://api.openverse.org/v1/images/')
      address.search = new URLSearchParams({ q: query, page: '1', page_size: '20', license_type: 'commercial', category: 'photograph' })
      const start = performance.now()
      const response = await fetch(address, { signal: AbortSignal.timeout(9000) }).catch(() => undefined)
      if (response?.status === 429) { console.log('Openverse atingiu o limite. Captura encerrada.'); break }
      catalog[query] = { status: response?.status ?? 0, ms: performance.now() - start,
        json: response?.ok ? await response.json() : undefined }
      await writeFile(new URL(catalogFile, cache), JSON.stringify(catalog))
      count++
      console.log(`Openverse ${count}: ${response?.status ?? 'indisponível'}`)
      await pause(3400)
      if (count >= 120) break
    }
  } else if (modelMode) {
    await page.route('**/benchmarks/raster/**', async route => {
      const name = new URL(route.request().url()).pathname.split('/').at(-1)
      const info = Object.values(assets).find(item => item.name === name)
      if (!info) return route.fulfill({ status: 404 })
      return route.fulfill({ path: fileURLToPath(new URL(info.name, cache)), contentType: info.mime ?? 'application/octet-stream' })
    })
    const output = {}
    for (const model of ocrOnly ? [] : ['clip', 'siglip2']) {
      await page.evaluate(name => globalThis.benchmark.startModel(name), model)
      const record = []
      for (const { story, cover, detailLabels, input } of rows) {
        const available = (story.candidates ?? []).flatMap((asset, index) => assets[asset.url]?.name ? [{ index: index + 1, name: assets[asset.url].name }] : [])
        if (!available.length) continue
        const prompts = [input.imageBrief, input.detail].filter(Boolean)
        const result = await page.evaluate(({ urls, prompts }) => globalThis.benchmark.compareModels(urls, prompts), {
          urls: available.map(c => '/benchmarks/raster/' + c.name), prompts,
        })
        const selections = prompts.map((_, column) => available[result.scores
          .map((score, index) => ({ similarity: score[column], index })).sort((a, b) => b.similarity - a.similarity)[0].index].index)
        record.push({ id: input.id, loadMs: result.loadMs, runMs: result.runMs, candidates: available.length,
          cover: !!cover.length && cover.includes(selections[0]), detail: !detailLabels.length ? null : detailLabels.includes(selections[1]), selections })
      }
      output[model] = record
      await page.evaluate(() => globalThis.benchmark.closeModel())
      await writeFile(new URL('models.json', cache), JSON.stringify(output, null, 2))
      console.log(`${model}: ${record.length} pautas processadas`)
    }
    const samples = []
    for (const [id, index, expected] of [['69f2737', 0, 'milk the moose'], ['7c449ea', 2, 'control without the faff'], ['geico', 0, 'saved christmas']]) {
      const labeledText = rows.find(row => row.input.id === id).story.candidates[index].url
      const ocr = await page.evaluate(url => globalThis.benchmark.runOcr(url), '/benchmarks/raster/' + assets[labeledText].name)
      samples.push({ id, expected, ...ocr, found: ocr.text.toLowerCase().replace(/\s+/g, ' ').includes(expected) })
    }
    await writeFile(new URL('ocr.json', cache), JSON.stringify(samples, null, 2))
    console.log(`OCR: ${samples.filter(item => item.found).length}/${samples.length} textos de referência`)
  } else {
    let row
    let calls
    const queries = new Set()
    await page.route('**/api/visual/**', async route => {
      const endpoint = new URL(route.request().url()).pathname.split('/').at(-1)
      calls[endpoint] = (calls[endpoint] ?? 0) + 1
      if (endpoint === 'page') return route.fulfill({ json: { candidates: (row.story.candidates ?? []).map(asset => ({
        ...asset, title: row.story.title, page: row.input.url, ticket: encodeURIComponent(asset.url),
        provider: row.input.id === 'geico' ? 'official' : 'original',
      })).filter(asset => asset.ticket.length <= 4200) } })
      if (endpoint === 'download') {
        const asset = assets[decodeURIComponent(route.request().postDataJSON().ticket)]
        if (!asset?.name) return route.fulfill({ status: 422, json: { error: 'image_unavailable' } })
        return route.fulfill({ path: fileURLToPath(new URL(asset.name, cache)), contentType: asset.mime ?? 'image/jpeg' })
      }
      return route.fulfill({ json: { state: 'disabled', candidates: [] } })
    })
    await page.route('https://api.openverse.org/**', route => {
      const query = new URL(route.request().url()).searchParams.get('q')
      if (query) queries.add(query)
      calls.catalog = (calls.catalog ?? 0) + 1
      const recorded = catalog[query]
      if (recorded?.json) calls.catalogRecorded = (calls.catalogRecorded ?? 0) + 1
      return route.fulfill({ json: recorded?.json ?? { page_count: 0, results: [] }, headers: { 'access-control-allow-origin': '*' } })
    })
    const report = {}
    for (const version of ['old', 'a', 'next']) {
      await page.reload()
      await page.evaluate(async () => {
        const modulePath = '/benchmarks/visual-browser.ts'
        globalThis.benchmark = await import(modulePath)
      })
      const samples = []
      for (row of rows) {
        calls = {}
        const result = await page.evaluate(({ version, input }) => globalThis.benchmark.replay(version, input), { version, input: row.input })
        const selection = result.output.map(asset => {
          const labels = asset.slide === 0 ? row.cover : row.detailLabels
          const indices = (row.story.candidates ?? []).flatMap((candidate, index) => candidate.url === asset.url ? [index + 1] : [])
          const correct = indices.length ? indices.some(index => labels.includes(index)) : null
          return { ...asset, correct }
        })
        samples.push({ id: row.input.id, slides: row.input.detail ? 2 : 1, ...result, output: selection, calls })
      }
      report[version] = samples
      await writeFile(new URL('replay.json', cache), JSON.stringify(report, null, 2))
      console.log(`${version}: ${samples.length} pautas processadas`)
    }
    await writeFile(new URL('catalog-queries.json', cache), JSON.stringify([...queries]))
  }
} finally {
  await browser?.close()
  server.kill()
}
