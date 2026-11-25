import { describe, expect, it } from 'vitest'
import { backupSchema, createPrompt, defaultPreferences, importContent, markdownExample, newDraft } from './contract'
import type { Article } from '../radar/contract'

const article: Article = {
  id: '0'.repeat(32), title: 'Notícia de teste', source: 'Fonte de teste', category: 'Design',
  feedId: 'teste', url: 'https://example.com/original', canonicalUrl: 'https://example.com/original',
  collectedAt: '2026-11-14T10:00:00.000Z', publishedAt: null,
}
const draft = newDraft(article, defaultPreferences)
const post = { ...draft, briefing: { ...draft.briefing, format: 'post' as const } }

describe('contrato editorial', () => {
  it('preserva os campos visuais opcionais do JSON v1 e valida as entradas', () => {
    const legacy = importContent(markdownExample, post)
    const visual = { subject: 'How 15% Saved Christmas', campaignName: 'How 15% Saved Christmas', entities: ['GEICO'],
      year: 2026, mediaType: 'Filme', searchQueries: ['GEICO How 15% Saved Christmas'], preferredSources: ['https://www.geico.com/about/'],
      excludedSubjects: ['Natal genérico'] }
    const slideVisual = { visualIntent: 'Still da campanha', searchQueries: ['How 15% Saved Christmas still'],
      preferredSourceUrls: ['https://www.geico.com/about/'], imageType: 'Still', visualCandidates: [{
        imageUrl: 'https://www.geico.com/still.jpg', sourceUrl: 'https://www.geico.com/about/', description: 'Still do filme com os bonecos.',
      }] }
    const extended = { ...legacy, campaign: { ...legacy.campaign, visualContext: visual },
      slides: [{ ...legacy.slides[0], visualContext: slideVisual }] }
    expect(importContent(JSON.stringify(extended))).toEqual(extended)
    expect(() => importContent(JSON.stringify({ ...extended, campaign: { ...extended.campaign,
      visualContext: { ...visual, preferredSources: ['https://192.168.1.1/'] } } }))).toThrow()
    expect(() => importContent(JSON.stringify(extended).replace('https://www.geico.com/still.jpg', 'https://127.0.0.1/private.jpg'))).toThrow()
  })

  it('inclui o briefing, a fonte, regras factuais e a sequência no prompt', () => {
    const prompt = createPrompt({ ...draft, briefing: { ...draft.briefing, slideCount: 3, audience: 'Designers' } })
    expect(prompt).toContain(article.url)
    expect(prompt).toContain('Designers')
    expect(prompt).toContain('Separe fatos verificáveis, interpretações e opiniões')
    expect(prompt).toContain('Jamais invente URLs')
    expect(prompt).toContain('visualCandidates')
    expect(prompt.match(/"order":/g)).toHaveLength(3)
  })

  it('importa Markdown e JSON cercado, preservando a fonte original', () => {
    const markdown = importContent(markdownExample, post)
    expect(markdown.sources[0].url).toBe(article.url)
    expect(markdown.sources[0].publishedAt).toBeNull()
    expect(markdown.slides[0].imageBrief).toBe('Sugestão de imagem.')
    const fenced = '\x60\x60\x60json\n' + JSON.stringify(markdown) + '\n\x60\x60\x60'
    expect(importContent(fenced, post)).toEqual(markdown)
  })

  it('importa datas de fontes com precisão preservada, aceita ausência e rejeita datas indefinidas', () => {
    const base = importContent(markdownExample, post)
    const sources = [
      { title: 'Data conhecida', url: 'https://example.com/a', publishedAt: '2026-11-18' },
      { title: 'Hora conhecida', url: 'https://example.com/b', publishedAt: '2026-11-18T10:15:49.000Z' },
      { title: 'Sem data', url: 'https://example.com/c', publishedAt: null },
      { title: 'Data vazia', url: 'https://example.com/d', publishedAt: '' },
      { title: 'Data omitida', url: 'https://example.com/e' },
    ]
    const result = importContent(JSON.stringify({ ...base, sources }), post)
    expect(result.sources.map(source => source.publishedAt)).toEqual([
      null, '2026-11-18', '2026-11-18T10:15:49.000Z', null, null, null,
    ])
    expect(() => importContent(JSON.stringify({
      ...base, sources: [{ ...sources[0], publishedAt: 'ontem' }],
    }), post)).toThrow(/sources\.0\.publishedAt.*AAAA-MM-DD/)
  })

  it('rejeita campos ausentes, referências inseguras e quantidade divergente', () => {
    expect(() => importContent('{}', post)).toThrow('schemaVersion')
    expect(() => importContent(markdownExample.replace('https://example.com/artigo', 'javascript:alert(1)'), post)).toThrow('sources.0.url')
    expect(() => importContent(markdownExample.replace('Função: content\n', ''), post)).toThrow('Função')
    expect(() => importContent(markdownExample, draft)).toThrow('Carrossel')
  })

  it('usa o formato do briefing quando a quantidade da resposta é compatível', () => {
    const result = importContent(markdownExample.replace('Formato: post', 'Formato: carousel'), post)
    expect(result.campaign.format).toBe('post')
    expect(result.slides).toHaveLength(1)
  })

  it('mantém texto importado como dados e valida o backup inteiro', () => {
    const content = importContent(markdownExample.replace('Texto da peça.', '<img src=x onerror=alert(1)>'), post)
    expect(content.slides[0].body).toBe('<img src=x onerror=alert(1)>')
    const backup = { schemaVersion: 1, campaigns: [{ ...post, content }], preferences: defaultPreferences }
    expect(backupSchema.parse(backup).campaigns[0].content).toEqual(content)
    expect(backupSchema.safeParse({ ...backup, campaigns: [...backup.campaigns, ...backup.campaigns] }).success).toBe(false)
  })
})


it('aceita IDs opcionais v1 e descarta IDs inválidos ou repetidos sem rejeitar o conteúdo', () => {
  const base = { schemaVersion: 1, campaign: { title: 'Teste', objective: 'Informar', audience: '', tone: 'Direto', format: 'carousel', caption: '', cta: '' }, sources: [],
    slides: [{ order: 1, role: 'content', title: 'A', body: '', imageBrief: '', layoutType: 'editorial' }] }
  expect(importContent(JSON.stringify({ ...base, slides: [{ ...base.slides[0], id: 'slide-1' }] })).slides[0].id).toBe('slide-1')
  expect(importContent(JSON.stringify({ ...base, slides: [{ ...base.slides[0], id: {} }] })).slides[0].id).toBeUndefined()
  const slides = importContent(JSON.stringify({ ...base, slides: [{ ...base.slides[0], id: 'igual' }, { ...base.slides[0], order: 2, id: 'igual' }] })).slides
  expect(slides.every(slide => slide.id === undefined)).toBe(true)
})
