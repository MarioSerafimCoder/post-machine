import { afterEach, describe, expect, it, vi } from 'vitest'
import { licenseTerms, responseSchema, toCredit } from './contract'
import { automaticOriginal, fetchOriginal, searchImages, thumbnailUrl } from './openverse'

const id = 'ee293bf3-d38a-4162-aca8-771708adc0b8'
const image = { id, title: 'Fixture de imagem', thumbnail: `https://api.openverse.org/v1/images/${id}/thumb/`, url: 'https://upload.wikimedia.org/wikipedia/commons/foo.png', width: 640 }
const filters = { query: 'arquitetura fixture', page: 2, license: 'by', commercial: true, ratio: 'wide', source: 'wikimedia' }
const signal = () => new AbortController().signal
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Openverse com respostas simuladas', () => {
  it('normaliza campos opcionais e ignora entradas ou URLs inválidas', () => {
    const value = responseSchema.parse({ page_count: 2, results: [{ id: 'não é ID' }, { ...image, creator: null, foreign_landing_url: 'javascript:alert(1)' }] })
    expect(value.results).toHaveLength(1)
    expect(value.results[0]).toMatchObject({ id, creator: undefined, foreign_landing_url: undefined, width: 640 })
    expect(value.results[0].height).toBeUndefined()
    expect(thumbnailUrl(value.results[0])).toContain(id)
  })
  it('envia filtros, pagina e reutiliza o cache sem credenciais', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ page_count: 3, results: [image] })))
    vi.stubGlobal('fetch', fetch)
    expect((await searchImages(filters, signal())).pages).toBe(3)
    await searchImages(filters, signal())
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ page: '2', license_type: 'commercial', aspect_ratio: 'wide', source: 'wikimedia' })
    expect(options.credentials).toBe('omit')
  })
  it('reconhece lista vazia, falha de rede e cancelamento antes de fetch', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ page_count: 0, results: [] }))).mockRejectedValue(new TypeError('network'))
    vi.stubGlobal('fetch', fetch)
    expect((await searchImages({ ...filters, query: 'vazia' }, signal())).results).toEqual([])
    await expect(searchImages({ ...filters, query: 'falha' }, signal())).rejects.toThrow('network')
    const controller = new AbortController()
    controller.abort()
    await expect(searchImages({ ...filters, query: 'cancelada' }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('bloqueia consultas durante Retry-After observado', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'))
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '7' } })).mockResolvedValue(new Response(JSON.stringify({ page_count: 0, results: [] })))
    vi.stubGlobal('fetch', fetch)
    const search = { ...filters, query: 'limite' }
    await expect(searchImages(search, signal())).rejects.toMatchObject({ name: 'SearchLimit', until: Date.now() + 7000 })
    await expect(searchImages(search, signal())).rejects.toMatchObject({ name: 'SearchLimit' })
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date('2026-11-15T12:00:08Z'))
    await expect(searchImages(search, signal())).resolves.toEqual({ pages: 0, results: [] })
  })
  it('propaga cancelamento durante a consulta em andamento', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: URL, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
    })))
    const controller = new AbortController()
    const pending = searchImages({ ...filters, query: 'em andamento' }, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('importa somente do host permitido, com CORS, tamanho e redirecionamento restritos', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }))
      .mockRejectedValueOnce(new TypeError('CORS'))
      .mockResolvedValueOnce(new Response('too large', { headers: { 'Content-Type': 'image/png', 'Content-Length': '20000001' } }))
    vi.stubGlobal('fetch', fetch)
    const result = responseSchema.parse({ page_count: 1, results: [image] }).results[0]
    expect(automaticOriginal({ ...result, url: 'https://upload.wikimedia.org.outro.site/image.png' })).toBeUndefined()
    expect((await fetchOriginal(result, signal())).size).toBe(3)
    expect(fetch.mock.calls[0][1]).toMatchObject({ mode: 'cors', credentials: 'omit', redirect: 'error' })
    await expect(fetchOriginal(result, signal())).rejects.toThrow('não liberou')
    await expect(fetchOriginal(result, signal())).rejects.toThrow('20 MB')
  })
  it('distingue CC0, CC BY, NC, ND e metadados de licença insuficientes', () => {
    const base = toCredit(responseSchema.parse({ page_count: 1, results: [image] }).results[0])
    const terms = (license: string, path: string) => licenseTerms({ ...base, license, licenseVersion: '1.0', licenseUrl: 'https://creativecommons.org/' + path + '/1.0/' })
    expect(terms('cc0', 'publicdomain/zero')).toMatchObject({ commercial: true, attribution: false })
    expect(terms('by', 'licenses/by')).toMatchObject({ commercial: true, attribution: true })
    expect(terms('by-nc-sa', 'licenses/by-nc-sa')).toMatchObject({ commercial: false, shareAlike: true })
    expect(terms('by-nd', 'licenses/by-nd')).toMatchObject({ noDerivatives: true })
    expect(licenseTerms({ ...base, license: 'by' })).toMatchObject({ valid: false, commercial: undefined })
  })
})
