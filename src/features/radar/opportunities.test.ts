import { describe, expect, it } from 'vitest'
import { buildOpportunities, growthFor } from '../../../radar/opportunities.ts'
import { snapshotSchema, type Article, type Observation } from './contract'

const now = new Date('2026-11-16T15:00:00Z')
const at = now.toISOString()
const category = 'Design gráfico e tipografia'
function article(id: string, host: string, title: string, source = host): Article {
  const url = `https://${host}/${id}`
  return { id: id.repeat(32), url, canonicalUrl: url, title, source, feedId: source, category,
    editorial: { category, scope: 'direct' }, publishedAt: at, collectedAt: at }
}
const before: Observation = { query: 'Atelier Aurora', feed: 'https://example.org/rss?geo=BR',
  startedAt: '2026-11-16T02:00:00.000Z', at: '2026-11-16T09:00:00.000Z', bucket: 500 }
const after = { ...before, at, bucket: 1000 }

describe('oportunidades editoriais', () => {
  it('agrupa evidências do mesmo evento e evita repetição por veículo', () => {
    const a = article('a', 'editor.example.org', 'Estúdio publica cartazes Atelier Aurora Bienal')
    const b = article('b', 'outro.example.com', 'Cartazes Atelier Aurora Bienal ganham exposição')
    const syndicated = article('c', 'www.editor.example.org', a.title, a.source)
    const unrelated = article('d', 'terceiro.example.com', 'Bienal anuncia nova tipografia')
    const rows = buildOpportunities([a, b, unrelated], [syndicated], [], [], now)
    const group = rows.find(row => row.articles[0] === a)!
    expect(group.articles).toEqual([a, b])
    expect(group.reason).toContain('2 veículos')
    expect(group.type).not.toBe('Em alta')
    expect(rows.some(row => row.articles[0] === unrelated)).toBe(true)
  })

  it('requer aumento em observações comparáveis e vínculo da edição atual', () => {
    expect(growthFor(before.query, [after], [before], +now)).toEqual(after)
    expect(growthFor(before.query, [after], [], +now)).toBeUndefined()
    expect(growthFor(before.query, [after], [{ ...before, bucket: after.bucket }], +now)).toBeUndefined()
    expect(growthFor(before.query, [after], [{ ...before, feed: 'https://example.org/rss?geo=US' }], +now)).toBeUndefined()
    expect(growthFor(before.query, [after], [{ ...before, startedAt: before.at }], +now)).toBeUndefined()
    const item = { ...article('a', 'editor.example.org', 'Cartazes Atelier Aurora Bienal'), trend: before.query }
    expect(buildOpportunities([item], [], [after], [before], now)[0].type).not.toBe('Em alta')
    expect(buildOpportunities([item], [item], [after], [before], now)[0].type).toBe('Em alta')
  })

  it('separa conteúdo educativo de notícia recente e lê snapshots antigos', () => {
    const guide = article('a', 'editor.example.org', 'Guia de tipografia para cartazes')
    const news = article('b', 'editor.example.org', 'Atelier lança nova tipografia original')
    expect(buildOpportunities([guide, news], [], [], [], now).map(row => row.type))
      .toEqual(['Assunto do momento', 'Conteúdo atemporal'])
    expect(snapshotSchema.parse({ version: 1, items: [guide], sources: [], collectedAt: at, attemptedAt: at }).opportunities).toBeUndefined()
  })
})
