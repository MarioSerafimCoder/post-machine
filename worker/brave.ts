import { z } from 'zod'
import type { Extracted } from './extract'
import { readJson } from './security'

const item = z.object({
  url: z.string(), title: z.string().optional(), description: z.string().optional(), page_age: z.string().optional(),
  properties: z.object({ url: z.string().optional(), width: z.number().int().positive().max(40000).optional(),
    height: z.number().int().positive().max(40000).optional() }).optional(),
})
const record = z.object({ web: z.object({ results: z.array(z.unknown()) }).optional(), results: z.array(z.unknown()).optional() })
type SearchKind = 'web' | 'images'
let waitUntil = 0
let busy = false
type Waiter = { signal: AbortSignal; resolve: (release: () => void) => void; abort: () => void }
const waiting: Waiter[] = []

function release() {
  const next = waiting.shift()
  if (next) {
    next.signal.removeEventListener('abort', next.abort)
    next.resolve(release)
  } else busy = false
}

function acquire(signal: AbortSignal): Promise<(() => void) | undefined> {
  if (signal.aborted) return Promise.reject(signal.reason)
  if (!busy) { busy = true; return Promise.resolve(release) }
  if (waiting.length >= 2) return Promise.resolve(undefined)
  return new Promise((resolve, reject) => {
    const waiter: Waiter = { signal, resolve, abort: () => {
      const index = waiting.indexOf(waiter)
      if (index >= 0) waiting.splice(index, 1)
      signal.removeEventListener('abort', waiter.abort)
      reject(signal.reason)
    } }
    waiting.push(waiter)
    signal.addEventListener('abort', waiter.abort, { once: true })
  })
}

function pause(ms: number, signal: AbortSignal) {
  if (!ms) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); resolve() }
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(signal.reason) }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}

const limit = (value?: string, max = 500) => value?.replace(/<[^>]{1,200}>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const emptyStats = { received: 0, malformed: 0, missingImageUrl: 0, retained: 0 }
export const cleanQuery = (value: string) => value.normalize('NFC')
  .replace(/(?:^|\s)[+-]?(?:site|inurl|intitle|ext|filetype|loc|lang|before|after|url|inbody):\S+/gi, ' ')
  .replace(/[\p{Cc}<>]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)

export async function braveSearch(kind: SearchKind, query: string, language: string | undefined, apiKey: string, signal: AbortSignal) {
  if (waitUntil - Date.now() > 1500) return { state: 'limited' as const, pages: [], images: [], stats: emptyStats }
  const endpoint = new URL('https://api.search.brave.com/res/v1/' + kind + '/search')
  endpoint.search = new URLSearchParams({ q: cleanQuery(query), count: kind === 'web' ? '5' : '12', safesearch: 'strict', spellcheck: 'false' }).toString()
  if (!endpoint.searchParams.get('q')) return { state: 'unavailable' as const, pages: [], images: [], stats: emptyStats }
  if (language === 'en' || language === 'pt') endpoint.searchParams.set('search_lang', language)
  if (kind === 'web') endpoint.searchParams.set('result_filter', 'web')
  let unlock: (() => void) | undefined
  try {
    unlock = await acquire(signal)
    if (!unlock) return { state: 'limited' as const, pages: [], images: [], stats: emptyStats }
    const delay = waitUntil - Date.now()
    if (delay > 1500) return { state: 'limited' as const, pages: [], images: [], stats: emptyStats }
    if (delay > 0) await pause(delay, signal)
    const response = await fetch(endpoint, { headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
      credentials: 'omit', redirect: 'manual', cache: 'no-store', signal })
    if (!response.ok) {
      await response.body?.cancel()
      const resets = (response.headers.get('x-ratelimit-reset') ?? '').split(',').map(Number)
      const remaining = (response.headers.get('x-ratelimit-remaining') ?? '').split(',').map(Number)
      const quotaReset = remaining.reduce((time, count, index) => count === 0 ? Math.max(time, resets[index] || 0) : time, 0)
      const retryHeader = response.headers.get('retry-after')
      const retry = Number(retryHeader) || (retryHeader ? (Date.parse(retryHeader) - Date.now()) / 1000 : 0) || 0
      const now = new Date()
      const billingReset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
      waitUntil = response.status === 402 ? billingReset : Date.now() +
        (response.status === 429 ? Math.min(32 * 86400, Math.max(30, retry, quotaReset)) : 60) * 1000
      return { state: [402, 429].includes(response.status) ? 'limited' as const : 'unavailable' as const, pages: [], images: [], stats: emptyStats }
    }
    waitUntil = Date.now() + 1100
    const payload = record.parse(await readJson(response, 250_000))
    const results = (kind === 'web' ? payload.web?.results : payload.results) ?? []
    const pages: { url: string; title?: string; description?: string }[] = []
    const images: Extracted[] = []
    let malformed = 0
    let missingImageUrl = 0
    for (const raw of results.slice(0, 12)) {
      const parsed = item.safeParse(raw)
      if (!parsed.success) { malformed++; continue }
      const { url, title, description, properties, page_age } = parsed.data
      if (kind === 'web') pages.push({ url, title: limit(title), description: limit(description, 1000) })
      else if (properties?.url) images.push({ provider: 'brave', evidence: 'search', url: properties.url, page: url,
        title: limit(title), description: limit(description, 1000), width: properties.width, height: properties.height,
        publishedAt: limit(page_age, 50) })
      else missingImageUrl++
    }
    return { state: 'ok' as const, pages, images, stats: { received: results.length, malformed, missingImageUrl, retained: pages.length + images.length } }
  } catch {
    if (signal.aborted) return { state: 'unavailable' as const, pages: [], images: [], stats: emptyStats }
    waitUntil = Date.now() + 30_000
    return { state: 'unavailable' as const, pages: [], images: [], stats: emptyStats }
  } finally { unlock?.() }
}
