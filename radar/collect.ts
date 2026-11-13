import { createHash } from 'node:crypto'
import { resolve4 } from 'node:dns/promises'
import { get } from 'node:https'
import { BlockList, isIP } from 'node:net'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { SaxesParser } from 'saxes'
import { z } from 'zod'
import { articleSchema, normalize, snapshotSchema, sourceSchema, type Article, type Snapshot } from '../src/features/radar/contract.ts'

type Source = z.infer<typeof sourceSchema>
type Element = { name: string; attributes: Record<string, string>; children: Element[]; text: string }
const DAY = 86400000
const blocked = new BlockList()
for (const [address, bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]] as const) blocked.addSubnet(address,bits)

export async function fetchFeed(source: Source) {
  let url = new URL(source.url)
  const hosts = [url.hostname, ...source.redirectHosts]
  for (let hop = 0; hop <= 3; hop++) {
    if (url.protocol !== 'https:' || url.port || url.username || url.password || isIP(url.hostname) || url.hostname.startsWith('[') || !hosts.includes(url.hostname)) throw Error('Destino do feed não permitido')
    const signal = AbortSignal.timeout(12000)
    const result = await new Promise<{ redirect: string } | { xml: string }>((resolve, reject) => {
      const request = get(url, {
        signal, family: 4, headers: { 'user-agent': 'PostMachine RSS Reader/1.0', 'accept-encoding': 'identity' },
        lookup(host, _options, callback) {
          resolve4(host).then(addresses => {
            const address = addresses[0]
            if (!address || addresses.some(ip => blocked.check(ip))) callback(Error('Endereço do feed não permitido'), '', 4)
            else callback(null, address, 4)
          }, error => callback(error, '', 4))
        },
      }, response => {
        response.on('error', reject)
        const status = response.statusCode ?? 0
        if ([301,302,303,307,308].includes(status) && response.headers.location) {
          resolve({ redirect: response.headers.location }); response.destroy(); return
        }
        if (status !== 200) { reject(Error(`HTTP ${status}`)); response.destroy(); return }
        const chunks: Buffer[] = []
        let bytes = 0
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes > 2_000_000) { request.destroy(Error('Feed acima de 2 MB')); return }
          chunks.push(chunk)
        })
        response.on('end', () => resolve({ xml: Buffer.concat(chunks).toString('utf8') }))
      })
      request.on('error', reject)
    })
    if ('xml' in result) return result.xml
    url = new URL(result.redirect, url)
  }
  throw Error('Excesso de redirecionamentos')
}

const plain = (value = '') => value.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, entity => {
  const key = entity.slice(1,-1).toLowerCase()
  const code = key.startsWith('#x') ? Number.parseInt(key.slice(2),16) : key.startsWith('#') ? Number(key.slice(1)) : 0
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ({ amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ' }[key] ?? entity)
}).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const child = (node: Element, ...names: string[]) => node.children.find(item => names.includes(item.name))
const value = (node: Element, ...names: string[]) => child(node, ...names)?.text.trim()
export function canonical(link: string) {
  const url = new URL(link)
  url.hash = ''
  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key)
  url.searchParams.sort()
  return url.href
}
const words = (title: string) => normalize(title).match(/[\p{L}\p{N}]+/gu) ?? []
function similar(a: string, b: string) {
  const x = words(a), y = words(b)
  if (x.join(' ') === y.join(' ')) return x.length >= 3
  const first = new Set(x), second = new Set(y)
  const overlap = [...first].filter(word => second.has(word)).length
  return overlap >= 5 && overlap / (first.size + second.size - overlap) >= .84
}

export function parseFeed(xml: string, source: Source, collectedAt: string, keywords: Record<string, string[]> = {}): Article[] {
  const tree: Element = { name: '', attributes: {}, children: [], text: '' }
  const stack = [tree]
  const parser = new SaxesParser()
  parser.on('doctype', () => { throw Error('DOCTYPE não permitido') })
  parser.on('opentag', tag => {
    if (stack.length > 60) throw Error('Feed muito aninhado')
    const node = { name: tag.name.split(':').at(-1)!.toLowerCase(), attributes: tag.attributes, children: [], text: '' }
    stack.at(-1)!.children.push(node); stack.push(node)
  })
  parser.on('closetag', () => {
    const node = stack.pop()!
    if (stack.length > 1) stack.at(-1)!.text += node.text ? ` ${node.text}` : ''
  })
  parser.on('text', text => { stack.at(-1)!.text += text })
  parser.on('cdata', text => { stack.at(-1)!.text += text })
  parser.write(xml).close()
  const root = tree.children[0]
  if (!root || !['rss','feed','rdf'].includes(root.name)) throw Error('Formato RSS/Atom inválido')
  const entries = (root.name === 'rdf' ? root : child(root,'channel') ?? root).children.filter(node => ['item','entry'].includes(node.name))
  return entries.slice(0,60).flatMap(entry => {
    const trend = source.kind === 'trends' ? plain(value(entry,'title')) : undefined
    const related = trend ? entry.children.filter(node => node.name === 'news_item').slice(0,2) : [entry]
    return related.flatMap(node => {
      const title = plain(value(node, trend ? 'news_item_title' : 'title')).slice(0,500)
      const link = node.children.find(item => item.name === 'link' && (!item.attributes.rel || item.attributes.rel === 'alternate'))
      const url = (trend ? value(node,'news_item_url') : link?.attributes.href ?? link?.text.trim()) ?? ''
      let canonicalUrl: string
      try { canonicalUrl = canonical(url) } catch { return [] }
      const date = trend ? NaN : Date.parse(value(entry,'pubdate','published','date') ?? '')
      const haystack = ` ${words(`${title} ${trend ?? ''}`).join(' ')} `
      const category = trend ? Object.entries(keywords).find(([,terms]) => terms.some(term => haystack.includes(` ${words(term).join(' ')} `)))?.[0] ?? source.category : source.category
      const summary = plain(value(node, ...(trend ? ['news_item_snippet'] : ['description','summary']))).slice(0,420)
      const parsed = articleSchema.safeParse({
        id: createHash('sha256').update(canonicalUrl).digest('hex').slice(0,32), canonicalUrl, url, title,
        summary: summary || undefined, source: plain(value(node,'news_item_source')) || source.name,
        feedId: source.id, category, language: source.language, country: source.country, trend,
        publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null, collectedAt,
      })
      return parsed.success ? [parsed.data] : []
    })
  })
}

export async function collect(sources: Source[], previous: Snapshot | null, keywords: Record<string,string[]>, fetcher = fetchFeed, now = new Date()): Promise<Snapshot> {
  const attemptedAt = now.toISOString()
  const results = await Promise.all(sources.map(async source => {
    const info = { id: source.id, name: source.name, url: source.url }
    try {
      const items = parseFeed(await fetcher(source), source, attemptedAt, keywords)
      if (!items.length) throw Error('Feed sem itens válidos')
      return { items, status: { ...info, count: items.length, error: undefined } }
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      return { items: [], status: { ...info, count: 0, error: /^HTTP \d+$/.test(message) ? message : 'Feed indisponível ou inválido' } }
    }
  }))
  const success = results.some(result => !result.status.error)
  const items = (previous?.items ?? []).filter(item => Date.parse(item.collectedAt) >= +now - 14 * DAY || !success)
  for (const fresh of results.flatMap(result => result.items)) {
    const index = items.findIndex(item => item.canonicalUrl === fresh.canonicalUrl || similar(item.title, fresh.title))
    if (index < 0) items.push(fresh)
    else if (items[index].canonicalUrl === fresh.canonicalUrl) {
      const old = items[index]
      items[index] = { ...(old.trend && !fresh.trend ? fresh : old), trend: fresh.trend ?? old.trend }
    }
  }
  items.sort((a,b) => (b.publishedAt ?? b.collectedAt).localeCompare(a.publishedAt ?? a.collectedAt))
  return snapshotSchema.parse({ version: 1, attemptedAt, collectedAt: success ? attemptedAt : previous?.collectedAt ?? null, sources: results.map(r => r.status), items: items.slice(0,600) })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = new URL('../public/radar.json', import.meta.url)
  const config = z.object({ sources: z.array(sourceSchema).min(1), keywords: z.record(z.string(),z.array(z.string().min(1))) }).parse(JSON.parse(await readFile(new URL('./sources.json',import.meta.url),'utf8')))
  const previous = await readFile(file,'utf8').then(raw => snapshotSchema.parse(JSON.parse(raw)), error => {
    if (error.code !== 'ENOENT') throw error
    return null
  })
  const result = await collect(config.sources, previous, config.keywords)
  if (!result.collectedAt) throw Error('Nenhuma fonte válida e nenhum snapshot anterior')
  const temp = new URL('../public/radar.json.tmp',import.meta.url)
  await writeFile(temp, JSON.stringify(result) + '\n')
  await rename(temp,file)
  console.log(JSON.stringify({ attemptedAt: result.attemptedAt, collectedAt: result.collectedAt, items: result.items.length, sources: result.sources.map(({id,count,error})=>({id,count,error})) }))
}
