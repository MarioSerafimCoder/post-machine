import { describe, expect, it } from 'vitest'
import { evaluateCandidate, evaluateCatalog, prioritizedImageQueries, requestFor, similarImage } from './automaticSearch'
import type { DocumentaryAsset } from './documentaryContract'
import { campaignContext, needsImage, researchUrl } from './visualContext'
import { narrativeAssignment } from './visualAllocation'
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
  it('separa material recomendado e retratos de contexto da peça documental da pauta', () => {
    const title = 'Could these brands change for the next film starring Alex Example?'
    const url = 'https://www.example.com/brand-placement/'
    const cover = { title, role: 'cover' }
    const campaign = campaignContext({ title, sources: [{ title, url }], slides: [cover] })
    const target = requestFor('project/cover', cover, campaign, .8)!
    const portrait = { ...film, page: url, provider: 'original' as const, evidence: 'structured' as const,
      title, url: 'https://www.example.com/alex-example.jpg', caption: 'Alex Example' }
    expect(evaluateCandidate(portrait, target)).toMatchObject({ match: { classification: 'support' } })
    const podcast = { ...portrait, evidence: 'body' as const, caption: 'Podcast on a different subject', section: 'Recommended programme' }
    expect(evaluateCandidate(podcast, target)).toMatchObject({ rejected: true, reason: 'unrelated_media_in_article' })
  })
  it('exige que a imagem represente a inserção de produto pedida no detalhe', () => {
    const detail = { title: 'Um exemplo de product placement', imageBrief: 'O product placement no filme', role: 'content' }
    const target = requestFor('project/detail', detail, context, 1)!
    expect(evaluateCandidate(film, target)).toMatchObject({ rejected: true, reason: 'specific_object_not_shown' })
    expect(evaluateCandidate({ ...film, caption: film.caption + ' — product placement' }, target)).toMatchObject({ match: { classification: 'confirmed' } })
  })
  it('usa as entidades e incompatibilidades declaradas em cada slide', () => {
    const detail = { title: 'O cenário da oficina', role: 'content',
      visualContext: { subject: 'Oficina de marionetes', entities: ['Screen Novelties'], excludedSubjects: ['Macy’s'], year: 2026 } }
    const target = requestFor('project/detail', detail, context, 1)!
    expect(evaluateCandidate({ ...film, caption: 'How 15 Percent Saved Christmas at Macy’s' }, target))
      .toMatchObject({ rejected: true, reason: 'excluded_subject' })
    expect(evaluateCandidate(film, target)).toMatchObject({ rejected: true, reason: 'slide_subject_not_established' })
    expect(evaluateCandidate({ ...film, caption: 'How 15 Percent Saved Christmas — oficina de marionetes na Screen Novelties' }, target))
      .toMatchObject({ match: { classification: 'confirmed' } })
  })
  it('não confirma a nova identidade visual apenas pelo título de uma foto estruturada', () => {
    const title = 'McLaren evolves its identity with a new wordmark'
    const url = 'https://www.creativeboom.com/news/mclaren-identity/'
    const identity = campaignContext({ title, sources: [{ title, url }], slides: [{ title, role: 'cover' }] })
    const cover = requestFor('project/identity', { title, role: 'cover' }, identity, 1.2)!
    const structured: DocumentaryAsset = { page: url, provider: 'original', evidence: 'structured',
      title, url: 'https://media.creativeboom.com/images/hero.webp', width: 1280, height: 809, ticket: '' }
    expect(evaluateCandidate(structured, cover)).toMatchObject({ match: { classification: 'related' } })
    expect(evaluateCandidate({ ...structured, caption: 'The new McLaren wordmark applied to the car' }, cover))
      .toMatchObject({ match: { classification: 'confirmed' } })
  })
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
      title: 'Christmas puppets in New York', caption: undefined }, request)).toMatchObject({ score: 0, rejected: true })
    expect(evaluateCandidate({ ...film, caption: 'Road Trip to Parade: GEICO float' }, request)).toMatchObject({ score: 0, rejected: true })
    expect(evaluateCandidate({ ...film, caption: 'Frame do filme “Winter Adventure”' }, request)).toMatchObject({ score: 0, rejected: true })
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
  it('constrói buscas por objeto e rejeita resultados de marca sem evidência do objeto pedido', () => {
    const brand = campaignContext({ title: 'Mudança de identidade visual', visual: {
      subject: 'McLaren apresenta sua nova identidade visual', entities: ['McLaren'],
    }, slides: [{ title: 'O novo logotipo', imageBrief: 'Wordmark e emblema revisados da marca' }] })
    const markRequest = requestFor('brand/logo', { title: 'O novo logotipo', imageBrief: 'Wordmark e emblema revisados da marca' }, brand, 1.2)!
    expect(markRequest.imageQueries[0]).toContain('McLaren')
    expect(markRequest.imageQueries[0]).toMatch(/Wordmark|emblema/i)
    const car = { ...film, page: 'https://images.example.test/article', provider: 'brave' as const,
      evidence: 'search' as const, url: 'https://images.example.test/mclaren-race-car.jpg', caption: undefined,
      title: 'McLaren 750S racing on track', description: 'A sports car at the circuit' }
    expect(evaluateCandidate(car, markRequest)).toMatchObject({ score: 0, rejected: true })

    const packageCopy = { title: 'A nova embalagem', imageBrief: 'Vista frontal da embalagem de varejo Riff' }
    const packaging = campaignContext({ title: 'A Riff apresenta novas embalagens', visual: {
      subject: 'Riff apresenta novas embalagens', entities: ['Riff'],
    }, slides: [packageCopy] })
    const packageRequest = requestFor('riff/package', packageCopy, packaging, 1.2)!
    const facade = { ...car, url: 'https://images.example.test/riff-campus.jpg', title: 'Riff headquarters exterior',
      description: 'The company headquarters and office facade' }
    expect(packageRequest.imageQueries[0]).toMatch(/Riff.*embalagem/i)
    expect(evaluateCandidate(facade, packageRequest)).toMatchObject({ score: 0, rejected: true })
  })
  it('usa metadados textuais do resultado Brave e distribui as consultas entre slides pendentes', () => {
    const searchTitle = evaluateCandidate({ ...film, page: 'https://press.example.com/story', provider: 'brave', evidence: 'search',
      url: 'https://media.example.com/opaque-file.jpg', caption: undefined,
      title: 'GEICO How 15% Saved Christmas official still frame', description: undefined }, request)
    expect(searchTitle).toMatchObject({ match: { classification: 'related' } })
    expect(prioritizedImageQueries([
      { imageQueries: ['capa A', 'detalhe A'] }, { imageQueries: ['capa B', 'detalhe B'] },
    ])).toEqual(['capa A', 'capa B', 'detalhe A', 'detalhe B'])
    expect(prioritizedImageQueries([
      { imageQueries: ['capa A', 'detalhe A'] }, { imageQueries: ['capa B', 'detalhe B'] },
    ], new Set(['capa A']))).toEqual(['capa B', 'detalhe A', 'detalhe B'])
  })
  it('usa Openverse como apoio com relevância e mantém correspondência de página original', () => {
    const credit: ImageCredit = { schemaVersion: 1, provider: 'openverse', sourceId: '762ec81b-3312-40d6-8ce2-e70aa6b43465',
      retrievedAt: '2026-11-24T10:00:00Z', sourcePage: page }
    expect(evaluateCatalog(credit, 'Still de How 15 Percent Saved Christmas', request, false)?.match.classification).toBe('confirmed')
    expect(evaluateCatalog(credit, 'Fotografia da matéria', request, false)).toBeUndefined()
    expect(evaluateCatalog({ ...credit, sourcePage: 'https://www.flickr.com/photo' }, 'Christmas puppets documentary', request, false)).toBeUndefined()
    expect(similarImage('09abcdabcd123456', new Set(['foto:09abcdabcd123457']))).toBe(true)
    expect(similarImage('09abcdabcd123456', new Set(['foto:09abcdabcd123457:0000000000000000']), 'eeeeeeeeeeeeeeee')).toBe(false)
  })
  it('reserva a única imagem elegível para o slide que depende dela', () => {
    const edge = (slide: string, asset: string, score: number) => ({
      request: { key: slide }, candidate: { credit: { sourceId: asset } }, score,
    })
    const cover = edge('cover', 'generic', 88)
    const workshop = edge('workshop', 'only-workshop', 90)
    expect(narrativeAssignment([edge('cover', 'only-workshop', 104), cover, workshop])).toEqual([workshop, cover])
  })
  it('aceita destinos HTTPS públicos com URLs relativas resolvidas e elimina destinos privados', () => {
    expect(researchUrl('/frames/film.jpg', page)?.href).toBe('https://www.geico.com/frames/film.jpg')
    expect(['http://example.com/image', 'https://127.0.0.1/a', 'https://user@example.com/a', 'https://local.test/a']
      .map(url => !!researchUrl(url))).toEqual([false, false, false, false])
  })
  it('mantém palavras inteiras ao combinar o objeto visual com a pauta', () => {
    const copy = { title: 'Nova marca', imageBrief: 'The redesigned Australian logo', role: 'cover' }
    const context = campaignContext({ title: "Australia’s latest culture war", visual: { entities: ['Australia'] }, slides: [copy] })
    expect(requestFor('project/cover', copy, context, .8)?.imageQueries[0]).toBe('Australia The redesigned Australian logo')
  })
  it('cobra evidência do objeto para alternativas a uma referência visual do slide', () => {
    const copy = { ...request.copy, visualContext: { visualIntent: 'Bonecos na oficina' } }
    const target = { ...request, copy }
    expect(evaluateCandidate(film, target, { cited: false, requireIntent: true })).toMatchObject({ rejected: true })
    expect(evaluateCandidate(film, target, { cited: true, requireIntent: true })).toMatchObject({ rejected: true })
    expect(evaluateCandidate({ ...film, caption: film.caption + ' bonecos na oficina' }, target, { cited: false, requireIntent: true }))
      .toMatchObject({ match: { classification: 'confirmed' } })
    const otherCampaign = { ...film, url: 'https://www.geico.com/weekend.jpg', caption: 'Weekend Escape — bonecos na oficina' }
    expect(evaluateCandidate(otherCampaign, target, { cited: true, requireIntent: true }))
      .toMatchObject({ rejected: true, reason: 'campaign_not_established_on_asset' })
  })
})
