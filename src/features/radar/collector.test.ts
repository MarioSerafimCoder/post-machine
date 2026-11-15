// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { canonical, collect, fetchFeed, parseFeed } from '../../../radar/collect.ts'
import { articleSchema, snapshotSchema, sourceSchema } from './contract'
import { editorialCategories } from './categories'
import { classifyArticle, orderEdition } from '../../../radar/editorial.ts'

const now = new Date('2026-01-10T12:00:00Z')
const source = sourceSchema.parse({ id: 'fixture', name: 'Fixture', url: 'https://example.org/rss', category: 'Design gráfico e tipografia', kind: 'rss', editorialProfile: 'specialist' })
const rss = (link: string, title = 'Uma notícia de teste sobre design local') =>
  `<rss><channel><item><title>${title}</title><link>${link}</link><pubDate>inválida</pubDate><description><![CDATA[<p>Resumo &amp; contexto</p>]]></description></item></channel></rss>`

describe('coletor com fixtures', () => {
  it('normaliza URL, preserva original e não inventa data', () => {
    const [item] = parseFeed(rss('https://example.org/a/?utm_source=x#top'),source,now.toISOString())
    expect(item).toMatchObject({ url: 'https://example.org/a/?utm_source=x#top', canonicalUrl: 'https://example.org/a', publishedAt: null, summary: 'Resumo & contexto' })
    expect(canonical('https://example.org/a?z=1&a=2')).toBe('https://example.org/a?a=2&z=1')
    expect(parseFeed(rss('javascript:alert(1)'),source,now.toISOString())).toEqual([])
  })
  it('rejeita XML inválido, DTD e endereços IP explícitos', async () => {
    expect(() => parseFeed('<rss><item>',source,now.toISOString())).toThrow()
    expect(() => parseFeed('<!DOCTYPE rss SYSTEM "file:///secret"><rss/>',source,now.toISOString())).toThrow()
    await expect(fetchFeed({ ...source, url: 'https://127.0.0.1/rss' })).rejects.toThrow('não permitido')
  })
  it('deduplica, informa falhas e preserva o histórico na falha total', async () => {
    const result = await collect([source,{ ...source,id:'other' },{ ...source,id:'duplicate' },{ ...source,id:'down' }],null,async feed => {
      if (feed.id === 'down') throw Error('HTTP 503')
      if (feed.id === 'duplicate') return rss('https://example.org/a?utm_source=fixture', 'Outro título na mesma URL')
      return rss(`https://example.org/${feed.id === 'other' ? 'b' : 'a'}`, feed.id === 'other' ? 'Uma notícia de teste sobre design local!' : undefined)
    },now)
    expect(result.items).toHaveLength(1)
    expect(result.sources.at(-1)?.error).toBe('HTTP 503')
    const next = await collect([source],result,async () => { throw Error('Timeout') },new Date('2026-02-01T12:00:00Z'))
    expect(next.items).toEqual(result.items)
    expect(next.collectedAt).toBe(result.collectedAt)
    expect(next.attemptedAt).not.toBe(result.attemptedAt)
  })
  it('lê Trends e usa o link da notícia sem atribuir a data da tendência', () => {
    const xml = '<rss xmlns:ht="https://example.org"><channel><item><title>inflação</title><pubDate>2026-01-10</pubDate><ht:news_item><ht:news_item_title>Título da fixture</ht:news_item_title><ht:news_item_url>https://example.org/noticia</ht:news_item_url><ht:news_item_source>Editor</ht:news_item_source></ht:news_item></item></channel></rss>'
    const [item] = parseFeed(xml,{ ...source, kind:'trends' },now.toISOString())
    expect(item).toMatchObject({ category:source.category, publishedAt:null, trend:'inflação', source:'Editor', url:'https://example.org/noticia' })
  })

  it('lê categorias editoriais do feed e datas em português com o fuso original', () => {
    const xml = rss('https://example.org/b').replace('inválida', 'sáb, 14 nov 2026 13:14:58 -0300')
      .replace('</item>', '<category>Criatividade</category></item>')
    const [item] = parseFeed(xml, source, now.toISOString())
    expect(item).toMatchObject({ feedTags: ['Criatividade'], publishedAt: '2026-11-14T16:14:58.000Z' })
  })

  it('reclassifica o cache legado, elimina fontes removidas e mantém o ID e a URL durante a falha total', async () => {
    const [kept] = parseFeed(rss('https://example.org/a?utm_source=original', 'A nova identidade visual do museu'), source, now.toISOString())
    const previous = snapshotSchema.parse({ version: 1, attemptedAt: now.toISOString(), collectedAt: now.toISOString(), sources: [],
      items: [{ ...kept, category: 'Design e criatividade' }, { ...kept, id: 'f'.repeat(32), feedId: 'saude', category: 'Saúde e bem-estar' }] })
    const next = await collect([source], previous, async () => { throw Error('HTTP 503') }, new Date('2026-01-11'))
    expect(next.items).toHaveLength(1)
    expect(next.items[0]).toMatchObject({ id: kept.id, url: kept.url, collectedAt: kept.collectedAt, category: editorialCategories[0] })
    expect(next.collectedAt).toBe(previous.collectedAt)
    expect(next.sources[0].error).toBe('HTTP 503')
    expect(articleSchema.parse(previous.items[0]).category).toBe('Design e criatividade')
  })

  it('trata um RSS válido sem itens pertinentes como fonte disponível', async () => {
    const general = { ...source, editorialProfile: 'adjacent' as const }
    const result = await collect([general], null, async () => rss('https://example.org/b', 'Selic e inflação'), now)
    expect(result.sources[0]).toMatchObject({ count: 0, error: undefined })
    expect(result.collectedAt).toBe(now.toISOString())
    expect(result.items).toEqual([])
  })
})

describe('pauta criativa', () => {
  const item = (title: string, summary?: string) => ({
    ...parseFeed(rss('https://example.org/story', 'Fixture'), source, now.toISOString())[0], title, summary,
  })
  const general = { ...source, editorialProfile: 'adjacent' as const }
  it.each([
    ['Estúdio apresenta nova identidade visual para festival', 0],
    ['A new typeface for science museums', 1],
    ['Agência apresenta filme publicitário do banco', 2],
    ['How production design changed the film', 3],
    ['Uma nova estratégia de acessibilidade digital', 4],
    ['Novidades no Photoshop para ilustradores', 5],
    ['Design industry expands in the UK', 6],
  ])('classifica %s pela evidência editorial', (title, category) => {
    expect(classifyArticle(item(title), general)?.article.editorial).toEqual({ scope: 'adjacent', category: editorialCategories[category] })
  })
  it('exige contexto verificável em fontes amplas, incluindo nas tendências', () => {
    expect(classifyArticle({ ...item('Inflação e taxa de juros'), trend: 'branding' }, general)).toBeUndefined()
    expect(classifyArticle(item('Vacinação nas capitais'), general)).toBeUndefined()
    expect(classifyArticle(item('Novo hospital inaugurado'), general)).toBeUndefined()
    expect(classifyArticle(item('Novo hospital inaugurado', 'O projeto de wayfinding facilita a circulação.'), general)?.article.category).toBe(editorialCategories[3])
    expect(classifyArticle(item('Best laptop deals'), source)).toBeUndefined()
    expect(classifyArticle({ ...item('GWM apresenta seu novo filme'), feedTags: ['Criatividade'] },
      { ...source, editorialProfile: 'selective', category: editorialCategories[2], editorialTags: ['Criatividade'] })?.article.category).toBe(editorialCategories[2])
  })
  it('privilegia os pilares, alterna publicações e limita conteúdo adjacente quando há material direto', () => {
    const ranked = [
      ...Array.from({ length: 6 }, (_, i) => ({ ...classifyArticle(item('Novo logotipo'), source)!, index: i })),
      ...Array.from({ length: 2 }, (_, i) => ({ ...classifyArticle(item('Direção de arte para exposição'), source)!, index: i + 6 })),
      ...Array.from({ length: 6 }, (_, i) => ({ ...classifyArticle(item('Art installation em Berlim'), general)!, index: i + 8 })),
    ].map(row => ({ ...row, article: { ...row.article, id: row.index.toString(16).padStart(32, '0'), source: row.index < 6 ? 'A' : row.index < 8 ? 'B' : 'C' } }))
    const edition = orderEdition(ranked)
    expect(edition[0].category).toBe(editorialCategories[0])
    expect(edition.slice(0, 2).map(article => article.source)).toEqual(['A', 'B'])
    expect(edition.filter(article => article.editorial?.scope === 'adjacent')).toHaveLength(2)
    expect(edition[4].editorial?.scope).toBe('adjacent')
  })
})
