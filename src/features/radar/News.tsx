import { Opportunities } from './Opportunities'
import type { Opportunity } from './contract'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { normalize, snapshotSchema, type Article, type Snapshot } from './contract'
import { editorialCategories } from './categories'
import { NewsAssistant } from './NewsAssistant'
import { NewsCard } from './NewsCard'
import './news.css'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const format = (date: string) => dateFormat.format(new Date(date))
const pageSize = 24
const newsFiltersKey = 'post-machine:radar-origin-filters'
type NewsFilters = { query: string; category: string; source: string; language: string; period: string; kind: string; scope: string; onlyFavorites: boolean }

function previousFilters(): Partial<NewsFilters> {
  const state = window.history.state?.newsFilters
  if (state) return state
  try { return JSON.parse(sessionStorage.getItem(newsFiltersKey) ?? '{}') ?? {} }
  catch { return {} }
}

function favoritesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('post-machine-radar', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('favorites')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function readFavorites(): Promise<string[]> {
  const db = await favoritesDb()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('favorites').objectStore('favorites').getAllKeys()
      request.onsuccess = () => resolve(request.result.filter(key => typeof key === 'string'))
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}
async function writeFavorite(id: string, saved: boolean) {
  const db = await favoritesDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('favorites','readwrite')
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error)
      const store = tx.objectStore('favorites')
      if (saved) store.put(true,id)
      else store.delete(id)
    })
  } finally { db.close() }
}

export function News({ active, onCreatePost, favoritesView, opportunitiesView, onCreateOpportunity }: { active: boolean; favoritesView?: boolean; opportunitiesView: boolean; onCreateOpportunity: (value: Opportunity) => void; onCreatePost: (article: Article) => void }) {
  const [reading, setReading] = useState<string | null>()
  const assistantLauncher = useRef<HTMLButtonElement>(null)
  const reader = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<Snapshot>()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reload, setReload] = useState(0)
  const [favorites, setFavorites] = useState<string[]>()
  const [storageError, setStorageError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [favoriteStatus, setFavoriteStatus] = useState('')
  const [origin] = useState(previousFilters)
  const [query, setQuery] = useState(origin.query ?? '')
  const [category, setCategory] = useState(origin.category ?? '')
  const [source, setSource] = useState(origin.source ?? '')
  const [language, setLanguage] = useState(origin.language ?? '')
  const [period, setPeriod] = useState(origin.period ?? '')
  const [kind, setKind] = useState(origin.kind ?? '')
  const [scope, setScope] = useState(origin.scope ?? '')
  const [onlyFavorites, setOnlyFavorites] = useState(origin.onlyFavorites ?? false)
  const [limit, setLimit] = useState(pageSize)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    const abort = new AbortController()
    async function load() {
      try {
        const response = await fetch('/radar.json', { cache: 'no-cache', signal: abort.signal })
        if (!response.ok) throw Error('Snapshot indisponível')
        const snapshot = snapshotSchema.parse(await response.json())
        if (!abort.signal.aborted) { setData(snapshot); setState('ready') }
      } catch { if (!abort.signal.aborted) setState('error') }
    }
    void load()
    return () => abort.abort()
  }, [reload])
  useEffect(() => {
    let active = true
    void readFavorites().then(ids => { if (active) setFavorites(ids) }, () => { if (active) setStorageError(true) })
    return () => { active = false }
  }, [])

  async function toggle(id: string) {
    if (!favorites || saving) return
    const save = !favorites.includes(id)
    setSaving(true)
    setFavoriteStatus('')
    try {
      await writeFavorite(id,save)
      setFavorites(current => save ? [...current ?? [],id] : current?.filter(value => value !== id))
      setStorageError(false)
      setFavoriteStatus(save ? 'Notícia adicionada aos favoritos.' : 'Notícia removida dos favoritos.')
    } catch { setStorageError(true) }
    finally { setSaving(false) }
  }
  function startBriefing(item: Article) {
    const newsFilters = { query, category, source, language, period, kind, scope, onlyFavorites }
    window.history.replaceState({ ...window.history.state, newsFilters }, '')
    try { sessionStorage.setItem(newsFiltersKey, JSON.stringify(newsFilters)) } catch { /* O histórico permanece disponível. */ }
    onCreatePost(item)
  }
  function refresh() { setState('loading'); setReload(value => value + 1) }
  function closeAssistant() {
    setReading(undefined)
    requestAnimationFrame(() => {
      const origin = reader.current
      const target = origin?.isConnected && origin.getClientRects().length ? origin : assistantLauncher.current
      target?.focus()
    })
  }
  const items = data?.items ?? []
  const options = (key: 'source' | 'language') => [...new Set(items.flatMap(item => item[key] ? [item[key]!] : []))].sort((a,b) => a.localeCompare(b,'pt-BR'))
  const categories = [...new Set<string>([...editorialCategories, ...items.map(item => item.category)])]
  const terms = normalize(query.trim()).split(/\s+/)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    const update = () => setNow(Date.now())
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [active])
  const daysOld = data?.collectedAt ? Math.floor((now - Date.parse(data.collectedAt)) / 86400000) : 0
  const cutoff = now - Number(period) * 86400000
  const results = items.filter(item =>
    (!category || item.category === category) && (!source || item.source === source) &&
    (!language || item.language === language) && (!period || (item.publishedAt && Date.parse(item.publishedAt) >= cutoff && Date.parse(item.publishedAt) <= now)) &&
    (!kind || item.trend) && (!scope || item.editorial?.scope === scope) && (!(onlyFavorites || favoritesView) || favorites?.includes(item.id)) &&
    terms.every(term => normalize([item.title,item.summary,item.category,item.source,item.trend,...(item.feedTags ?? [])].join(' ')).includes(term)))
  const visible = results.slice(0, limit)
  const article = visible.find(item => item.id === reading)
  const periods: [string, string][] = [['1', 'Últimas 24 horas'], ['7', 'Últimos 7 dias'], ['14', 'Últimos 14 dias']]
  const chips = [
    { key: 'search', label: query.trim() && `Busca “${query.trim()}”`, clear: () => setQuery('') },
    { key: 'category', label: category, clear: () => setCategory('') },
    { key: 'period', label: periods.find(([value]) => value === period)?.[1], clear: () => setPeriod('') },
    { key: 'source', label: source, clear: () => setSource('') },
    { key: 'language', label: language === 'pt' ? 'Português' : language === 'en' ? 'Inglês' : language, clear: () => setLanguage('') },
    { key: 'kind', label: kind && 'Google Trends', clear: () => setKind('') },
    { key: 'scope', label: scope && (scope === 'direct' ? 'Criação e mercado' : 'Contexto criativo'), clear: () => setScope('') },
    { key: 'favorites', label: onlyFavorites && 'Só favoritos', clear: () => setOnlyFavorites(false) },
  ].filter(item => item.label)
  function clearFilters(clear: () => void) {
    clear()
    setLimit(pageSize)
    search.current?.focus()
  }
  const select = (label: string, value: string, update: (value: string) => void, choices: [string,string][]) =>
    <label>{label}<select value={value} onChange={event => { update(event.target.value); setLimit(pageSize) }}><option value="">Todos</option>{choices.map(([key,text]) => <option key={key} value={key}>{text}</option>)}</select></label>

  return <section className="news news-edition" aria-label="Notícias do Radar">
    <header className="news-header">
      <div>
        {!opportunitiesView && <h2>{favoritesView ? 'Favoritos' : 'Radar Criativo'}</h2>}
        <p className="muted">{data?.collectedAt ? <>Última coleta bem-sucedida: <time dateTime={data.collectedAt}>{format(data.collectedAt)}</time> (Brasília){daysOld > 0 && <span className="edition-age">há {daysOld} {daysOld === 1 ? 'dia' : 'dias'}</span>}</> :
          state === 'loading' ? 'Consultando a edição disponível…' : 'Nenhuma edição disponível.'}</p>
      </div>
      <button className="button button-outline" disabled={state === 'loading'} onClick={refresh}>
        {state === 'loading' ? 'Verificando…' : state === 'error' ? 'Tentar novamente' : 'Verificar nova edição'}
      </button>
    </header>
    {state === 'loading' && <p className="sr-only" role="status">{data ? 'Verificando nova edição…' : 'Carregando notícias…'}</p>}
    {state === 'loading' && !data && !opportunitiesView && <div className="news-grid news-story-grid" aria-hidden="true">
      {[0, 1, 2, 3].map(index => <div className="news-card news-skeleton" key={index}>
        <div /><span /><span /><span />
      </div>)}
    </div>}
    {state === 'error' && <p role="alert" className="info-strip">Não foi possível carregar as notícias.{data ? ' Exibindo a última edição aberta.' : ' Tente novamente.'}</p>}
    {storageError && <p role="alert" className="info-strip">Não foi possível acessar os favoritos neste navegador.</p>}
    <p className="sr-only" role="status">{favoriteStatus}</p>
    {data && <div hidden={!opportunitiesView}><Opportunities active={active && opportunitiesView} items={data.opportunities} editionAt={data.attemptedAt} favorites={favorites} saving={saving} save={id => void toggle(id)} create={onCreateOpportunity} /></div>}
    {data && <div hidden={opportunitiesView} className="news news-list">
      <div className="context-panel news-filter-panel">
        <div className="news-filters primary-filters">
        <label>Buscar notícias<input ref={search} type="search" placeholder="Título, tema ou fonte" value={query} onChange={event => { setQuery(event.target.value); setLimit(pageSize) }} /></label>
        {select('Categoria',category,setCategory,categories.map(v => [v,v]))}
        {select('Publicação',period,setPeriod,periods)}
        <button className="button button-outline" aria-controls="news-advanced" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>Mais filtros</button>
        </div>
        <div className="news-filters" id="news-advanced" hidden={!filtersOpen}>
        {select('Fonte',source,setSource,options('source').map(v => [v,v]))}
        {select('Idioma',language,setLanguage,options('language').map(v => [v, v === 'pt' ? 'Português' : v === 'en' ? 'Inglês' : v]))}
        {select('Destaque',kind,setKind,[['trend','Google Trends']])}
        {items.some(item => item.editorial) && select('Recorte',scope,setScope,[['direct','Criação e mercado'],['adjacent','Contexto criativo']])}
        <label className="news-checkbox"><input type="checkbox" checked={onlyFavorites} disabled={!favorites} onChange={event => { setOnlyFavorites(event.target.checked); setLimit(pageSize) }} /> Só favoritos</label>
        </div>
      </div>
      {chips.length > 0 && <div className="filter-chips" role="group" aria-label="Filtros ativos">
        {chips.map(item => <button key={item.key} aria-label={`Remover filtro ${item.label}`} onClick={() => clearFilters(item.clear)}>
          <span>{item.label}</span><Icon name="close" />
        </button>)}
        <button className="news-clear-filters" onClick={() => clearFilters(() => chips.forEach(item => item.clear()))}>Limpar filtros</button>
      </div>}
      <div className="news-results" data-reading={reading !== undefined}>
        <div className="news-results-count">
          <p role="status">{results.length} {results.length === 1 ? 'notícia' : 'notícias'}</p>
        </div>
        <NewsAssistant selection={reading} onOpen={() => { reader.current = null; setReading(null) }} onClose={closeAssistant}
          article={article} opportunity={article && data.opportunities?.find(item => item.articles[0].id === article.id)}
          launcher={assistantLauncher} onCreate={startBriefing} />
        <div className="news-results-feed">
          {!visible.length ? <div className="empty-state news-empty">
            <h3>Nenhuma notícia encontrada</h3>
            <p>{chips.length ? 'Experimente outros filtros ou termos de busca.' : favoritesView
              ? 'Use a estrela nos cartões para guardar notícias aqui.' : 'Ainda não há notícias nesta edição.'}</p>
          </div> : <div className="news-grid news-story-grid">
            {visible.map(item => <NewsCard key={item.id} article={item} saved={favorites?.includes(item.id) ?? false}
              canSave={Boolean(favorites) && !saving} onSave={() => void toggle(item.id)} onCreate={() => startBriefing(item)}
              selected={article?.id === item.id} onRead={event => {
                reader.current = event.currentTarget
                if (reading === item.id) closeAssistant()
                else setReading(item.id)
              }} />)}
          </div>}
          {results.length > limit && <button className="button button-outline news-more" onClick={() => setLimit(value => value + pageSize)}>Mostrar mais notícias</button>}
        </div>
      </div>
    </div>}
  </section>
}
