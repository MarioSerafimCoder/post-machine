import { useEffect, useRef, useState } from 'react'
import { licenseName, licenses, licenseTerms, toCredit, type ImageCredit, type ImageResult } from './contract'
import { automaticOriginal, fetchOriginal, searchImages, SearchLimit, thumbnailUrl, type Search } from './openverse'
import { creditText } from './credits'
import './images.css'

export type InsertImage = (file: File, credit?: ImageCredit, signal?: AbortSignal) => Promise<void>

function Preview({ image }: { image: ImageResult }) {
  const [failed, setFailed] = useState(false)
  const url = thumbnailUrl(image)
  return url && !failed ? <img src={url} alt={image.title || 'Prévia da imagem'} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <span className="image-placeholder">Miniatura indisponível</span>
}
const dimensions = (image: ImageResult) => image.width && image.height ? `${image.width} × ${image.height} px` : 'Dimensões desconhecidas'
const defaults = (query: string): Search => ({ query, page: 1, license: '', commercial: false, ratio: '', source: '' })

export function ImageSearch({ initialTerm, insert }: { initialTerm: string; insert: InsertImage }) {
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
      } else setError(cause instanceof TypeError ? 'Não foi possível conectar ao Openverse. Tente novamente.' : String(cause instanceof Error ? cause.message : cause))
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
      <label>Licença<select value={form.license} onChange={event => setForm({ ...form, license: event.target.value })}>
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
          {automaticOriginal(selected) && <button className="button button-dark" disabled={importing} onClick={() => void add(selected)}>Inserir no Studio</button>}
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
