import { collections, type Collection } from '../collections'
import type { Format } from '../model'
import type { Input } from './planning'
import type { Proposal } from './fabricate'
import { requiresReview } from './evaluate'

// Content-based direction only selects among the existing editable collections.
export function chooseCollection(slides: readonly Input[], format: Format, hasImages: boolean,
  current: Collection, alternate = 0): Collection {
  const text = slides.map(slide => [slide.title, slide.body, slide.imageBrief, slide.visualContext?.subject,
    slide.visualContext?.visualIntent, slide.visualContext?.imageType].filter(Boolean).join(' ')).join(' ').toLowerCase()
  const long = slides.some(slide => slide.body.length > 420)
  const comparison = slides.some(slide => slide.intent === 'comparison' || /compar(a|ação|ativo)|versus|antes e depois/.test(slide.title.toLowerCase()))
  const visual = hasImages || slides.some(slide => !!slide.image || !!slide.imageBrief?.trim())
  const candidates = comparison ? ['swiss', 'modular', 'minimal'] :
    /embalagem|identidade visual|branding|marca|tipografia/.test(text) ? ['minimal', 'swiss', 'magazine'] :
    visual && !long ? ['photo', 'magazine', 'minimal'] : long ? ['magazine', 'minimal', 'modular'] : ['minimal', 'bold', 'swiss']
  const ordered = candidates.map(id => collections.find(item => item.id === id)).filter((item): item is Collection => !!item && item.formats.includes(format))
  return ordered[alternate % ordered.length] ?? current
}

export function chooseProposal(proposals: readonly Proposal[]): Proposal {
  return [...proposals].sort((a, b) => {
    const score = (value: Proposal) => {
      const severe = value.details.flatMap(detail => detail.issues).filter(issue =>
        requiresReview(issue) && /excede|ultrapassa|sobreposição|contraste/.test(issue.message)).length
      const review = value.details.flatMap(detail => detail.issues).filter(requiresReview).length
      const layouts = new Set(value.details.map(detail => detail.composition)).size
      return severe * 100 + review * 10 - layouts
    }
    return score(a) - score(b)
  })[0]
}
