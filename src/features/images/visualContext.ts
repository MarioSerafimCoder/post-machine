import { z } from 'zod'
import { normalize } from '../radar/contract'
import type { Article } from '../radar/contract'

export function researchUrl(value: string, base?: string) {
  if (!value || value.length > 2048 || /[\s\p{Cc}\\]/u.test(value)) return
  try {
    const url = new URL(value, base)
    if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      url.hostname.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(url.hostname) ||
      /\.(?:localhost|local|internal|test|invalid|example|onion|arpa|lan|home|corp)$/.test(url.hostname)) return
    url.hash = ''
    return url
  } catch { return }
}

const phrase = z.string().trim().min(1).max(240).regex(/^[^\p{Cc}]+$/u)
const publicUrl = z.string().trim().refine(value => !!researchUrl(value), 'Use uma URL HTTPS pública.')
const urls = z.array(publicUrl).max(8)
const visualCandidates = z.array(z.object({
  imageUrl: publicUrl, sourceUrl: publicUrl, description: phrase,
})).max(6)
const queries = z.array(phrase).max(6)
export const campaignVisualSchema = z.object({
  subject: phrase.optional(), entities: z.array(phrase).max(16).optional(), campaignName: phrase.optional(),
  year: z.number().int().min(1800).max(2100).optional(), mediaType: phrase.optional(), searchQueries: queries.optional(),
  preferredSources: urls.optional(), excludedSubjects: z.array(phrase).max(16).optional(), visualCandidates: visualCandidates.optional(),
})
export const slideVisualSchema = z.object({
  visualIntent: phrase.optional(), searchQueries: queries.optional(), preferredSourceUrls: urls.optional(), imageType: phrase.optional(),
  visualCandidates: visualCandidates.optional(),
})
export type CampaignVisual = z.infer<typeof campaignVisualSchema>
export type SlideVisual = z.infer<typeof slideVisualSchema>

export type VisualCopy = {
  title: string; body?: string; subtitle?: string; cta?: string; imageBrief?: string; role?: string; visualContext?: SlideVisual
}
type Source = { title: string; url: string; publishedAt?: string | null }
const stopWords = new Set('a as o os ao aos um uma umas uns de da das do dos no na nas nos em por para com sem que como mais sua seu suas seus sobre tema imagem imagens foto fotografia mostrar ilustrar slide cena exemplo exemplos conceito ideias ideia design editorial conteudo trabalho formato chamada acao usar veja saiba salve fez fazer parte proposta acontece ganharam reune the and for from with image photo show this that using'.split(' '))
export const words = (value = '') => [...new Set((normalize(value.slice(0, 8000)).match(/[\p{L}\p{N}]{2,}/gu) ?? [])
  .filter(word => word.length <= 48 && !stopWords.has(word)))]
export const phraseKey = (value = '') => normalize(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const unique = (values: (string | undefined)[]) => [...new Map(values.flatMap(value => value?.trim()
  ? [[phraseKey(value), value.trim()] as const] : [])).values()]
export const visualText = (slide: VisualCopy) => [slide.title, slide.subtitle, slide.body, slide.cta, slide.imageBrief,
  slide.visualContext?.visualIntent, slide.visualContext?.imageType].filter(Boolean).join(' ')
const noImage = /\b(sem (?:imagem|foto|fotografia)|apenas texto|somente texto|exclusivamente textual|no (?:image|photo)|text only|textual)\b/
export function needsImage(slide: VisualCopy) {
  const intent = phraseKey([slide.imageBrief, slide.visualContext?.visualIntent, slide.visualContext?.imageType].filter(Boolean).join(' '))
  return !noImage.test(intent) && (!!intent || !/^(cta|comparison|highlight)$/.test(slide.role ?? '')) && words(visualText(slide)).length > 0
}
export function textLayout(layout: string) {
  return /^(?:text|textual|somente texto|sem imagem|conteudo textual)$/.test(phraseKey(layout))
}

export function visualDigest(value: unknown) {
  const input = JSON.stringify(value)
  let left = 0x811c9dc5
  let right = 0x1b873593
  for (let index = 0; index < input.length; index++) {
    left = Math.imul(left ^ input.charCodeAt(index), 0x01000193)
    right = Math.imul(right ^ input.charCodeAt(index), 0x5bd1e995)
  }
  return [left, right].map(part => (part >>> 0).toString(16).padStart(8, '0')).join('')
}

function entitiesIn(text: string) {
  const quoted = [...text.matchAll(/[“"‘]([^”"’\n]{3,130})[”"’]|(?:^|\s)'([^'\n]{3,130})'(?=[\s.!?,]|$)/gu)]
    .map(match => match[1] ?? match[2])
  const possessives = [...text.matchAll(/\b(\p{Lu}[\p{L}\d]{3,})[’'](?:s\b|(?=\s))/gu)].map(match => match[1])
  const names = text.match(/\b(?:[A-Z\d]{2,}|\p{Lu}[\p{L}\d]+(?:[ -](?:(?:de|da|do|of|for|the) )?\p{Lu}[\p{L}\d]+)+)\b/gu) ?? []
  return unique([...quoted, ...names, ...possessives]).slice(0, 14)
}

export function campaignContext(input: {
  title: string; caption?: string; article?: Article | null; sources?: readonly Source[]; visual?: CampaignVisual; slides: readonly VisualCopy[]
}) {
  const { article, title, caption, visual, slides } = input
  const candidates: Source[] = [
    ...(article ? [{ title: article.title, url: article.url, publishedAt: article.publishedAt }] : []),
    ...input.sources ?? [],
    ...visual?.preferredSources?.map(url => ({ title: '', url })) ?? [],
    ...slides.flatMap(slide => slide.visualContext?.preferredSourceUrls?.map(url => ({ title: '', url })) ?? []),
  ]
  const sources = candidates.flatMap(source => {
    const url = researchUrl(source.url)
    return url ? [{ ...source, url: url.href }] : []
  }).filter((source, index, all) => all.findIndex(other => other.url === source.url) === index).slice(0, 16)
  const subject = visual?.subject || article?.title || sources.find(source => source.title)?.title || title || slides[0]?.title || ''
  const mainText = [subject, article?.summary, article?.source, article?.category, title, caption,
    ...sources.map(source => source.title), ...slides.map(visualText)].filter(Boolean).join('\n')
  const names = unique([visual?.campaignName, ...visual?.entities ?? [],
    ...entitiesIn([subject, article?.summary, ...sources.slice(0, 4).map(source => source.title)].filter(Boolean).join('\n')),
    ...entitiesIn(mainText)]).slice(0, 20)
  const year = visual?.year ?? (article?.publishedAt || sources[0]?.publishedAt)?.slice(0, 4)
  const name = visual?.campaignName
  const brand = name && visual.entities?.find(entity => phraseKey(subject).includes(phraseKey(entity)) && !phraseKey(name).includes(phraseKey(entity)))
  const query = unique([visual?.searchQueries?.[0], [brand, name || subject, visual?.mediaType,
    year && !subject.includes(String(year)) ? String(year) : undefined].filter(Boolean).join(' ')])[0]?.slice(0, 240)
  return {
    subject, names, year, sources, query, campaignName: visual?.campaignName ?? entitiesIn(subject).find(name => /\d/.test(name) && words(name).length > 2),
    language: article?.language, sourceImage: article?.imageUrl,
    excluded: visual?.excludedSubjects ?? [], extraQueries: visual?.searchQueries?.slice(1) ?? [],
    visualCandidates: visual?.visualCandidates ?? [],
    slideCandidates: slides.flatMap(slide => slide.visualContext?.visualCandidates ?? []),
    terms: words(mainText), primary: words([visual?.campaignName, subject].filter(Boolean).join(' ')),
    scope: visualDigest([article, input.sources, visual, title, sources.map(source => source.url)]),
    context: visualDigest([caption, mainText, slides.map(slide => slide.visualContext)]),
  }
}
export type CampaignContext = ReturnType<typeof campaignContext>

export function audiovisualIntent(copy: VisualCopy, subject = '') {
  const intent = [copy.visualContext?.imageType, copy.visualContext?.visualIntent, copy.imageBrief, copy.title,
    copy.role === 'cover' ? subject : ''].filter(Boolean).join(' ')
  return /\b(?:filme|film|trailer|teaser|comercial|commercial|video|videoclipe|bastidores|behind the scenes|making of|stop motion|audiovisual)\b/.test(phraseKey(intent))
}
