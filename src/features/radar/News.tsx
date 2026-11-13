import { useEffect, useState } from 'react'
import { normalize, snapshotSchema, type Snapshot } from './contract'

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

export function News() {
  const [data, setData] = useState<Snapshot>()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reload, setReload] = useState(0)
  const [favorites, setFavorites] = useState<string[]>()
  const [storageError, setStorageError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [source, setSource] = useState('')
  const [language, setLanguage] = useState('')
  const [period, setPeriod] = useState('')
  const [kind, setKind] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [limit, setLimit] = useState(pageSize)

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
  function refresh() { setState('loading'); setReload(value => value + 1) }
  const items = data?.items ?? []
  const options = (key: 'category' | 'source' | 'language') => [...new Set(items.flatMap(item => item[key] ? [item[key]!] : []))].sort((a,b) => a.localeCompare(b,'pt-BR'))
  const terms = normalize(query.trim()).split(/\s+/)
  const cutoff = data ? Date.parse(data.attemptedAt) - Number(period) * 86400000 : 0
  const results = items.filter(item =>
    (!category || item.category === category) && (!source || item.source === source) &&
    (!language || item.language === language) && (!period || (item.publishedAt && Date.parse(item.publishedAt) >= cutoff)) &&
    (!kind || item.trend) && (!onlyFavorites || favorites?.includes(item.id)) &&
    terms.every(term => normalize([item.title,item.summary,item.source,item.trend].join(' ')).includes(term)))
  const failures = data?.sources.filter(item => item.error) ?? []
  const select = (label: string, value: string, update: (value: string) => void, choices: [string,string][]) =>
    <label>{label}<select value={value} onChange={event => { update(event.target.value); setLimit(pageSize) }}><option value="">Todos</option>{choices.map(([key,text]) => <option key={key} value={key}>{text}</option>)}</select></label>

  return <section className="news" aria-label="Notícias do Radar">
    <header className="news-header"><div><h2>Notícias e pautas</h2><p className="muted">{data?.collectedAt ? <>Última coleta bem-sucedida: <time dateTime={data.collectedAt}>{format(data.collectedAt)}</time> (Brasília)</> : 'Nenhuma coleta disponível.'}</p></div>
      <button className="button button-dark" disabled={state === 'loading'} onClick={refresh}>Recarregar notícias</button></header>
    {state === 'loading' && <p role="status">Carregando notícias…</p>}
    {state === 'error' && <p role="alert" className="info-strip">Não foi possível carregar as notícias.{data ? ' Exibindo a última edição aberta.' : ' Tente recarregar.'}</p>}
    {storageError && <p role="alert" className="info-strip">Não foi possível acessar os favoritos neste navegador.</p>}
    {data && <>
      <details className="news-sources" open={failures.length > 0 || undefined}>
        <summary>{failures.length ? `${failures.length} de ${data.sources.length} fontes indisponíveis na última tentativa` : `${data.sources.length} fontes consultadas`}</summary>
        <p className="muted">Tentativa: {format(data.attemptedAt)} (Brasília). Notícias já coletadas podem continuar visíveis.</p>
        <ul>{data.sources.map(item => <li key={item.id}><a href={item.url} target="_blank" rel="noreferrer">{item.name}</a> — {item.error ?? `${item.count} itens recebidos`}</li>)}</ul>
      </details>
      <div className="news-filters">
        <label>Buscar notícias<input type="search" placeholder="Título, assunto ou fonte" value={query} onChange={event => { setQuery(event.target.value); setLimit(pageSize) }} /></label>
        {select('Nicho',category,setCategory,options('category').map(v => [v,v]))}
        {select('Fonte',source,setSource,options('source').map(v => [v,v]))}
        {select('Idioma',language,setLanguage,options('language').map(v => [v, v === 'pt' ? 'Português' : v === 'en' ? 'Inglês' : v]))}
        {select('Publicação',period,setPeriod,[['1','Últimas 24 horas'],['7','Últimos 7 dias'],['14','Últimos 14 dias']])}
        {select('Destaque',kind,setKind,[['trend','Google Trends']])}
        <label className="news-checkbox"><input type="checkbox" checked={onlyFavorites} disabled={!favorites} onChange={event => { setOnlyFavorites(event.target.checked); setLimit(pageSize) }} /> Só favoritos</label>
      </div>
      <p role="status" className="muted">{results.length} {results.length === 1 ? 'notícia' : 'notícias'}</p>
      {!results.length && <div className="empty-state"><h3>Nenhuma notícia encontrada</h3><p>{items.length ? 'Experimente outros filtros ou termos de busca.' : 'Ainda não há notícias nesta edição.'}</p></div>}
      <div className="news-grid">{results.slice(0,limit).map(item => <article className="news-card" key={item.id}>
        <div className="news-meta"><span className="badge badge-green">{item.category}</span><button type="button" className="news-favorite" aria-label={`Favoritar: ${item.title}`} aria-pressed={favorites?.includes(item.id) ?? false} disabled={!favorites || saving} onClick={() => void toggle(item.id)}>{favorites?.includes(item.id) ? '★' : '☆'}</button></div>
        <h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></h3>
        <p className="muted">{item.source} · {item.publishedAt ? <time dateTime={item.publishedAt}>{format(item.publishedAt)}</time> : 'Data de publicação não informada'}</p>
        {item.summary && <p>{item.summary}</p>}
        {item.trend && <p className="news-trend"><a href="https://trends.google.com/trending?geo=BR" target="_blank" rel="noreferrer">Google Trends</a> · {item.trend}</p>}
      </article>)}</div>
      {results.length > limit && <button className="button button-dark" onClick={() => setLimit(value => value + pageSize)}>Mostrar mais notícias</button>}
    </>}
  </section>
}
