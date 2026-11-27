import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { licenseName, licenses, licenseTerms, toCredit, type ImageCredit, type ImageResult } from './contract'
import { automaticOriginal, fetchOriginal, searchImages, SearchLimit, thumbnailUrl, type Search } from './openverse'
import { creditText } from './credits'
import type { AutomaticImage, VisualMatch, VisualRequest } from './automaticSearch'
import { importVisualUrl, rememberManualVisual, visualAlternatives } from './searchOrchestrator'
import { BraveAttribution } from './BraveBudgetStatus'
import './images.css'

export type InsertImage = (file: File, credit?: ImageCredit, signal?: AbortSignal, match?: VisualMatch) => Promise<void>

export function StudioImageSearch({ initialTerm, request, used, insert }: {
  initialTerm: string; request?: VisualRequest; used: ReadonlySet<string>; insert: InsertImage
}) {
  const [term, setTerm] = useState(initialTerm)
  const [url, setUrl] = useState('')
  const [openverse, setOpenverse] = useState(false)
  const [found, setFound] = useState<AutomaticImage[]>([])
  const [alternatives, setAlternatives] = useState<{ key: string; images: AutomaticImage[] }>()
  const [searching, setSearching] = useState(false)
  const [inserting, setInserting] = useState(false)
  const [searchNotice, setSearchNotice] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const search = useRef<AbortController>(null)
  const insertion = useRef<AbortController>(null)
  const signature = request && JSON.stringify([request.key, request.signature, [...used]])
  const readContext = useEffectEvent(() => ({ request, used }))
  useEffect(() => {
    if (!signature) return
    const { request, used } = readContext()
    if (!request) return
    const controller = new AbortController()
    void visualAlternatives(request, used, controller.signal).then(({ results }) => {
      if (!controller.signal.aborted) setAlternatives({ key: signature, images: results })
    }).catch(() => undefined)
    return () => controller.abort()
  }, [signature])
  useEffect(() => () => { search.current?.abort(); insertion.current?.abort() }, [])

  async function run() {
    const query = term.trim()
    if (!request || query.length < 2) return
    search.current?.abort()
    const controller = new AbortController()
    search.current = controller
    setSearching(true); setSearchNotice(''); setFound([])
    try {
      const { results, searched, state } = await visualAlternatives(request, used, controller.signal, query)
      if (controller.signal.aborted) return
      setFound(results)
      setSearchNotice(state === 'limited' ? 'Limite de pesquisa Brave atingido. Use o Openverse ou importe uma imagem.'
        : !searched ? 'A busca contextual está indisponível. Você pode usar o Openverse ou importar uma imagem.'
        : results.length === 0 ? 'A busca não encontrou imagens adequadas para este slide.' : '')
    } catch {
      if (!controller.signal.aborted) setSearchNotice('A busca contextual falhou. Tente novamente.')
    } finally {
      if (search.current === controller && !controller.signal.aborted) setSearching(false)
    }
  }

  async function apply(input: AutomaticImage | File | string) {
    if (insertion.current) return
    const controller = new AbortController()
    insertion.current = controller
    const signal = controller.signal
    setInserting(true); setNotice(''); setError('')
    try {
      if (typeof input === 'string') {
        const { file, credit } = await importVisualUrl(input, signal)
        await insert(file, credit, signal)
        setUrl('')
      } else if (input instanceof File) {
        await insert(input, undefined, signal)
      } else {
        await insert(input.file, input.object.imageCredit as ImageCredit, signal, input.match)
        if (request) rememberManualVisual(request, input)
        setFound(prior => prior.filter(image => image.id !== input.id))
      }
      if (!signal.aborted) setNotice('Imagem aplicada ao slide.')
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível aplicar a imagem.')
    } finally {
      insertion.current = null
      if (!signal.aborted) setInserting(false)
    }
  }

  const local = alternatives?.key === signature ? alternatives?.images ?? [] : []
  const results = [...local, ...found.filter(image => !local.some(item => item.id === image.id))]
    .filter(image => !image.keys.some(key => used.has(key)))
    .sort((left, right) => Number(right.match.classification === 'confirmed') - Number(left.match.classification === 'confirmed'))
    .slice(0, 8)
  return <section className="image-workspace studio-image-search" aria-label="Pesquisa de imagens do slide">
    <BraveAttribution />
    {!!results.length && <div className="image-gallery" aria-label="Alternativas para este slide">
      {results.map(image => {
        const credit = image.object.imageCredit as ImageCredit
        return <article key={image.id} className="image-card">
          <img src={String(image.object.src)} alt={credit.title || 'Imagem da fonte'} loading="lazy" />
          <strong>{credit.title || credit.source || 'Imagem da fonte'}</strong>
          <small>{image.match.classification === 'confirmed' ? 'Material documental' :
            image.match.classification === 'support' ? 'Apoio editorial' : 'Confira a relação com a pauta'}</small>
          <small>{credit.license ? licenseName(credit.license) : 'Licença não informada'} · {String(image.object.width)} × {String(image.object.height)} px</small>
          {credit.sourcePage && <a href={credit.sourcePage} target="_blank" rel="noreferrer">Conferir fonte</a>}
          <button type="button" disabled={inserting} onClick={() => void apply(image)}>
            {image.match.classification === 'support' ? 'Usar fotografia de apoio' : 'Aplicar ao slide'}
          </button>
        </article>
      })}
    </div>}
    <form className="image-filters" onSubmit={event => { event.preventDefault(); void run() }}>
      <label>Consulta visual<input id="studio-image-query" required minLength={2} maxLength={240} value={term} onChange={event => setTerm(event.target.value)} /></label>
      <button type="submit" disabled={!request || searching}>Pesquisar imagens relacionadas</button>
      {searching && <button type="button" onClick={() => { search.current?.abort(); setSearching(false) }}>Cancelar busca</button>}
    </form>
    {searching && <p role="status">Pesquisando imagens relacionadas…</p>}
    {searchNotice && <p role="status">{searchNotice}</p>}
    <form className="image-filters" onSubmit={event => { event.preventDefault(); void apply(url) }}>
      <label>URL da imagem<input type="url" required maxLength={2048} value={url} onChange={event => setUrl(event.target.value)} /></label>
      <button type="submit" disabled={inserting}>Importar URL</button>
    </form>
    <div className="image-actions">
      <button type="button" aria-expanded={openverse} onClick={() => setOpenverse(value => !value)}>Pesquisar no Openverse</button>
      <label>Importar arquivo<input type="file" disabled={inserting} accept="image/png,image/jpeg,image/webp" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (file) void apply(file)
      }} /></label>
    </div>
    {openverse && <ImageSearch initialTerm={term.slice(0, 160)} insert={insert} />}
    {(inserting || notice) && <p role="status">{inserting ? 'Validando a imagem…' : notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}

function Preview({ image }: { image: ImageResult }) {
  const [failed, setFailed] = useState(false)
  const url = thumbnailUrl(image)
  return url && !failed ? <img src={url} alt={image.title || 'Prévia da imagem'} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <span className="image-placeholder">Miniatura indisponível</span>
}
const dimensions = (image: ImageResult) => image.width && image.height ? `${image.width} × ${image.height} px` : 'Dimensões desconhecidas'
const defaults = (query: string): Search => ({ query, page: 1, license: '', commercial: false, ratio: '', source: '' })

export function ImageSearch({ initialTerm, insert, insertLabel = 'Inserir no Studio' }: { initialTerm: string; insert: InsertImage; insertLabel?: string }) {
  const [form, setForm] = useState(() => defaults(initialTerm))
  const [submitted, setSubmitted] = useState<Search>()
  const [results, setResults] = useState<ImageResult[]>()
  const [pages, setPages] = useState(0)
  const [selected, setSelected] = useState<ImageResult>()
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const queryController = useRef<AbortController | null>(null)
  const importController = useRef<AbortController | null>(null)
  const detailsHeading = useRef<HTMLHeadingElement | null>(null)
  useEffect(() => () => { queryController.current?.abort(); importController.current?.abort() }, [])
  useEffect(() => { if (selected) detailsHeading.current?.focus() }, [selected])

  async function run(search: Search) {
    queryController.current?.abort()
    importController.current?.abort()
    const controller = new AbortController()
    queryController.current = controller
    setLoading(true); setSelected(undefined); setError(''); setNotice(''); setResults(undefined)
    try {
      const data = await searchImages(search, controller.signal)
      if (!controller.signal.aborted) { setPages(data.pages); setResults(data.results); setSubmitted(search) }
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof SearchLimit) {
        setError(`Limite de buscas atingido. Tente após ${new Date(cause.until).toLocaleTimeString('pt-BR')}.`)
      } else if (cause instanceof DOMException && cause.name === 'TimeoutError') setError('A busca no Openverse demorou demais. Tente novamente.')
      else setError(cause instanceof TypeError ? 'Não foi possível conectar ao Openverse. Tente novamente.' : String(cause instanceof Error ? cause.message : cause))
    } finally { if (queryController.current === controller) setLoading(false) }
  }
  function select(image: ImageResult) {
    importController.current?.abort()
    setSelected(image); setImportMessage('')
  }
  async function add(image: ImageResult, file?: File) {
    importController.current?.abort()
    const controller = new AbortController()
    importController.current = controller
    setImporting(true); setImportMessage('')
    try {
      const original = file ?? await fetchOriginal(image, controller.signal)
      controller.signal.throwIfAborted()
      await insert(original, toCredit(image), controller.signal)
      if (!controller.signal.aborted) setImportMessage('Imagem inserida com os créditos vinculados.')
    } catch (cause) { if (!controller.signal.aborted) setImportMessage(String(cause instanceof Error ? cause.message : cause)) }
    finally { if (importController.current === controller) setImporting(false) }
  }
  async function copy(image: ImageResult) {
    try { await navigator.clipboard.writeText(creditText(toCredit(image))); setNotice('Atribuição copiada.') }
    catch { setNotice('Não foi possível copiar. Selecione o texto de atribuição no painel.') }
  }
  const terms = selected && licenseTerms(toCredit(selected))
  return <section className="image-workspace" aria-label="Pesquisa de imagens no Openverse">
    <form className="image-filters" onSubmit={event => { event.preventDefault(); void run({ ...form, page: 1 }) }}>
      <label>Termo de pesquisa<input value={form.query} required maxLength={160} onChange={event => setForm({ ...form, query: event.target.value })} /></label>
      <label>Licença<select aria-label="Licença" value={form.license} onChange={event => setForm({ ...form, license: event.target.value })}>
        <option value="">Todas</option>{licenses.map(value => <option key={value} value={value}>{licenseName(value)}</option>)}
      </select></label>
      <label>Proporção<select value={form.ratio} onChange={event => setForm({ ...form, ratio: event.target.value })}><option value="">Todas</option><option value="wide">Horizontal</option><option value="tall">Vertical</option><option value="square">Quadrada</option></select></label>
      <label>Fonte<select aria-label="Fonte do Openverse" value={form.source} onChange={event => setForm({ ...form, source: event.target.value })}><option value="">Todas</option><option value="flickr">Flickr</option><option value="wikimedia">Wikimedia Commons</option><option value="rawpixel">Rawpixel</option><option value="met">The Met</option></select></label>
      <label className="image-check"><input type="checkbox" checked={form.commercial} onChange={event => setForm({ ...form, commercial: event.target.checked })} /> Uso comercial indicado</label>
      <button className="button button-dark" type="submit">Pesquisar</button>
    </form>
    {loading && <p role="status">Pesquisando no Openverse… <button onClick={() => { queryController.current?.abort(); setLoading(false) }}>Cancelar busca</button></p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {results?.length === 0 && <p>Nenhuma imagem encontrada. Experimente outro termo ou filtro.</p>}
    {!!results?.length && <div className="image-gallery">
      {results.map(image => <article key={image.id} className="image-card">
        <Preview image={image} />
        <strong>{image.title || 'Imagem sem título'}</strong>
        <small>{image.creator || 'Autor não informado'} · {image.source || image.provider || 'Fonte desconhecida'}</small>
        <small>{licenseName(image.license)} · {dimensions(image)}</small>
        <button type="button" aria-pressed={selected?.id === image.id} onClick={() => select(image)}>Ver detalhes</button>
      </article>)}
    </div>}
    {submitted && results && <div className="image-pagination">
      <button disabled={loading || submitted.page <= 1} onClick={() => void run({ ...submitted, page: submitted.page - 1 })}>Página anterior</button>
      <span>Página {submitted.page}{pages > 0 ? ` de ${pages}` : ''}</span>
      <button disabled={loading || submitted.page >= pages} onClick={() => void run({ ...submitted, page: submitted.page + 1 })}>Próxima página</button>
    </div>}
    {selected && terms && <section className="image-details" aria-label="Detalhes da imagem selecionada">
      <Preview key={selected.id} image={selected} />
      <div>
        <h3 ref={detailsHeading} tabIndex={-1}>{selected.title || 'Imagem sem título'}</h3>
        <p>{selected.creator_url ? <a href={selected.creator_url} target="_blank" rel="noreferrer">{selected.creator || 'Página do autor'}</a> : selected.creator || 'Autor não informado'}</p>
        <p>{[selected.source, selected.provider !== selected.source && selected.provider, dimensions(selected), selected.filetype?.toUpperCase() || 'Formato desconhecido'].filter(Boolean).join(' · ')}</p>
        <p>{selected.license_url ? <a href={selected.license_url} target="_blank" rel="noreferrer">{licenseName(selected.license)} {selected.license_version}</a> : licenseName(selected.license)}</p>
        <ul>
          <li>{terms.commercial === true ? 'Licença indicada permite uso comercial.' : terms.commercial === false ? 'Licença indicada restringe uso comercial.' : 'Licença incompleta ou desconhecida. Uso comercial não confirmado.'}</li>
          {terms.attribution && <li>Atribuição exigida.</li>}
          {terms.shareAlike && <li>Compartilhamento pela mesma licença para adaptações.</li>}
          {terms.noDerivatives && <li>Restrições à distribuição de adaptações.</li>}
        </ul>
        {selected.attribution && <p className="muted">{selected.attribution}</p>}
        <p>Confira as condições da licença e a página original antes de publicar.</p>
        <div className="image-actions">
          {selected.foreign_landing_url && <a href={selected.foreign_landing_url} target="_blank" rel="noreferrer">Abrir fonte original</a>}
          {selected.url && <a href={selected.url} target="_blank" rel="noreferrer">Abrir arquivo original</a>}
          <button onClick={() => void copy(selected)}>Copiar atribuição</button>
          {automaticOriginal(selected) && <button className="button button-dark" disabled={importing} onClick={() => void add(selected)}>{insertLabel}</button>}
        </div>
        {!automaticOriginal(selected) && <p>Para esta fonte ou formato, baixe o original e importe um PNG, JPEG ou WebP com os créditos selecionados.</p>}
        <label>Importar arquivo com estes créditos<input type="file" disabled={importing} accept="image/png,image/jpeg,image/webp" onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (file) void add(selected, file)
        }} /></label>
        {importing && <p role="status">Validando o original…</p>}
        {importMessage && <p role="status">{importMessage}</p>}
      </div>
    </section>}
  </section>
}
