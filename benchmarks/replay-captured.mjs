import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { chromium } from '@playwright/test'
const prefix = process.argv.find(arg => arg.startsWith('--prefix='))?.slice(9) ?? 'evolution13'
const cache = new URL('./.cache/', import.meta.url)
const rows = JSON.parse(await readFile(new URL(prefix + '-network.json', cache)))
const reviewed = JSON.parse(await readFile(new URL(prefix + '-selection.json', cache)))
const baseline = new URL('./.baseline/evolution13/', import.meta.url)
await mkdir(baseline, { recursive: true })
if (!existsSync(new URL('src/features/images/searchOrchestrator.ts', baseline))) {
  const archive = new URL('evolution13-baseline.tar', cache)
  execFileSync('git', ['archive', '--output', archive.pathname.replace(/^\/(.:)/, '$1'), 'HEAD', 'src'])
  execFileSync('tar', ['-xf', archive.pathname.replace(/^\/(.:)/, '$1'), '-C', baseline.pathname.replace(/^\/(.:)/, '$1')])
}
const rasters = new Map()
for (const selected of reviewed.filter(item => item.url)) {
  const response = await fetch(selected.url, { redirect: 'error', signal: AbortSignal.timeout(6000) })
  if (response.ok) rasters.set(selected.url, { body: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') })
}
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '44180', '--strictPort'], { stdio: 'ignore' })
let browser
try {
  const origin = 'http://127.0.0.1:44180'
  for (let n = 0; !await fetch(origin).then(r => r.ok, () => false); n++) {
    if (n > 50) throw Error('Servidor indisponível')
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  browser = await chromium.launch()
  const results = []
  for (const version of ['before', 'after']) for (const [index, row] of rows.entries()) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    let queries = 0
    const selected = reviewed.find(item => item.index === index)
    const candidates = (row.candidates ?? []).filter(candidate => candidate.url === selected?.url && rasters.has(candidate.url))
      .map(candidate => ({ ...candidate, ticket: candidate.url }))
    await page.route('**/api/visual/page', async route => {
      await new Promise(resolve => setTimeout(resolve, Math.min(4400, row.ms ?? 0)))
      await route.fulfill({ json: { candidates } }).catch(() => undefined)
    })
    await page.route('**/api/visual/brave', route => { queries++; return route.fulfill({ json: { state: 'disabled', candidates: [] } }) })
    await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { results: [], page_count: 0 } }))
    await page.route('**/api/visual/download', route => {
      const file = rasters.get(route.request().postDataJSON().ticket)
      return file ? route.fulfill(file) : route.fulfill({ status: 422, json: { error: 'source_unavailable' } })
    })
    await page.goto(origin)
    const result = await page.evaluate(async ({ version, row, index }) => {
      const root = version === 'before' ? '/benchmarks/.baseline/evolution13/src/features' : '/src/features'
      const { campaignContext } = await import(/* @vite-ignore */ root + '/images/visualContext.ts')
      const { requestFor } = await import(/* @vite-ignore */ root + '/images/automaticSearch.ts')
      const { investigateVisuals } = await import(/* @vite-ignore */ root + '/images/searchOrchestrator.ts')
      await import(/* @vite-ignore */ root + '/studio/objects.ts')
      const copy = { title: row.title, role: 'cover' }
      const campaign = campaignContext({ title: row.title, sources: [{ url: row.url, title: row.title }], slides: [copy] })
      const request = requestFor('fresh-' + index + '/cover', copy, campaign, .8)
      const start = performance.now()
      let firstMs = null
      let image = null
      let status
      await investigateVisuals([request], { used: () => new Set(), image: (_request, asset) => {
        firstMs ??= performance.now() - start
        image = { url: asset.object.imageCredit?.originalUrl, classification: asset.match.classification }
      }, finish: (_request, state) => { status = state } }, AbortSignal.timeout(28000))
      return { firstMs, totalMs: performance.now() - start, image, status }
    }, { version, row, index })
    results.push({ version, index, ...result, providerAttempts: queries, paidQueries: 0 })
    await page.close()
  }
  await writeFile(new URL(prefix + '-replay.json', cache), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results))
} finally { await browser?.close(); server.kill() }
