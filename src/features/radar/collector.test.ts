// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { canonical, collect, fetchFeed, parseFeed } from '../../../radar/collect.ts'
import { sourceSchema } from './contract'

const now = new Date('2026-01-10T12:00:00Z')
const source = sourceSchema.parse({ id: 'fixture', name: 'Fixture', url: 'https://example.org/rss', category: 'Design', kind: 'rss' })
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
    const result = await collect([source,{ ...source,id:'other' },{ ...source,id:'duplicate' },{ ...source,id:'down' }],null,{},async feed => {
      if (feed.id === 'down') throw Error('HTTP 503')
      if (feed.id === 'duplicate') return rss('https://example.org/a?utm_source=fixture', 'Outro título na mesma URL')
      return rss(`https://example.org/${feed.id === 'other' ? 'b' : 'a'}`, feed.id === 'other' ? 'Uma notícia de teste sobre design local!' : undefined)
    },now)
    expect(result.items).toHaveLength(1)
    expect(result.sources.at(-1)?.error).toBe('HTTP 503')
    const next = await collect([source],result,{},async () => { throw Error('Timeout') },new Date('2026-02-01T12:00:00Z'))
    expect(next.items).toEqual(result.items)
    expect(next.collectedAt).toBe(result.collectedAt)
    expect(next.attemptedAt).not.toBe(result.attemptedAt)
  })
  it('classifica Trends e usa o link da notícia sem atribuir a data da tendência', () => {
    const xml = '<rss xmlns:ht="https://example.org"><channel><item><title>inflação</title><pubDate>2026-01-10</pubDate><ht:news_item><ht:news_item_title>Título da fixture</ht:news_item_title><ht:news_item_url>https://example.org/noticia</ht:news_item_url><ht:news_item_source>Editor</ht:news_item_source></ht:news_item></item></channel></rss>'
    const [item] = parseFeed(xml,{ ...source, kind:'trends' },now.toISOString(),{ Economia:['inflação'] })
    expect(item).toMatchObject({ category:'Economia', publishedAt:null, trend:'inflação', source:'Editor', url:'https://example.org/noticia' })
  })
})
