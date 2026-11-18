import { describe, expect, it } from 'vitest'
import { contentSchema, createPrompt, defaultPreferences, draftSchema, newDraft, type Draft } from '../campaigns/contract'
import type { Article } from '../radar/contract'
import { fromStructured } from '../studio/expressContent'
import data from './catalog.json'
import { briefingInstructions, editorialContext, recommend, reviewEditorial } from './decision'
import { campaignScope, preferenceFor } from './feedback'
import { explainRule, knowledge, validateKnowledge } from './knowledge'

const date = '2026-11-16T00:00:00.000Z'
const article = (domain = 'example.org', summary?: string): Article => ({
  id: 'a'.repeat(32), title: 'Pesquisa investiga compartilhamento', url: `https://${domain}/artigo`, canonicalUrl: `https://${domain}/artigo`,
  source: domain, feedId: domain, category: 'Design', collectedAt: date, publishedAt: null, summary,
})
const withContent = (draft: Draft, title: string): Draft => ({ ...draft, content: contentSchema.parse({
  schemaVersion: 1, campaign: { title, objective: draft.briefing.objective, audience: '', tone: '', format: 'post', caption: '', cta: '' },
  sources: [], slides: [{ order: 1, role: 'content', title, body: 'Uma ideia editorial', imageBrief: '', layoutType: 'editorial' }],
}) })

describe('Editorial Intelligence', () => {
  it('valida o catálogo canônico e não confunde fontes com evidências', () => {
    expect([knowledge.rules.size, knowledge.sources.size, knowledge.evidence.size]).toEqual([38, 56, 3])
    expect(explainRule('TXT-001')).toMatchObject({ sources: [{ id: 'F07' }], evidence: [{ source_ids: ['F07'] }] })
    expect(() => validateKnowledge({ ...data, rules: [...data.rules, data.rules[0]] })).toThrow('ID duplicado')
    expect(() => validateKnowledge({ ...data, rules: [{ ...data.rules[0], sourceIds: ['F99'] }] })).toThrow('Referência inválida')
  })

  it('mantém uma fonte inacessível ou parcial como pendência e preserva a saída v1', () => {
    const draft = withContent(newDraft(article(), defaultPreferences), 'O estudo provou aumento de 80%')
    expect(editorialContext(draft).metadata).toContain('apenas título')
    expect(recommend(draft).find(item => item.id === 'SRC-002')?.assessment).toBe('insufficient_data')
    expect(reviewEditorial(draft).filter(item => ['SRC-001', 'SRC-002', 'TTL-003'].includes(item.ruleId!)).map(item => item.assessment)).toEqual(
      expect.arrayContaining(['needs_review', 'heuristic']),
    )
    const limited = { ...draft, briefing: { ...draft.briefing, sourceAccess: 'unavailable' as const, slideCount: 5 } }
    const prompt = createPrompt(limited, briefingInstructions(limited, recommend(limited)))
    expect(prompt).toContain('Acesso à fonte marcado como indisponível')
    expect(prompt).toContain('Peça 5: sintetize')
    expect(prompt).toContain('"schemaVersion": 1')
    expect(draftSchema.parse(limited).briefing.slideCount).toBe(5)
  })

  it('compara domínios distintos e exige revisão quando a divergência é declarada', () => {
    const first = article()
    const draft = newDraft(first, defaultPreferences, {
      type: 'Boa oportunidade de pauta', reason: 'Cobertura em dois domínios', angle: 'Comparação', approach: 'Explicação',
      articles: [first, { ...article('example.com'), id: 'b'.repeat(32) }],
    })
    expect(recommend(draft).find(item => item.id === 'comparar-fontes')).toMatchObject({
      patch: { approach: 'Comparação' }, alternative: expect.stringContaining('contextualização'),
    })
    const conflict = { ...draft, briefing: { ...draft.briefing, sourceConflict: true } }
    expect(recommend(conflict)[0]).toMatchObject({ id: 'SRC-005', assessment: 'needs_review' })
    expect(recommend(conflict).some(item => item.id === 'comparar-fontes')).toBe(false)
    expect(createPrompt(conflict, briefingInstructions(conflict, recommend(conflict)))).toContain(first.url)
  })

  it('limita preferências ao perfil escolhido e conserva o formato decidido pelo usuário', () => {
    const draft = newDraft(null, { ...defaultPreferences, audience: 'Diretores de arte' })
    const profiled = { ...draft, briefing: { ...draft.briefing, editorialProfile: 'Equipe A' } }
    const other = { ...draft, briefing: { ...draft.briefing, editorialProfile: 'Equipe B' } }
    const feedback = [{ at: date, scope: campaignScope(profiled), id: 'vis-1', preference: 'carousel', outcome: 'accepted' }] as const
    const forDraft = (item: Draft) => recommend(item, preference => preferenceFor([...feedback], campaignScope(item), preference))
    expect(forDraft(profiled).find(item => item.id === 'VIS-004')?.preference).toBe('carousel')
    expect(forDraft(other).find(item => item.id === 'VIS-004')?.preference).toBe('post')
    expect(createPrompt(other, briefingInstructions(other, forDraft(other)))).toContain('Formato: Carrossel | peças: 6')
  })

  it('sinaliza o limite documental do Pinterest com data e deixa CTA educativo opcional', () => {
    const draft = withContent(newDraft(null, defaultPreferences), 'X'.repeat(101))
    draft.briefing = { ...draft.briefing, format: 'post', channel: 'Pinterest', objective: 'Educar' }
    const findings = reviewEditorial(draft)
    expect(findings.find(item => item.id === 'pin-title')).toMatchObject({ ruleId: 'PLT-001', assessment: 'needs_review' })
    expect(findings.some(item => item.id === 'missing-cta')).toBe(false)
  })

  it('encaminha comparação aceita ao planejador sem substituir um layout explícito', () => {
    const draft = withContent(newDraft(null, defaultPreferences), 'Dois exemplos')
    const content = draft.content!
    const briefing = { ...draft.briefing, approach: 'Comparação' as const, acceptedRules: ['SRC-005'] }
    expect(fromStructured(content)[0].intent).toBeUndefined()
    expect(fromStructured(content, briefing)[0].intent).toBe('comparison')
    content.slides[0].layoutType = 'destaque'
    expect(fromStructured(content, briefing)[0].intent).toBe('highlight')
  })
})
