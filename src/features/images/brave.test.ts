import { afterEach, describe, expect, it, vi } from 'vitest'
import { braveSearch, cleanQuery } from '../../../worker/brave'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('busca de imagens Brave', () => {
  it('preserva nomes compostos e acentos na consulta', () => {
    expect(cleanQuery('McLaren 750S — nova identidade visual')).toBe('McLaren 750S — nova identidade visual')
  })

  it('trata resultados incompletos e cancela antes do transporte', async () => {
    const fetchMock = vi.fn(async () => Response.json({ results: [
      { url: 'https://www.example.com/page', title: 'Embalagem ilustrada', properties: { url: 'https://cdn.example.com/package.jpg', width: 1200, height: 800 } },
      { url: 'https://www.example.com/other', title: 'Imagem sem endereço direto' },
      { title: 'Registro sem página' },
    ] }))
    vi.stubGlobal('fetch', fetchMock)
    const args = ['images', 'McLaren nova identidade', 'pt', 'secret'] as const
    await expect(braveSearch(...args, AbortSignal.abort())).resolves.toMatchObject({ state: 'unavailable' })
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(braveSearch(...args, new AbortController().signal)).resolves.toMatchObject({
      state: 'ok', stats: { received: 3, malformed: 1, missingImageUrl: 1, retained: 1 },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
