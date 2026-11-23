import { Opportunities } from './Opportunities'
import type { Opportunity } from './contract'
import { useEffect, useState } from 'react'
import { useAssistantSignal } from '../intelligence/signals'
import { normalize, snapshotSchema, type Article, type Snapshot } from './contract'
import { editorialCategories } from './categories'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const format = (date: string) => dateFormat.format(new Date(date))
const pageSize = 24

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
  const [reading, setReading] = useState<string>()
  const [data, setData] = useState<Snapshot>()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reload, setReload] = useState(0)
  const [favorites, setFavorites] = useState<string[]>()
  const [storageError, setStorageError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState<string>(() => window.history.state?.newsFilters?.query ?? '')
  const [category, setCategory] = useState<string>(() => window.history.state?.newsFilters?.category ?? '')
  const [source, setSource] = useState<string>(() => window.history.state?.newsFilters?.source ?? '')
  const [language, setLanguage] = useState<string>(() => window.history.state?.newsFilters?.language ?? '')
  const [period, setPeriod] = useState<string>(() => window.history.state?.newsFilters?.period ?? '')
  const [kind, setKind] = useState<string>(() => window.history.state?.newsFilters?.kind ?? '')
  const [scope, setScope] = useState<string>(() => window.history.state?.newsFilters?.scope ?? '')
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(() => window.history.state?.newsFilters?.onlyFavorites ?? false)
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
    try {
      await writeFavorite(id,save)
      setFavorites(current => save ? [...current ?? [],id] : current?.filter(value => value !== id))
      setStorageError(false)
    } catch { setStorageError(true) }
    finally { setSaving(false) }
  }
  function startBriefing(item: Article) {
    const newsFilters = { query, category, source, language, period, kind, scope, onlyFavorites }
    window.history.replaceState({ ...window.history.state, newsFilters }, '')
    onCreatePost(item)
  }
  function refresh() { setState('loading'); setReload(value => value + 1) }
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
  const article = active && !opportunitiesView ? results.slice(0, limit).find(item => item.id === reading) : undefined
  useAssistantSignal(article ? {
    area: 'radar', priority: 16, scope: article.id, category: 'research', subject: article.id,
    insight: {
      id: 'radar:article', ruleId: 'SRC-002',
      title: article.summary ? `Confira a íntegra em ${article.source}` : `${article.source} forneceu a manchete, sem resumo`,
      detail: 'Consulte a fonte para distinguir o que ela documenta do recorte que entrará no briefing.',
      assessment: 'insufficient_data',
      actions: [{ label: 'Preparar briefing desta notícia', run: () => startBriefing(article) }],
    },
  } : undefined)
  const select = (label: string, value: string, update: (value: string) => void, choices: [string,string][]) =>
    <label>{label}<select value={value} onChange={event => { update(event.target.value); setLimit(pageSize) }}><option value="">Todos</option>{choices.map(([key,text]) => <option key={key} value={key}>{text}</option>)}</select></label>

  return <section className="news" aria-label="Notícias do Radar">
    <header className="news-header"><div>{!opportunitiesView && <><h2>{favoritesView ? 'Favoritos' : 'Radar Criativo'}</h2><p>Design, branding, direção de arte e mercado criativo.</p></>}<p className="muted">{data?.collectedAt ? <>Última coleta bem-sucedida: <time dateTime={data.collectedAt}>{format(data.collectedAt)}</time> (Brasília){daysOld > 0 && <strong className="edition-age">há {daysOld} {daysOld === 1 ? 'dia' : 'dias'}</strong>}</> : 'Nenhuma coleta disponível.'}</p></div>
      <button className="button button-dark" disabled={state === 'loading'} onClick={refresh}>{state === 'loading' ? 'Verificando…' : 'Verificar nova edição'}</button></header>
    {state === 'loading' && <p role="status">Carregando notícias…</p>}
    {state === 'error' && <p role="alert" className="info-strip">Não foi possível carregar as notícias.{data ? ' Exibindo a última edição aberta.' : ' Tente recarregar.'}</p>}
    {storageError && <p role="alert" className="info-strip">Não foi possível acessar os favoritos neste navegador.</p>}
    {data && <div hidden={!opportunitiesView}><Opportunities active={active && opportunitiesView} items={data.opportunities} editionAt={data.attemptedAt} favorites={favorites} saving={saving} save={id => void toggle(id)} create={onCreateOpportunity} /></div>}
    {data && <div hidden={opportunitiesView} className="news">
      <div className="context-panel news-filter-panel">
        <div className="news-filters primary-filters">
        <label>Buscar notícias<input type="search" placeholder="Ex.: tipografia, rebranding, Creative Boom" value={query} onChange={event => { setQuery(event.target.value); setLimit(pageSize) }} /></label>
        {select('Categoria',category,setCategory,categories.map(v => [v,v]))}
        {select('Publicação',period,setPeriod,[['1','Últimas 24 horas'],['7','Últimos 7 dias'],['14','Últimos 14 dias']])}
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
      <div className="filter-chips">{[
        { label: source, clear: () => setSource('') },
        { label: language === 'pt' ? 'Português' : language === 'en' ? 'Inglês' : language, clear: () => setLanguage('') },
        { label: kind && 'Google Trends', clear: () => setKind('') },
        { label: scope && (scope === 'direct' ? 'Criação e mercado' : 'Contexto criativo'), clear: () => setScope('') },
        { label: onlyFavorites && 'Só favoritos', clear: () => setOnlyFavorites(false) },
      ].filter(item => item.label).map(item => <button key={String(item.label)} aria-label={`Remover filtro ${item.label}`} onClick={item.clear}>{item.label} ×</button>)}</div>
      <p role="status" className="muted">{results.length} {results.length === 1 ? 'notícia' : 'notícias'}</p>
      {!results.length && <div className="empty-state"><h3>Nenhuma notícia encontrada</h3><p>{items.length ? 'Experimente outros filtros ou termos de busca.' : 'Ainda não há notícias nesta edição.'}</p></div>}
      <div className="news-grid">{results.slice(0,limit).map(item => <article className="news-card" key={item.id} onFocus={() => setReading(item.id)}>
        <div className="news-meta"><span className="badge badge-neutral">{item.category}</span><button type="button" className="news-favorite" aria-label={`Favoritar: ${item.title}`} aria-pressed={favorites?.includes(item.id) ?? false} disabled={!favorites || saving} onClick={() => void toggle(item.id)}>{favorites?.includes(item.id) ? '★' : '☆'}</button></div>
        <h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></h3>
        <p className="muted">{item.source} · {item.publishedAt ? <time dateTime={item.publishedAt}>{format(item.publishedAt)}</time> : 'Data de publicação não informada'}{item.editorial?.scope === 'adjacent' && ' · Contexto criativo'}</p>
        {item.summary && <p>{item.summary}</p>}
        {item.trend && <p className="news-trend"><a href="https://trends.google.com/trending?geo=BR" target="_blank" rel="noreferrer">Google Trends</a> · {item.trend}</p>}
        <button type="button" className="button news-create" onClick={() => startBriefing(item)}>Criar post</button>
      </article>)}</div>
      {results.length > limit && <button className="button button-dark" onClick={() => setLimit(value => value + pageSize)}>Mostrar mais notícias</button>}
    </div>}
  </section>
}
