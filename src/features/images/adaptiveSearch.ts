import { prioritizedImageQueries, type VisualRequest } from './automaticSearch'
import { phraseKey } from './visualContext'

export type SearchOutcome = { kind: 'web' | 'images'; query: string; cause: 'empty' | 'unusable' | 'blocked' | 'download' }
// Word order and punctuation alone do not justify spending another provider request.
export const visualQueryKey = (kind: SearchOutcome['kind'], query: string) =>
  kind + ':' + [...new Set(phraseKey(query).split(' ').filter(Boolean))].sort().join(' ')

export function nextVisualQuery(requests: VisualRequest[], queried: ReadonlySet<string>, previous?: SearchOutcome) {
  const campaign = requests[0]?.campaign
  if (!campaign) return
  const queries = [...prioritizedImageQueries(requests), ...campaign.extraQueries, campaign.query].filter(Boolean)
  const concise = queries.map(query => query.replace(/\b(?:I|we|you|your|it|its|this|that|the|a|an|is|are|was|were|be|because|now|so|sure|try|today|built|powerful|new|makes|look|like|and|or|but|not|to|of|for|with)\b/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(query => phraseKey(query).split(' ').length >= 3)
  const available = (kind: SearchOutcome['kind'], values: string[]) => values.map(query => ({ kind, query }))
    .find(item => !queried.has(visualQueryKey(item.kind, item.query)))
  // No usable raster / blocked origin: discover another publication and its captions.
  // No results: reformulate first, then change channel. Both remain within five calls.
  if (previous && previous.cause !== 'empty' && previous.kind === 'images') {
    const web = available('web', [previous.query, ...queries])
    if (web) return web
  }
  if (previous?.cause === 'empty') {
    const reformulated = available(previous.kind, concise)
    if (reformulated) return reformulated
  }
  return available('images', queries) ?? available('web', queries) ?? available('images', concise) ?? available('web', concise)
}
