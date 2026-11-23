import { maxSlides, originalSource, type Content, type Draft, type Slide } from '../campaigns/contract'
import { bodyLimit, parseExpress, titleLimit } from './expressContent'

function paragraphs(body: string, language = 'pt-BR') {
  const blocks = body.trim().split(/\n[ \t]*\n/).map(part => part.trim()).filter(Boolean)
  if (blocks.length !== 1 || blocks[0].length < 220) return blocks
  const sentences = [...new Intl.Segmenter(language === 'en' ? 'en' : 'pt-BR', { granularity: 'sentence' }).segment(blocks[0])]
  const groups: string[] = []
  let current = ''
  for (const { segment } of sentences) {
    if (current.length >= 120 && groups.length < maxSlides - 2) {
      groups.push(current.trim())
      current = ''
    }
    current += segment
  }
  if (current.trim()) groups.push(current.trim())
  return groups
}

function assemble(draft: Draft, slides: Pick<Slide, 'title' | 'subtitle' | 'body'>[], caption = ''): Content {
  if (slides.length > maxSlides) throw Error(`Use até ${maxSlides} slides por projeto ou divida o material em partes.`)
  const format = slides.length > 1 ? 'carousel' : draft.briefing.format === 'story' ? 'story' : 'post'
  return {
    schemaVersion: 1,
    campaign: { title: slides[0].title || draft.title, format, caption, cta: '',
      objective: draft.briefing.objective, audience: draft.briefing.audience, tone: draft.briefing.tone },
    sources: draft.article ? [originalSource(draft.article)] : [],
    slides: slides.map((slide, index) => {
      if (slide.title.length > titleLimit || (slide.subtitle?.length ?? 0) > titleLimit || slide.body.length > bodyLimit) {
        throw Error(`Divida a peça ${index + 1} em textos menores. O conteúdo colado continua disponível para editar.`)
      }
      return { ...slide, order: index + 1, imageBrief: '', layoutType: 'editorial',
        role: index === 0 ? 'cover' : index === slides.length - 1 && slides.length > 2 ? 'cta' : 'content' }
    }),
  }
}

export function prepareArticleContent(draft: Draft): Content {
  if (draft.content) return draft.content
  const summary = draft.article?.summary?.trim() ?? ''
  const title = draft.article?.title ?? draft.title
  const sections = paragraphs(summary, draft.article?.language)
  const plain = draft.briefing.format !== 'carousel' || sections.length < 2
  return assemble(draft, plain ? [{ title, body: summary }] : [
    { title, body: '' }, ...sections.map(body => ({ title: '', body })),
  ], summary)
}

export function preparePastedContent(raw: string, draft: Draft): Content {
  const parsed = parseExpress(raw)
  if (parsed.structured) {
    const original = draft.article && originalSource(draft.article)
    if (!original) return parsed.structured
    const sources = parsed.structured.sources.filter(item => item.url !== original.url)
    return { ...parsed.structured, sources: [original, ...sources].slice(0, 50) }
  }
  const slides = parsed.slides.map(slide => {
    const subtitle = /^(?:Subtítulo:[ \t]*|##[ \t]+)([^\n]+)(?:\n|$)/i.exec(slide.body)
    return { title: slide.title, subtitle: subtitle?.[1].trim(),
      body: subtitle ? slide.body.slice(subtitle[0].length).trim().replace(/^(?:Corpo|Texto):[ \t]*/i, '') : slide.body }
  })
  if (slides.length === 1) {
    const [first] = slides
    const blocks = paragraphs(first.body)
    if (blocks.length > 1) {
      if (first.title) return assemble(draft, [{ ...first, body: '' }, ...blocks.map(body => ({ title: '', body }))])
      return assemble(draft, blocks.map((body, index) => ({ title: '', subtitle: index === 0 ? first.subtitle : undefined, body })))
    }
  }
  return assemble(draft, slides)
}
