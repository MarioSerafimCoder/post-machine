import { useEffect, useRef, useState } from 'react'
import { normalize } from '../radar/contract'
import { editorialFormat, formats, type FormatId } from './catalog'
import { analysisFields, newReference, type AnalysisField, type Reference } from './contract'
import { editorialPrompt } from './editorial'
import { identifyUrl, platforms, type Platform } from './urls'
import { listReferences, removeReference, restoreReferences, writeReference } from './storage'
import { FormatCatalog } from './FormatCatalog'
import { ReferenceForm } from './ReferenceForm'
import { ReferenceThumbnail, YouTubeData } from './YouTubeData'
import { comparableYouTubePair, displayVideo, snapshotSchema, type YouTubeSnapshot } from './youtube'

const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })
export function Virals({ createCampaign }: { createCampaign?: (reference: Reference) => void }) {
  const [data, setData] = useState<Reference[]>()
  const [youtube, setYouTube] = useState<YouTubeSnapshot>()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [tab, setTab] = useState<'library' | 'formats'>('library')
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<Platform | ''>('')
  const [format, setFormat] = useState<FormatId | ''>('')
  const [niche, setNiche] = useState('')
  const [order, setOrder] = useState('created')
  const [favorites, setFavorites] = useState(false)
  const [selected, setSelected] = useState<string>()
  const [editing, setEditing] = useState<Reference>()
  const [busy, setBusy] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [comparisonIds, setComparisonIds] = useState<string[]>([])
  const detail = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    let live = true
    void listReferences().then(value => { if (live) setData(value) }, () => { if (live) setError('Não foi possível abrir a biblioteca local.') })
    return () => { live = false }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/virals-youtube.json', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]), cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw Error('Consulta indisponível.')
        return response.json()
      })
      .then(value => {
        const snapshot = snapshotSchema.parse(value)
        if (!controller.signal.aborted) setYouTube({ ...snapshot, videos: snapshot.videos.filter(video => displayVideo(video, Date.now())) })
      })
      .catch(() => { if (!controller.signal.aborted) setYouTube({ schemaVersion: 1, status: 'error', videos: [], requests: 0, day: '' }) })
    return () => controller.abort()
  }, [])
  useEffect(() => { if (selected && !editing) detail.current?.focus() }, [selected, editing])
  const chosen = data?.find(ref => ref.id === selected)
  const chosenIdentity = chosen && identifyUrl(chosen.url)
  const videoById = new Map(youtube?.videos.map(video => [video.id, video]))
  const comparison = comparisonIds.flatMap(id => {
    const ref = data?.find(item => item.id === id)
    if (!ref) return []
    const identity = identifyUrl(ref.url)
    const video = identity.platform === 'youtube' ? videoById.get(identity.platformId ?? '') : undefined
    return video?.status === 'available' ? [{ url: ref.url, title: ref.title, video }] : []
  })
  const counts: Partial<Record<FormatId, number>> = {}
  for (const ref of data ?? []) counts[ref.format] = (counts[ref.format] ?? 0) + 1
  const niches = [...new Set(data?.map(ref => ref.niche).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'pt-BR'))
  const visible = (data ?? []).filter(ref => {
    const searchable = normalize([ref.title, ref.description, ref.author].join(' '))
    return (!query.trim() || searchable.includes(normalize(query.trim()))) &&
      (!source || identifyUrl(ref.url).platform === source) && (!format || ref.format === format) &&
      (!niche || ref.niche === niche) && (!favorites || ref.favorite)
  }).sort((a,b) => order === 'published' ? b.publication.localeCompare(a.publication) || b.createdAt.localeCompare(a.createdAt) : b.createdAt.localeCompare(a.createdAt))

  async function change(action: () => Promise<Reference[]>, message: string) {
    setBusy(true); setError(''); setStatus('')
    try { setData(await action()); setStatus(message); return true }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false }
    finally { setBusy(false) }
  }
  function exportLibrary() {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, references: data ?? [] }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = 'referencias-post-machine.json'; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
  async function restore(file: File) {
    await change(async () => {
      if (file.size > 50_000_000) throw Error('O backup excede 50 MB.')
      try { return (await restoreReferences(JSON.parse(await file.text()))).list }
      catch (cause) { if (cause instanceof SyntaxError) throw Error('O arquivo não contém um JSON válido.', { cause }); throw cause }
    }, 'Biblioteca restaurada. Referências repetidas foram ignoradas.')
  }
  return <section className="viral-workspace" aria-label="Virais e formatos">
    <div className="segmented" role="group" aria-label="Organização de referências">
      <button aria-pressed={tab === 'library'} onClick={() => setTab('library')}>Biblioteca de referências</button>
      <button aria-pressed={tab === 'formats'} onClick={() => setTab('formats')}>Ver catálogo de formatos</button>
    </div>
    {tab === 'formats' ? <FormatCatalog counts={counts} choose={id => {
      setFormat(id); setSource(''); setNiche(''); setQuery(''); setFavorites(false); setSelected(undefined); setEditing(undefined); setTab('library')
    }} /> : <>
      <div className="viral-controls">
        <label>Buscar referências<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label>Plataforma<select value={source} onChange={event => setSource(event.target.value as Platform | '')}><option value="">Todas</option>{Object.entries(platforms).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>Formato<select value={format} onChange={event => setFormat(event.target.value as FormatId | '')}><option value="">Todos</option>{formats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Filtrar nicho<select value={niche} onChange={event => setNiche(event.target.value)}><option value="">Todos</option>{niches.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Ordenar<select value={order} onChange={event => setOrder(event.target.value)}><option value="created">Cadastro mais recente</option><option value="published">Publicação mais recente</option></select></label>
        <label><input type="checkbox" checked={favorites} onChange={event => setFavorites(event.target.checked)} /> Só favoritas</label>
        <button className="button button-dark" disabled={busy || !data} onClick={() => { setSelected(undefined); setError(''); setEditing(newReference()) }}>Adicionar referência</button>
      </div>
      <div className="viral-controls">
        <button disabled={!data || busy} onClick={exportLibrary}>Exportar biblioteca</button>
        <label>Restaurar biblioteca JSON<input type="file" disabled={busy} accept=".json,application/json" onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (file) void restore(file)
        }} /></label>
      </div>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      {!data && !error && <p role="status">Carregando referências…</p>}
      {editing && <ReferenceForm key={editing.id} initial={editing} busy={busy} close={() => setEditing(undefined)} save={value => {
        void change(() => writeReference(value), 'Referência salva.').then(success => {
          if (success) { setEditing(undefined); setSelected(value.id); setShowPrompt(false) }
        })
      }} />}
      {data && !visible.length && !editing && <p>{data.length ? 'Nenhuma referência corresponde aos filtros.' : 'Sua biblioteca está vazia. Adicione um link para começar.'}</p>}
      {comparison.length > 0 && <section className="viral-card" aria-label="Comparação de métricas">
        <h3>Comparar observações do YouTube</h3>
        <p>Compare dois Shorts identificados pelo link ou dois vídeos de mais de três minutos, publicados com até 48 h de diferença e observados com até 1 h de diferença.</p>
        {comparison.length < 2 ? <p>Selecione mais uma referência.</p> : comparableYouTubePair(comparison[0], comparison[1])
          ? <div className="viral-grid">{comparison.map(item => <div key={item.url}><strong>{item.title}</strong><YouTubeData video={item.video} status={youtube?.status} /></div>)}</div>
          : <p>Os dados selecionados não permitem uma comparação por esses critérios.</p>}
        <button onClick={() => setComparisonIds([])}>Limpar comparação</button>
      </section>}
      {chosen && !editing && <section className="viral-card viral-detail" aria-label="Detalhes da referência">
        <h3 tabIndex={-1} ref={detail}>{chosen.title}</h3>
        <div className="viral-controls"><a href={chosen.url} target="_blank" rel="noreferrer">Abrir fonte original</a>
          <button disabled={busy} onClick={() => setEditing(chosen)}>Editar referência</button>
          <button disabled={busy} onClick={() => {
            if (window.confirm('Excluir esta referência da biblioteca local?')) void change(() => removeReference(chosen.id), 'Referência excluída.').then(success => { if (success) setSelected(undefined) })
          }}>Excluir referência</button>
          {createCampaign && <button className="button button-dark" onClick={() => createCampaign(chosen)}>Criar pauta com esta referência</button>}
        </div>
        <p>Cadastro manual · {chosen.type} · {editorialFormat(chosen.format).name}{chosen.niche && ` · ${chosen.niche}`}</p>
        <p>{chosen.author || 'Autoria não informada'} · {chosen.publication ? 'Publicado em ' + date.format(new Date(chosen.publication)) : 'Publicação desconhecida'} · Cadastrado em {date.format(new Date(chosen.createdAt))}</p>
        {chosen.description && <p>{chosen.description}</p>}
        <dl>{Object.entries(chosen.analysis).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{analysisFields[key as AnalysisField]}</dt><dd>{value}</dd></div>)}</dl>
        <p><strong>Estrutura sugerida pelo catálogo</strong> {editorialFormat(chosen.format).slides}</p>
                {chosenIdentity?.platform === 'youtube' ? <YouTubeData video={videoById.get(chosenIdentity.platformId ?? '')} status={youtube?.status} detailed />
          : <p className="muted">Métricas observadas indisponíveis.</p>}
        <div className="viral-controls"><button aria-expanded={showPrompt} onClick={() => setShowPrompt(value => !value)}>Gerar prompt de análise</button></div>
        {showPrompt && <><label>Prompt de análise<textarea rows={7} readOnly value={editorialPrompt(chosen)} /></label>
          <div className="viral-controls"><button onClick={() => void navigator.clipboard.writeText(editorialPrompt(chosen)).then(() => setStatus('Prompt copiado.'), () => setError('Selecione o texto para copiar.'))}>Copiar prompt de análise</button><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Abrir ChatGPT</a></div>
        </>}
      </section>}
      <div className="viral-grid">{visible.map(ref => {
        const { platform, platformId } = identifyUrl(ref.url)
        const video = platform === 'youtube' && platformId ? videoById.get(platformId) : undefined
        return <article className="viral-card" key={ref.id}>
          <ReferenceThumbnail key={video?.thumbnail ?? platform} platform={platform} thumbnail={video?.thumbnail} />
          <h3>{ref.title}</h3>
          <p>{editorialFormat(ref.format).name}{ref.niche && ` · ${ref.niche}`}</p>
          {ref.author && <small>{ref.author}</small>}
          {platform === 'youtube' && <YouTubeData video={video} status={youtube?.status} />}
          <small>{ref.publication ? 'Publicado em ' + date.format(new Date(ref.publication)) : 'Cadastrado em ' + date.format(new Date(ref.createdAt))}</small>
          <div className="viral-controls">
            <button disabled={busy} aria-pressed={ref.favorite} onClick={() => void change(() => writeReference({ ...ref, favorite: !ref.favorite }), ref.favorite ? 'Removida dos favoritos.' : 'Adicionada aos favoritos.')}>Favoritar</button>
            <button aria-pressed={selected === ref.id} onClick={() => { setSelected(ref.id); setEditing(undefined); setShowPrompt(false) }}>Ver detalhes</button>
            {video?.status === 'available' && video.viewCount !== undefined && <button aria-pressed={comparisonIds.includes(ref.id)} onClick={() => setComparisonIds(ids =>
              ids.includes(ref.id) ? ids.filter(id => id !== ref.id) : [...ids.slice(-1), ref.id])}>Comparar métricas</button>}
          </div>
        </article>
      })}</div>
    </>}
  </section>
}
