import type { Draft } from '../campaigns/contract'
import type { HeadlineContext } from './contract'

export function campaignHeadlineContext(draft: Draft): HeadlineContext {
  const { briefing, content, article } = draft
  const sources: HeadlineContext['sources'] = [...(content?.sources ?? [])]
  if (article) {
    const reference = { title: article.title, url: article.url, summary: article.summary }
    const position = sources.findIndex(source => source.url === reference.url)
    if (position < 0) sources.unshift(reference)
    else sources[position] = reference
  }
  return {
    briefing: [draft.title, briefing.notes].filter(Boolean).join('\n'),
    audience: content?.campaign.audience || briefing.audience,
    objective: content?.campaign.objective || briefing.objective,
    tone: content?.campaign.tone || briefing.tone,
    format: content?.campaign.format ?? briefing.format,
    slides: content?.slides.map(({ title, body }) => ({ title, body })) ?? [],
    sources,
  }
}
