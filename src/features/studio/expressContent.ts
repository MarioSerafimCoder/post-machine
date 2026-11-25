import { importContent, maxImport, maxSlides, type Briefing, type Content } from '../campaigns/contract'
import type { CollectionSlide } from './collections'
import type { Input } from './factory/planning'
import { textLayout } from '../images/visualContext'

export const titleLimit = 500
export const bodyLimit = 8000

export function fromStructured(content: Content, briefing?: Briefing) {
  return content.slides.map(slide => ({
    id: slide.id, layoutType: slide.layoutType, title: slide.title, subtitle: slide.subtitle, body: slide.body, role: slide.role, imageBrief: slide.imageBrief, visualContext: slide.visualContext,
    headlines: slide.headlines, cta: slide.role === 'cta' || content.slides.length === 1 ? content.campaign.cta : '',
    ...(textLayout(slide.layoutType) ? { imageId: null } : {}),
    intent: explicitIntent(slide.layoutType) ?? (slide.role === 'content' && briefing?.approach === 'Comparação' &&
      briefing.acceptedRules?.includes('SRC-005') ? 'comparison' as const : undefined),
  }))
}

function explicitIntent(layout: string): CollectionSlide['intent'] {
  const label = layout.trim().toLowerCase()
  if (['comparison','comparativo','comparação'].includes(label)) return 'comparison'
  if (['highlight','destaque','quote','citação'].includes(label)) return 'highlight'
  return undefined
}

export function parseExpress(input: string): { slides: Input[]; structured?: Content } {
  const text = input.replace(/\r\n?/g, '\n').trim()
    .replace(/^```(?:json|md|markdown|txt|text)?[ \t]*\n([\s\S]*?)\n```$/i, '$1').trim()
  if (!text) throw Error('Cole o conteúdo antes de organizar os slides.')
  if (text.length > maxImport) throw Error('O conteúdo excede o limite de 250 mil caracteres.')
  if (/^(?:\{|\[|# Campanha\b)/i.test(text)) {
    const structured = importContent(text)
    return { slides: fromStructured(structured), structured }
  }
  const marker = /^(?:#{1,6}[ \t]+)?slide[ \t]+\d+[ \t]*(?:(?:[-–—:.])[ \t]*(.*))?$/gim
  const sections = [...text.matchAll(marker)]
  if (sections.length > maxSlides) throw Error(`Use até ${maxSlides} slides por projeto.`)
  const blocks = sections.length ? sections.map((match,index) => {
    const preamble = index === 0 ? text.slice(0,match.index).trim() : ''
    const body = text.slice(match.index + match[0].length, sections[index+1]?.index).trim()
    return { heading:match[1], text:[preamble,body].filter(Boolean).join('\n\n') }
  }) : [{ heading: undefined, text }]
  return { slides: blocks.map(block => {
    const explicit = block.heading ? null : /^Título:[ \t]*(.*)(?:\n|$)/i.exec(block.text)
      ?? /^#{1,6}[ \t]+([^\n]+)(?:\n|$)/.exec(block.text)
    const separator = /\n{2,}/.exec(block.text)
    const first = separator ? block.text.slice(0,separator.index) : ''
    const heading = block.heading || explicit?.[1] || (first && !first.includes('\n') && first.length < 120 ? first : '')
    const body = explicit ? block.text.slice(explicit[0].length) :
      !block.heading && heading && separator ? block.text.slice(separator.index+separator[0].length) : block.text
    return { title: heading, body: body.trim().replace(/^(?:Corpo|Texto):[ \t]*/i,'') }
  }) }
}
