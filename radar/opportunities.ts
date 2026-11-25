import { normalize, type Article, type Observation, type Opportunity } from '../src/features/radar/contract.ts'

const hour = 3_600_000
const generic = new Set('com para por que uma das dos and the for with design designer designs brand branding visual nova novo new launches lançamento creative creative studio identity identidade reveals estreia redesign rebrand typography logo gráfico from this sobre'.split(' '))
const terms = (title: string) => new Set(normalize(title).match(/[a-z0-9]{3,}/g)?.filter(term => !generic.has(term)))
const publisher = (item: Article) => new URL(item.url).hostname.replace(/^www\./,'')
// Distinct domains alone do not establish editorial independence.
const distinctPublishers = (a: Article, b: Article) => {
  const x = publisher(a), y = publisher(b)
  return x !== y && !x.endsWith(`.${y}`) && !y.endsWith(`.${x}`) && normalize(a.source) !== normalize(b.source)
}
const time = (item: Article) => item.publishedAt ? Date.parse(item.publishedAt) : NaN
export function sameEvent(a: Article, b: Article) {
  if (a.category !== b.category || Math.abs(time(a) - time(b)) > 48 * hour ||
      !Number.isFinite(time(a)) || !Number.isFinite(time(b))) return false
  const x = terms(a.title), y = terms(b.title)
  const shared = [...x].filter(term => y.has(term)).length
  return shared >= 3 && shared / (x.size + y.size - shared) >= .5
}

export function growthFor(query: string, current: Observation[], previous: Observation[], now: number) {
  return current.find(next => normalize(next.query) === normalize(query) && now - Date.parse(next.at) <= hour &&
    previous.some(old => old.feed === next.feed && normalize(old.query) === normalize(next.query) &&
      old.startedAt === next.startedAt && Date.parse(next.at) - Date.parse(old.at) >= hour &&
      Date.parse(next.at) - Date.parse(old.at) <= 24 * hour && old.bucket < next.bucket))
}

export function buildOpportunities(items: Article[], evidence: Article[], current: Observation[], previous: Observation[], now: Date): Opportunity[] {
  const used = new Set<string>()
  const opportunities: Opportunity[] = []
  const candidates = [...items, ...evidence]
  for (const item of items.slice(0, 180)) {
    if (!item.editorial || used.has(item.id)) continue
    const articles = [item]
    for (const other of candidates) {
      if (articles.length === 4) break
      if (!used.has(other.id) && other.canonicalUrl !== item.canonicalUrl && sameEvent(item, other) &&
          articles.every(source => distinctPublishers(source, other))) articles.push(other)
    }
    const title = normalize(item.title)
    const growth = item.trend && evidence.some(fresh => fresh.canonicalUrl === item.canonicalUrl && fresh.trend === item.trend)
      && growthFor(item.trend, current, previous, +now)
    const actionable = /\b(launch\w*|unveil\w*|release\w*|lanca\w*|anuncia\w*|estreia\w*|rebrand\w*|redesign|aquisicao|acquisition)\b/.test(title)
    const evergreen = !actionable && /\b(guide|guia|tutorial|principles|principios|how to|como fazer|como usar|how typography|fundamentos|checklist)\b/.test(title)
    const recent = actionable && +now >= time(item) && +now - time(item) <= 72 * hour
    if (!growth && !evergreen && !recent && item.editorial.scope !== 'direct' && articles.length < 2) continue
    articles.forEach(article => used.add(article.id))
    const coverage = articles.length > 1 ? ` Cobertura recorrente em ${articles.length} veículos com domínios distintos.` : ''
    if (growth) opportunities.push({
      type: 'Em alta', reason: `O patamar aproximado de buscas de “${growth.query}” subiu no Google Trends entre duas observações do mesmo episódio e feed.${coverage}`,
      approach: 'Contextualização', angle: 'Explique a relação do tema com o trabalho criativo e compare o que as fontes sustentam.', articles,
    })
    else if (evergreen) opportunities.push({
      type: 'Conteúdo atemporal', reason: `O título propõe conteúdo educativo sobre ${item.category.toLowerCase()}.${coverage}`,
      approach: 'Explicação', angle: 'Transforme o tema em princípios que o leitor possa aplicar, com exemplos próprios.', articles,
    })
    else if (recent) opportunities.push({
      type: 'Assunto do momento', reason: `O título menciona uma mudança, anúncio ou lançamento. A matéria foi publicada nas 72 horas que antecederam a coleta.${coverage}`,
      approach: 'Contextualização', angle: 'Explique o acontecimento e discuta a relevância para quem trabalha na área.', articles,
    })
    else opportunities.push({
      type: 'Boa oportunidade de pauta', reason: `Tema classificado em ${item.category.toLowerCase()} pelo recorte editorial do Radar.${coverage}`,
      approach: articles.length > 1 ? 'Comparação' : 'Análise crítica',
      angle: articles.length > 1 ? 'Compare os pontos destacados pelos veículos e separe observação de opinião.'
        : 'Escolha uma decisão criativa verificável na fonte e discuta como ela afeta a experiência ou a comunicação.', articles,
    })
  }
  const priority = ['Em alta', 'Assunto do momento', 'Conteúdo atemporal', 'Boa oportunidade de pauta']
  return opportunities.sort((a,b) => priority.indexOf(a.type) - priority.indexOf(b.type)).slice(0,48)
}
