import { useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { opportunityTypes, type Opportunity } from './contract'
import { useAssistantSignal } from '../intelligence/signals'

const icons: Record<Opportunity['type'], IconName> = {
  'Em alta': 'trend', 'Boa oportunidade de pauta': 'spark',
  'Assunto do momento': 'clock', 'Conteúdo atemporal': 'book',
}
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' })
const batch = 6
export function Opportunities({ active, items, editionAt, favorites, saving, save, create }: {
  active: boolean; items?: Opportunity[]; editionAt: string; favorites?: string[]; saving: boolean
  save: (id: string) => void; create: (opportunity: Opportunity) => void
}) {
  const [category, setCategory] = useState('')
  const [source, setSource] = useState('')
  const [period, setPeriod] = useState('')
  const [type, setType] = useState('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [limit, setLimit] = useState(batch)
  const [reading, setReading] = useState<string>()
  const cutoff = Date.parse(editionAt) - Number(period) * 86_400_000
  const results = items?.filter(item => (!category || item.articles[0].category === category) &&
    (!type || item.type === type) && (!source || item.articles.some(article => article.source === source)) &&
    (!period || item.articles.some(article => article.publishedAt && Date.parse(article.publishedAt) >= cutoff)) &&
    (!savedOnly || favorites?.includes(item.articles[0].id))) ?? []
  const match = active ? results.slice(0, limit).find(item => item.articles[0].id === reading) : undefined
  useAssistantSignal(match ? {
    area: 'radar', priority: 18, scope: match.articles[0].id, category: 'research',
    insight: {
      id: 'radar:opportunity', title: `${match.approach} · ${match.articles.length} referência(s)`,
      detail: `${match.reason} Considere este recorte no briefing: ${match.angle}`,
      assessment: 'heuristic',
      actions: [{ label: 'Preparar briefing da oportunidade', run: () => create(match) }],
    },
  } : undefined)

  function filter(label: string, selected: string, change: (value: string) => void, options: string[]) {
    return <label>{label}<select value={selected} onChange={event => { change(event.target.value); setLimit(batch) }}>
      <option value="">Todos</option>{options.map(option => <option key={option}>{option}</option>)}
    </select></label>
  }
  return <section className="news" aria-label="Oportunidades editoriais">
    <div><h2 className="opportunity-heading">O que postar hoje?</h2><p className="muted">Sugestões editoriais baseadas nas fontes do Radar.</p></div>
    {items && items.length > 0 && <details className="news-sources">
      <summary>Filtrar oportunidades</summary>
      <div className="news-filters">
        {filter('Categoria', category, setCategory, [...new Set(items.map(item => item.articles[0].category))].sort())}
        {filter('Fonte', source, setSource, [...new Set(items.flatMap(item => item.articles.map(article => article.source)))].sort())}
        {filter('Tipo de oportunidade', type, setType, [...opportunityTypes])}
        <label>Período<select value={period} onChange={event => { setPeriod(event.target.value); setLimit(batch) }}>
          <option value="">Todos</option><option value="3">Últimos 3 dias</option><option value="7">Últimos 7 dias</option><option value="14">Últimos 14 dias</option>
        </select></label>
        <label className="news-checkbox"><input type="checkbox" checked={savedOnly} disabled={!favorites}
          onChange={event => { setSavedOnly(event.target.checked); setLimit(batch) }} /> Só favoritos</label>
      </div>
    </details>}
    <p role="status" className="muted">{!items ? 'Esta edição ainda não inclui recomendações editoriais.' :
      results.length ? `${results.length} oportunidades encontradas` : 'Nenhuma oportunidade para este recorte.'}</p>
    <div className="news-grid">{results.slice(0, limit).map(item => {
      const article = item.articles[0]
      const saved = favorites?.includes(article.id) ?? false
      return <article className="news-card opportunity-card" key={article.id} onFocus={() => setReading(article.id)}>
        <div className="opportunity-type"><Icon name={icons[item.type]} /><strong>{item.type}</strong></div>
        <p className="muted">{article.category}</p>
        <h3>{article.title}</h3>
        <p className="muted">{article.source} · {article.publishedAt
          ? <time dateTime={article.publishedAt}>{date.format(new Date(article.publishedAt))}</time>
          : 'Publicação sem data'}</p>
        <p>{item.reason}</p>
        <p><strong>{item.approach}.</strong> {item.angle}</p>
        <details><summary>Fontes e datas ({item.articles.length})</summary>
          <ul>{item.articles.map(evidence => <li key={evidence.id}>
            <a href={evidence.url} target="_blank" rel="noreferrer">{evidence.source} · {evidence.title}</a>
            <p className="muted">{evidence.publishedAt ? date.format(new Date(evidence.publishedAt)) :
              `Publicação sem data · coleta em ${date.format(new Date(evidence.collectedAt))}`}</p>
          </li>)}</ul>
        </details>
        <div className="opportunity-actions">
          <button className="button button-dark" onClick={() => create(item)}>Criar pauta</button>
          <button className="button button-outline" aria-pressed={saved} disabled={!favorites || saving}
            onClick={() => save(article.id)}>{saved ? 'Salva' : 'Salvar'}</button>
        </div>
      </article>
    })}</div>
    {results.length > limit && <button className="button button-outline" onClick={() => setLimit(limit + batch)}>Mostrar mais oportunidades</button>}
  </section>
}
