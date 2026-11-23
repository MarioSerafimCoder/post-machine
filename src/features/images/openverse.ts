import { originalHosts, openverseOrigin, responseSchema, safeWebUrl, type ImageResult } from './contract'

export type Search = { query: string; page: number; license: string; commercial: boolean; ratio: string; source: string; photographs?: boolean }
type SearchResult = ReturnType<typeof responseSchema.parse>
const cache = new Map<string, { expires: number; data: SearchResult }>()
type PendingPhotographs = { controller: AbortController; users: number; result: Promise<SearchResult> }
const pendingPhotographs = new Map<string, PendingPhotographs>()
let blockedUntil = 0
const maxBytes = 20_000_000
const types = ['image/png', 'image/jpeg', 'image/webp']

function retryDelay(header: string | null, now: number) {
  if (header === null) return 60_000
  const seconds = Number(header)
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now
  return Number.isFinite(delay) ? Math.max(1000, delay) : 60_000
}

export class SearchLimit extends Error {
  constructor(readonly until: number) { super('Limite de buscas do Openverse atingido. Tente novamente depois.'); this.name = 'SearchLimit' }
}
export async function searchImages(search: Search, signal: AbortSignal) {
  if (!search.photographs) return fetchResults(search, signal)
  signal.throwIfAborted()
  const key = JSON.stringify(search)
  let pending = pendingPhotographs.get(key)
  if (!pending) {
    const controller = new AbortController()
    const result = fetchResults(search, controller.signal).finally(() => {
      if (pendingPhotographs.get(key)?.controller === controller) pendingPhotographs.delete(key)
    })
    pending = { controller, users: 0, result }
    pendingPhotographs.set(key, pending)
  }
  const request = pending
  request.users++
  let onAbort: (() => void) | undefined
  return new Promise<SearchResult>((resolve, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    void request.result.then(resolve, reject)
  }).finally(() => {
    if (onAbort) signal.removeEventListener('abort', onAbort)
    request.users--
    if (!request.users && pendingPhotographs.get(key) === request) {
      pendingPhotographs.delete(key)
      request.controller.abort()
    }
  })
}

async function fetchResults(search: Search, signal: AbortSignal) {
  signal.throwIfAborted()
  const query = search.query.trim()
  if (!query || query.length > 160) throw Error('Digite um termo de pesquisa de até 160 caracteres.')
  const url = new URL('/v1/images/', openverseOrigin)
  url.search = new URLSearchParams({ q: query, page: String(search.page), page_size: '20' }).toString()
  if (search.license) url.searchParams.set('license', search.license)
  if (search.commercial) url.searchParams.set('license_type', 'commercial')
  if (['wide', 'tall', 'square'].includes(search.ratio)) url.searchParams.set('aspect_ratio', search.ratio)
  if (search.source) url.searchParams.set('source', search.source)
  if (search.photographs) url.searchParams.set('category', 'photograph')
  const key = String(url)
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expires > now) return cached.data
  if (blockedUntil > now) throw new SearchLimit(blockedUntil)
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), credentials: 'omit', redirect: 'error' })
  if (response.status === 429) {
    blockedUntil = Date.now() + retryDelay(response.headers.get('Retry-After'), Date.now())
    throw new SearchLimit(blockedUntil)
  }
  if (!response.ok) throw Error(`Openverse indisponível (HTTP ${response.status}).`)
  const parsed = responseSchema.safeParse(await response.json())
  signal.throwIfAborted()
  if (!parsed.success) throw Error('O Openverse retornou uma resposta incompatível.')
  cache.delete(key)
  if (cache.size >= 30) cache.delete(cache.keys().next().value!)
  cache.set(key, { expires: Date.now() + 300_000, data: parsed.data })
  return parsed.data
}

export function automaticOriginal(result: ImageResult) {
  const url = result.url ? safeWebUrl(result.url) : undefined
  if (!url || url.protocol !== 'https:' || url.port || !originalHosts.includes(url.hostname)) return undefined
  if (result.filetype && !['png', 'jpg', 'jpeg', 'webp'].includes(result.filetype.toLowerCase())) return undefined
  return url
}

export function thumbnailUrl(result: ImageResult) {
  const url = result.thumbnail && safeWebUrl(result.thumbnail)
  return url && url.origin === openverseOrigin && url.pathname === `/v1/images/${result.id}/thumb/` ? String(url) : undefined
}

export async function fetchOriginal(result: ImageResult, signal: AbortSignal) {
  const url = automaticOriginal(result)
  if (!url) throw Error('Baixe o original na fonte e importe o arquivo com os créditos selecionados.')
  return fetchImageFile(url, 'openverse-' + result.id, signal)
}

export async function fetchExternalImage(value: string, signal: AbortSignal) {
  const url = safeWebUrl(value.trim())
  if (!url || url.protocol !== 'https:' || url.port) throw Error('Informe uma URL HTTPS de imagem sem credenciais.')
  if (!originalHosts.includes(url.hostname)) throw Error('O endereço não pertence a um provedor de importação direta. Baixe o arquivo e use o envio local.')
  const filename = url.pathname.split('/').at(-1) || 'Imagem externa'
  return fetchImageFile(url, filename, signal)
}

async function fetchImageFile(url: URL, filename: string, signal: AbortSignal) {
  const response = await fetch(url, {
    mode: 'cors', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
    signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
  }).catch(() => { throw Error('O provedor não liberou o original para importação automática ou a conexão falhou. Baixe na fonte e importe o arquivo abaixo.') })
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
  if (!response.ok || !response.body) throw Error(`Original indisponível (HTTP ${response.status}). Abra a fonte para tentar o download.`)
  if (!types.includes(type) || Number(response.headers.get('content-length')) > maxBytes) {
    await response.body.cancel()
    throw Error('O original precisa ser PNG, JPEG ou WebP de até 20 MB.')
  }
  const reader = response.body.getReader()
  const chunks: ArrayBuffer[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > maxBytes) { await reader.cancel(); throw Error('O original ultrapassa 20 MB.') }
      chunks.push(Uint8Array.from(value).buffer)
    }
  } finally { reader.releaseLock() }
  if (!length) throw Error('O original está vazio.')
  return new File(chunks, filename, { type })
}
