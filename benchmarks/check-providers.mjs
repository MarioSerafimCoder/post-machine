import { readFile, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { build } from 'esbuild'

const cache = new URL('./.cache/', import.meta.url)
const rows = JSON.parse(await readFile(new URL('independent-network.json', cache), 'utf8'))
const bundle = await build({ stdin: { resolveDir: '.', contents: "export { braveSearch } from './worker/brave'; export { externalUrl } from './worker/security'" },
  bundle: true, write: false, platform: 'node', format: 'esm' })
const { braveSearch, externalUrl } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

const brave = []
if (process.env.BRAVE_VISUAL_ZERO_SPEND === 'confirmed' && process.env.BRAVE_SEARCH_API_KEY) {
  const pending = rows.filter(row => row.title && !row.candidates?.length).slice(0, 12)
  for (const row of pending) {
    const start = performance.now()
    const result = await braveSearch('web', row.title, undefined, process.env.BRAVE_SEARCH_API_KEY, AbortSignal.timeout(5000))
    brave.push({ source: row.url, state: result.state, returned: result.pages.length,
      reachableByWorker: result.pages.flatMap(page => {
        const url = externalUrl(page.url, process.env.VISUAL_EXTERNAL_HOSTS)
        return url && !url.search ? [url.href] : []
      }), ms: performance.now() - start })
    if (result.state !== 'ok') break
    await delay(1150)
  }
}

let youtube = { state: 'unconfigured' }
if (process.env.YOUTUBE_API_KEY) {
  const endpoint = new URL('https://www.googleapis.com/youtube/v3/search')
  endpoint.search = new URLSearchParams({ q: 'Pixar Gatto official trailer', part: 'snippet', type: 'video', maxResults: '1', fields: 'items(id/videoId)' }).toString()
  try {
    const response = await fetch(endpoint, { headers: { 'x-goog-api-key': process.env.YOUTUBE_API_KEY },
      redirect: 'error', signal: AbortSignal.timeout(6000) })
    const result = await response.json()
    youtube = { status: response.status, state: response.ok ? 'available' : 'refused',
      reason: String(result.error?.errors?.[0]?.reason ?? '').replace(/[^\w-]/g, '').slice(0, 70),
      returned: result.items?.length ?? 0 }
  } catch { youtube = { state: 'unavailable' } }
}
const report = { brave, youtube }
await writeFile(new URL('provider-check.json', cache), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ braveRequests: brave.length, braveStates: brave.map(row => row.state), youtube }))
