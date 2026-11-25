import { readFile, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { collect } from '../radar/collect.ts'
import { sourceSchema } from '../src/features/radar/contract.ts'
const config = JSON.parse(await readFile('radar/sources.json', 'utf8'))
config.sources = config.sources.map(source => sourceSchema.parse(source))
const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `export {externalFetch,externalUrl,readLimited} from './worker/security'; export {rankNews,editorialRelevance} from './src/features/radar/relevance'` }, bundle: true, write: false, platform: 'node', format: 'esm' })
await writeFile('benchmarks/.cache/radar-audit-helper.mjs', bundle.outputFiles[0].text)
const helper = await import('./.cache/radar-audit-helper.mjs')
const filename = 'benchmarks/.cache/evolution131-radar.json'
const previous = JSON.parse(await readFile('public/radar.json', 'utf8'))
const snapshot = process.argv.includes('--capture') ? await collect(config.sources, previous, async source => {
  const hosts = [new URL(source.url).hostname, ...(source.redirectHosts ?? [])].join(',')
  const url = helper.externalUrl(source.url, hosts)
  const { response } = await helper.externalFetch(url, hosts, 'application/rss+xml,application/xml,text/xml', AbortSignal.timeout(12000))
  if (!response.ok) throw Error(`HTTP ${response.status}`)
  return new TextDecoder().decode(await helper.readLimited(response, 2000000))
}) : JSON.parse(await readFile(filename, 'utf8'))
if (process.argv.includes('--capture')) await writeFile(filename, JSON.stringify(snapshot, null, 2))
const now = Date.parse(snapshot.attemptedAt)
const recent = snapshot.items.filter(item => item.publishedAt && now - Date.parse(item.publishedAt) >= 0 && now - Date.parse(item.publishedAt) <= 14 * 86400000)
const sample = recent.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 120)
const ranked = helper.rankNews(sample, now)
await writeFile('benchmarks/.cache/evolution131-radar-ranked.json', JSON.stringify(ranked.map((article, i) => ({ rank: i + 1, ...article, relevance: helper.editorialRelevance(article, now) })), null, 2))
console.log(JSON.stringify({ total: snapshot.items.length, recent: recent.length, sample: sample.length, sources: snapshot.sources }))
