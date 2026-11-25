import sources from '../../../radar/sources.json'
import { normalize, type Article } from './contract'
import { sameEvent } from '../../../radar/opportunities'

export const relevanceWeights = { creative: .35, editorial: .20, source: .15, freshness: .15, visual: .10, original: .05 } as const
export type EditorialPreferences = Record<string, number>
const craft = /\b(branding|rebrand\w*|identidade visual|brand identity|new identity|graphic design|web design|motion design|design grafico|typograph\w*|typeface\w*|font\w*|tipograf\w*|packaging|embala\w*|art direction|direcao de arte|illustrat\w*|ilustra\w*|creative campaign|campanha|ux|ui|interface|design system|visual culture|cultura visual|drawings|hand.drawn|artwork|sculpture|pintura|poster|cartaz|animation|animacao|photograph\w*|fotograf\w*)\b/
const creativeWork = /\b(identity|identidade|new look|refresh\w*|brand universe|film|filme|ad|ads|advert|advertising|commercial)\b/
const production = /\b(studio|estudio|agency|agencia|designer\w*|design|director|diretor|direcao|created|criada|criado|crafted|artist\w*|artista\w*|animat\w*|cinematic|cinematograf\w*|wordmark|typewriter)\b/
const actionable = /\b(launch\w*|reveal\w*|unveil\w*|lanca\w*|estreia|rebrand\w*|redesign|case study|estudo de caso|how to|guia|processo|process|tutorial)\b/
const promotion = /\b(cupom|cashback|deals|on sale|buy now|compre agora|casino|black friday|save (?:gbp|usd)?\s*\d|save\s*[£$€]\s*\d)\b/
const categoryKey = (article: Article) => 'category:' + article.category
export function preferenceChange(current: EditorialPreferences, article: Article, delta: number): EditorialPreferences {
  return { ...current, [categoryKey(article)]: Math.max(-5, Math.min(5, (current[categoryKey(article)] ?? 0) + delta)) }
}
export function editorialRelevance(article: Article, now: number, preferences: EditorialPreferences = {}, repeated = false) {
  const title = normalize(article.title)
  const context = normalize([article.title, article.summary, ...(article.feedTags ?? [])].join(' '))
  const source = sources.sources.find(source => source.id === article.feedId)
  const specialized = source?.editorialProfile === 'specialist'
  const promotional = promotion.test(title)
  const hasWork = craft.test(context) || creativeWork.test(context) && production.test(context)
  const creative = promotional ? .15 : hasWork ? (craft.test(title) || creativeWork.test(title) && production.test(context) ? 1 : .8) : article.editorial?.scope === 'direct' ? .55 : .15
  const editorial = promotional ? .05 : actionable.test(context) ? 1 : article.summary ? .6 : .3
  const age = article.publishedAt ? (now - Date.parse(article.publishedAt)) / 86400000 : Infinity
  const freshness = age < 0 || !Number.isFinite(age) ? 0 : Math.exp(-age / 7)
  // Metadata indicates a visual lead, not a verified download or a license.
  const visual = article.imageUrl ? 1 : craft.test(context) ? .5 : 0
  const parts = { creative, editorial, source: specialized ? 1 : source?.editorialProfile === 'selective' ? .75 : .4,
    freshness, visual, original: repeated ? 0 : 1 }
  const base = (Object.keys(relevanceWeights) as (keyof typeof relevanceWeights)[]).reduce((sum, key) => sum + parts[key] * relevanceWeights[key], 0)
  const adjustment = (preferences[categoryKey(article)] ?? 0) * .01
  const reason = creative >= .8 ? 'Abordagem de design, marca ou comunicação no conteúdo da notícia.' :
    specialized ? 'Fonte especializada no mercado criativo.' : 'Contexto complementar para a criação.'
  return { score: base + adjustment, reason, forDesigners: creative >= .8, highPotential: creative >= .8 && editorial >= .6,
    visualLead: !!article.imageUrl }
}
export function rankNews(items: Article[], now: number, preferences: EditorialPreferences = {}) {
  const pending = items.map((article, index) => ({ article, index, ...editorialRelevance(article, now, preferences,
    items.slice(0, index).some(other => sameEvent(article, other))) })).sort((a, b) => b.score - a.score || a.index - b.index)
  const result: Article[] = []
  while (pending.length) {
    const best = pending[0].score
    const recent = result.slice(-3)
    const index = pending.findIndex(row => row.score >= best - .12 && !recent.some(item => item.source === row.article.source))
    const [next] = pending.splice(Math.max(0, index), 1)
    result.push(next.article)
  }
  return result
}
export function relatedNews(article: Article, items: Article[]) { return items.filter(other => other.id !== article.id && sameEvent(article, other)) }
