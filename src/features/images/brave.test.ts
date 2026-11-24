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

  it('enfileira concorrência curta e limita o restante sem perder buscas aceitas', async () => {
    vi.useFakeTimers()
    let finishFirst!: (response: Response) => void
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finishFirst = resolve }))
      .mockImplementation(() => Promise.resolve(Response.json({ results: [] })))
    vi.stubGlobal('fetch', fetchMock)

    const signal = () => new AbortController().signal
    const first = braveSearch('images', 'McLaren nova identidade', 'pt', 'secret', signal())
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    const second = braveSearch('images', 'McLaren logotipo revisado', 'pt', 'secret', signal())
    const third = braveSearch('images', 'McLaren emblema atualizado', 'pt', 'secret', signal())
    const overflow = braveSearch('images', 'McLaren carroceria', 'pt', 'secret', signal())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    await expect(overflow).resolves.toMatchObject({ state: 'limited' })
    finishFirst(Response.json({ results: [
      { url: 'https://www.example.com/page', title: 'Embalagem ilustrada', properties: { url: 'https://cdn.example.com/package.jpg', width: 1200, height: 800 } },
      { url: 'https://www.example.com/other', title: 'Imagem sem endereço direto' },
      { title: 'Registro sem página' },
    ] }))
    await expect(first).resolves.toMatchObject({ state: 'ok', stats: { received: 3, malformed: 1, missingImageUrl: 1, retained: 1 } })
    await vi.advanceTimersByTimeAsync(1100)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1100)
    await expect(Promise.all([second, third])).resolves.toEqual([
      { state: 'ok', pages: [], images: [], stats: { received: 0, malformed: 0, missingImageUrl: 0, retained: 0 } },
      { state: 'ok', pages: [], images: [], stats: { received: 0, malformed: 0, missingImageUrl: 0, retained: 0 } },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
