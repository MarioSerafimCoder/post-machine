import { describe, expect, it } from 'vitest'
import { evaluateCandidate, evaluateCatalog, requestFor, similarImage } from './automaticSearch'
import type { DocumentaryAsset } from './documentaryContract'
import { campaignContext, needsImage, researchUrl } from './visualContext'
import type { ImageCredit } from './contract'

const page = 'https://www.geico.com/about/pressreleases/2026/20261123/'
const copy = { title: 'Um filme feito à mão', role: 'cover', imageBrief: 'Still de How 15% Saved Christmas' }
const source = { title: "GEICO rolls into its first Macy’s Thanksgiving Day Parade and premieres 'How 15% Saved Christmas'", url: page }
const visual = {
  subject: 'GEICO estreia How 15% Saved Christmas', campaignName: 'How 15% Saved Christmas', year: 2026,
  entities: ['GEICO', 'Screen Novelties'], excludedSubjects: ['Road Trip to Parade'], mediaType: 'stop-motion holiday film',
}
const context = campaignContext({ title: 'Um filme feito à mão', sources: [source], visual, slides: [copy] })
const request = requestFor('project/cover', copy, context, 1.2)!
const film: DocumentaryAsset = {
  page, provider: 'official', evidence: 'body',
  url: 'https://www.geico.com/public/images/aboutgeico/GEICO_15_Percent_Saved_Christmas.jpg',
  caption: 'GEICO - How 15 Percent Saved Christmas - 11-23-26', title: source.title,
  width: 1200, height: 629, ticket: '',
}

describe('inteligência visual documental', () => {
  it('leva o nome completo da campanha à busca mesmo quando a headline o omite', () => {
    expect(context.query).toBe('GEICO How 15% Saved Christmas stop-motion holiday film 2026')
    expect(context.names).toContain('Screen Novelties')
    expect(evaluateCandidate(film, request)).toMatchObject({ match: { classification: 'confirmed' } })
    const next = campaignContext({ title: 'Um filme feito à mão', sources: [{ ...source, url: 'https://www.geico.com/about/pressreleases/' }], visual, slides: [copy] })
    expect(requestFor('project/cover', copy, next, 1.2)?.signature).not.toBe(request.signature)
    expect(requestFor('project/cover', copy, context, 1.6)?.signature).toBe(request.signature)
    expect(requestFor('project/cover', copy, context, 1.2, 1)?.signature).not.toBe(request.signature)
  })
  it('rejeita Natal genérico e material do desfile mesmo quando a página menciona o filme', () => {
    expect(evaluateCandidate({ ...film, page: 'https://www.flickr.com/photo', provider: 'brave', evidence: 'search',
      title: 'Christmas puppets in New York', caption: undefined }, request)).toEqual({ score: 0, rejected: true })
    expect(evaluateCandidate({ ...film, caption: 'Road Trip to Parade: GEICO float' }, request)).toEqual({ score: 0, rejected: true })
    expect(evaluateCandidate({ ...film, provider: 'brave', evidence: 'search' }, request)).toMatchObject({ match: { classification: 'related' } })
  })
  it('reconhece campanhas animadas reais e reserva os bastidores para a peça que os pede', () => {
    const bts = { ...film, evidence: 'poster' as const, section: 'Behind the scenes with Screen Novelties',
      caption: 'How 15% Saved Christmas — puppet making and animation' }
    const copy = { title: 'Puppet making', body: 'Behind the scenes with Screen Novelties', role: 'content' }
    expect(evaluateCandidate(bts, requestFor('project/bts', copy, context, 1)!)).toMatchObject({ match: { classification: 'confirmed' } })
    expect(needsImage({ title: 'Composição exclusivamente tipográfica', visualContext: { imageType: 'textual' } })).toBe(false)
    expect(needsImage({ title: 'Leia a legenda', role: 'cta' })).toBe(false)
  })
  it('usa Openverse como apoio com relevância e mantém correspondência de página original', () => {
    const credit: ImageCredit = { schemaVersion: 1, provider: 'openverse', sourceId: '762ec81b-3312-40d6-8ce2-e70aa6b43465',
      retrievedAt: '2026-11-24T10:00:00Z', sourcePage: page }
    expect(evaluateCatalog(credit, 'Fotografia da matéria', request, false)?.match.classification).toBe('confirmed')
    expect(evaluateCatalog({ ...credit, sourcePage: 'https://www.flickr.com/photo' }, 'Christmas puppets documentary', request, false)).toBeUndefined()
    expect(similarImage('09abcdabcd123456', new Set(['foto:09abcdabcd123457']))).toBe(true)
  })
  it('aceita destinos HTTPS públicos com URLs relativas resolvidas e elimina destinos privados', () => {
    expect(researchUrl('/frames/film.jpg', page)?.href).toBe('https://www.geico.com/frames/film.jpg')
    expect(['http://example.com/image', 'https://127.0.0.1/a', 'https://user@example.com/a', 'https://local.test/a']
      .map(url => !!researchUrl(url))).toEqual([false, false, false, false])
  })
})
