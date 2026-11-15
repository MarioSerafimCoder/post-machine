import { describe, expect, it, vi } from 'vitest'
import { collectVideos } from '../../../virals/collect.ts'
import { displayVideo, parseVideoBatch, snapshotSchema } from './youtube'

const id = 'abcdefghijk'
const second = 'abcdefghij0'
const sameDay = new Date('2026-11-15T18:00:00Z')
const fake = { items: [{ id, snippet: { title: 'Vídeo da fixture', publishedAt: '2026-10-01T12:00:00Z', channelTitle: 'Canal da fixture', thumbnails: { medium: { url: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg' } } }, contentDetails: { duration: 'PT4M15S' }, statistics: { viewCount: '1378' } }] }
const options = { ids: [id, id, second], key: 'chave-de-fixture', perRun: 1, perDay: 1 }

describe('coleta opcional do YouTube com fixtures', () => {
  it('mantém dados reais retornados e distingue ausentes e indisponíveis', () => {
    const [video, unavailable] = parseVideoBatch(fake, [id, second], sameDay.toISOString())
    expect(video).toMatchObject({ id, title: 'Vídeo da fixture', viewCount: '1378', duration: 'PT4M15S' })
    expect(video.likeCount).toBeUndefined()
    expect(unavailable).toMatchObject({ id: second, status: 'unavailable' })
    expect(parseVideoBatch({ items: [{ id, snippet: { thumbnails: { medium: { url: 'javascript:alert(1)' } } } }] }, [id], sameDay.toISOString())[0].thumbnail).toBeUndefined()
  })
  it('deduplica em lote, filtra dados e usa a chave apenas no cabeçalho do servidor', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(fake)))
    const state = await collectVideos(options, undefined, sameDay, request)
    expect(snapshotSchema.parse(state).videos).toHaveLength(2)
    const [url, settings] = request.mock.calls[0]
    expect(url.searchParams.get('id')).toBe(id + ',' + second)
    expect(String(url)).not.toContain(options.key)
    expect(settings.headers['x-goog-api-key']).toBe(options.key)
    expect(JSON.stringify(state)).not.toContain(options.key)
    expect(state.requests).toBe(1)
    await collectVideos(options, state, new Date(+sameDay + 3600_000), request)
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('impede consultas acima do orçamento diário ou com cache indisponível', async () => {
    const request = vi.fn()
    const state = { schemaVersion: 1 as const, status: 'ready' as const, day: '2026-11-15', requests: 1, videos: [] }
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', dateStyle: 'short' }).format(sameDay)
    expect((await collectVideos({ ...options, perRun: 4 }, { ...state, day }, sameDay, request)).status).toBe('quota')
    expect((await collectVideos({ ...options, cacheUnavailable: true }, undefined, sameDay, request)).status).toBe('error')
    expect(request).not.toHaveBeenCalled()
  })
  it('não chama a API sem chave e aplica backoff após resposta 429', async () => {
    const request = vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '3600' } }))
    expect(await collectVideos({ ...options, key: undefined }, undefined, sameDay, request)).toMatchObject({ status: 'disconnected', videos: [] })
    expect(request).not.toHaveBeenCalled()
    const state = await collectVideos(options, undefined, sameDay, request)
    expect(state.status).toBe('quota')
    expect(state.retryAt).toBe(new Date(+sameDay + 3600_000).toISOString())
    await collectVideos({ ...options, perDay: 20 }, state, new Date(+sameDay + 1000), request)
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('limita lotes e expira observações antigas', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(fake)))
    const ids = Array.from({ length: 51 }, (_, index) => ('fixture' + String(index).padStart(4, '0')))
    const state = await collectVideos({ ...options, ids, perDay: 3 }, undefined, sameDay, request)
    expect(state.videos).toHaveLength(50)
    expect(request).toHaveBeenCalledTimes(1)
    expect(displayVideo(state.videos[0], +sameDay + 8 * 86400_000)).toBe(false)
  })
})
