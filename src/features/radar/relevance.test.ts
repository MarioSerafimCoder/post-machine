import { expect, test } from 'vitest'
import { editorialRelevance, preferenceChange, rankNews, relevanceWeights } from './relevance'
import type { Article } from './contract'
const now = Date.parse('2026-11-25T12:00:00Z')
const base: Article = { id: 'a'.repeat(32), title: 'Taxa de juros e inflação', source: 'The Verge', feedId: 'verge',
  category: 'Mercado criativo', url: 'https://www.theverge.com/news', canonicalUrl: 'https://www.theverge.com/news',
  publishedAt: new Date(now).toISOString(), collectedAt: new Date(now).toISOString() }
test('pesa contexto criativo acima de finanças e aceita esporte com abordagem de marca', () => {
  const creative = { ...base, id: 'b'.repeat(32), title: 'Football club reveals new brand identity', summary: 'Graphic design and packaging process', imageUrl: 'https://example.org/image.jpg' }
  expect(Object.values(relevanceWeights).reduce((a,b) => a+b,0)).toBeCloseTo(1)
  expect(rankNews([base, creative], now)[0]).toBe(creative)
  expect(editorialRelevance(creative, now)).toMatchObject({ forDesigners: true, highPotential: true })
  expect(editorialRelevance(base, now).forDesigners).toBe(false)
  expect(editorialRelevance({ ...creative, title: 'Black Friday deals buy now' }, now).score).toBeLessThan(editorialRelevance(creative, now).score)
})
test('limita aprendizado local e trata publicação futura ou ausente sem inventar atualidade', () => {
  let preferences = {}
  for (let i=0;i<100;i++) preferences = preferenceChange(preferences, base, 2)
  expect(Object.values(preferences)).toEqual([5])
  expect(editorialRelevance({ ...base, publishedAt: null }, now).score).toBeLessThan(editorialRelevance(base, now).score)
  expect(rankNews([base], now, preferences)).toEqual([base])
})

test('distingue trabalho visual de receita publicitária e oferta comercial', () => {
  const work = { ...base, title: 'A new identity inspired by local craft', summary: 'An independent studio created the wordmark and packaging.' }
  const business = { ...base, title: 'Advertising is a priority for the CEO', summary: 'Advertising revenue grows ten percent.' }
  const shopping = { ...base, title: 'Black Friday laptops for graphic designers', summary: 'Perfect for graphic design.' }
  expect(editorialRelevance(work, now).forDesigners).toBe(true)
  expect(editorialRelevance(business, now).forDesigners).toBe(false)
  expect(editorialRelevance(shopping, now).forDesigners).toBe(false)
  expect(editorialRelevance(work, now).score).toBeGreaterThan(editorialRelevance(shopping, now).score)
})
