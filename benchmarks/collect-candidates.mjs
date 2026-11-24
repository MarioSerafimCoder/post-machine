import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sample from '../src/features/images/fixtures/documentary-sample.json' with { type: 'json' }

const destination = new URL('./.cache/', import.meta.url)
await mkdir(destination, { recursive: true })
const urls = [...new Set(sample.flatMap(row => (row.candidates ?? []).map(asset => asset.url)))]
const results = {}
const previous = await readFile(new URL('candidates.json', destination), 'utf8').then(JSON.parse).catch(() => ({}))
const limit = 10_000_000
async function fetchImage(url) {
  const name = createHash('sha256').update(url).digest('hex') + '.bin'
  const file = new URL(name, destination)
  const cached = await stat(file).catch(() => undefined)
  const start = performance.now()
  try {
    if (cached?.size && previous[url]?.bytes === cached.size) return previous[url]
    const response = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { Accept: 'image/webp,image/jpeg,image/png' } })
    const mime = response.headers.get('content-type')?.split(';')[0]
    if (!response.ok || !response.body || !['image/webp', 'image/jpeg', 'image/png'].includes(mime) ||
        Number(response.headers.get('content-length')) > limit) return { status: response.status, mime }
    let bytes = 0
    const chunks = []
    for await (const chunk of response.body) {
      bytes += chunk.length
      if (bytes > limit) return { status: response.status, mime, oversized: true }
      chunks.push(chunk)
    }
    const fileData = Buffer.concat(chunks)
    await writeFile(file, fileData)
    return { name, mime, bytes, ms: Math.round(performance.now() - start) }
  } catch (cause) { return { error: cause.name } }
}
await Promise.all(Array.from({ length: 5 }, async () => {
  while (urls.length) {
    const url = urls.shift()
    results[url] = await fetchImage(url)
  }
}))
await writeFile(new URL('candidates.json', destination), JSON.stringify(results, null, 2))
console.log(JSON.stringify({ urls: Object.keys(results).length, downloaded: Object.values(results).filter(item => item.name).length }))
