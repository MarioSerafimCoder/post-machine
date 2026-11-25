import { z } from 'zod'
import type { Content } from './contract'

export const slideIdSchema = z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/)

/** Assign only at a persistence boundary, never during comparison of stored revisions. */
export function identifyContent(content: Content, previous?: Content): Content {
  const seen = new Set<string>()
  const signature = (slide: Content['slides'][number]) => JSON.stringify([slide.role, slide.title, slide.body, slide.imageBrief])
  return { ...content, slides: content.slides.map(slide => {
    const matches = previous?.slides.filter(old => old.id && signature(old) === signature(slide)) ?? []
    const unambiguous = matches.length === 1 && content.slides.filter(other => signature(other) === signature(slide)).length === 1
    const candidate = slide.id ?? (unambiguous ? matches[0].id : undefined)
    const id = candidate && !seen.has(candidate) ? candidate : crypto.randomUUID()
    seen.add(id)
    return { ...slide, id }
  }) }
}
