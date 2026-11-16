import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ContextRail, ContextWorkspace, type ContextTool } from '../../components/ContextRail'
import { maxImport, maxSlides, type Draft } from '../campaigns/contract'
import { readCampaigns } from '../campaigns/storage'
import { ImageSearch } from '../images/ImageSearch'
import { ImageLibrary } from '../images/ImageLibrary'
import type { ImageCredit } from '../images/contract'
import { fetchExternalImage } from '../images/openverse'
import { buildCollectionProject, collections, type CollectionSlide, composeCollection, compositionNames, collectionBrand, prepareCollectionImage } from './collections'
import { CollectionGallery } from './CollectionGallery'
import { bodyLimit, fromStructured, parseExpress, titleLimit } from './expressContent'
import { renderScene } from './export'
import { loadFonts } from './fonts'
import { readImage } from './images'
import { dimensions, formatNames, type Brand, type Format, type Project } from './model'
import { sceneForCollection } from './collectionPosition'
import './collections.css'

const tools: ContextTool[] = [
  { label: 'Conteúdo', icon: 'text' }, { label: 'Imagens', icon: 'image' },
  { label: 'Templates', icon: 'studio' }, { label: 'Prévia', icon: 'audit' },
]
type Step = typeof tools[number]['label']
type Entry = CollectionSlide & { key: string; imageId?: string }
type Photo = { id: string; name: string; bytes: number; object: Record<string, unknown> }
const noFlush = async () => {}
const maxImages = 30
const maxImageBytes = 80_000_000
const key = () => crypto.randomUUID()
const entry = (data: CollectionSlide = { title:'', body:'' }): Entry => ({ ...data, key:key() })
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
const fieldNames: Record<string,string> = { title:'título', subtitle:'subtítulo', body:'texto', cta:'chamada', brand:'marca' }

function Preview({ project, index }: { project: Project; index: number }) {
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const abort = new AbortController()
    let url = ''
    const [width,height] = dimensions[project.format]
    void renderScene(project.slides[index].scene,width,height,{ scale:.36, signal:abort.signal }).then(({blob}) => {
      if (!abort.signal.aborted) { url=URL.createObjectURL(blob); setSrc(url) }
    }, cause => { if (!abort.signal.aborted) setError(errorText(cause)) })
    return () => { abort.abort(); if (url) URL.revokeObjectURL(url) }
  },[project,index])
  return src ? <img alt={`Prévia do slide ${index+1}`} src={src} />
    : <p role={error ? 'alert' : 'status'}>{error || 'Renderizando prévia…'}</p>
}

export function Express({ active, brand, format: initialFormat, cancel, open }: {
  active: boolean; brand: Brand; format: Format; cancel: () => void; open: (project: Project) => Promise<void>
}) {
  const [step, setStep] = useState<Step>('Conteúdo')
  const [text, setText] = useState('')
  const [slides, setSlides] = useState<Entry[]>(() => [entry()])
  const [campaigns, setCampaigns] = useState<Draft[]>()
  const [linked, setLinked] = useState<Draft>()
  const [name, setName] = useState('')
  const [style, setStyle] = useState(collections[0])
  const [format, setFormat] = useState(initialFormat)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoId, setPhotoId] = useState('')
  const [origin, setOrigin] = useState<'local' | 'openverse' | 'library' | 'url'>('local')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [preview, setPreview] = useState<{ project: Project; issues: string[][] }>()
  const [previewIndex, setPreviewIndex] = useState(0)
  const operation = useRef(false)
  const dragged = useRef<string | undefined>(undefined)
  const live = useRef(true)
  const externalRequest = useRef<AbortController | null>(null)
  useEffect(() => {
    live.current = true
    void readCampaigns().then(data => { if (live.current) setCampaigns(data.campaigns.filter(draft => draft.content)) },
      () => { if (live.current) setStatus('Não foi possível ler campanhas locais. Você ainda pode colar conteúdo.') })
    return () => { live.current = false; externalRequest.current?.abort() }
  },[])

  function change(slide: string, patch: Partial<Entry>) {
    setSlides(value => value.map(item => item.key === slide ? { ...item, ...patch } : item))
  }
  function organize(values: CollectionSlide[]) {
    setSlides(previous => values.map((item,index) => ({ ...entry(item), imageId:previous[index]?.imageId })))
  }
  function applyText() {
    try {
      const result = parseExpress(text)
      organize(result.slides)
      setLinked(undefined)
      if (result.structured) {
        setName(result.structured.campaign.title.slice(0,100))
        if (result.structured.campaign.format === 'story') setFormat('story')
      }
      setError('')
    } catch (cause) { setError(errorText(cause)) }
  }
  function loadCampaign(id: string) {
    const item = campaigns?.find(draft => draft.id === id)
    if (!item?.content) return
    organize(fromStructured(item.content)); setLinked(item); setName(item.content.campaign.title.slice(0,100))
    if (item.content.campaign.format === 'story') setFormat('story')
    setError('')
  }

  async function imagePhoto(file: File, credit?: ImageCredit, signal?: AbortSignal): Promise<Photo> {
    const buffer = await file.arrayBuffer()
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))
    const id = Array.from(hash, byte => byte.toString(16).padStart(2,'0')).join('')
    signal?.throwIfAborted()
    const image = await readImage(file)
    try {
      signal?.throwIfAborted()
      if (credit) image.set({ imageCredit: credit })
      return { id, name:file.name, bytes:file.size, object:prepareCollectionImage(image) }
    } finally { image.dispose() }
  }
  async function addPhotos(files: File[], credit?: ImageCredit, signal?: AbortSignal) {
    if (operation.current) throw Error('Aguarde a importação atual.')
    if (files.length > maxImages) throw Error(`Selecione até ${maxImages} imagens por vez.`)
    operation.current = true
    setBusy(true)
    setStatus('')
    setError('')
    const next = [...photos]
    const failures: string[] = []
    let added = 0
    try {
      for (const file of files) {
        try {
          if (file.size > 20_000_000) throw Error('Máximo de 20 MB por imagem.')
          const item = await imagePhoto(file,credit,signal)
          const previous = next.findIndex(photo => photo.id === item.id)
          if (previous >= 0) {
            if (credit && !next[previous].object.imageCredit) next[previous] = item
            continue
          }
          if (next.length >= maxImages || next.reduce((sum,photo) => sum+photo.bytes,0)+item.bytes > maxImageBytes)
            throw Error('Limite da preparação: 30 imagens e 80 MB no total.')
          next.push(item); added++
        } catch (cause) { failures.push(`${file.name}: ${errorText(cause)}`) }
      }
      if (!live.current) return
      if (!added && failures.length && files.length === 1) throw Error(failures[0])
      setPhotos(next)
      setPhotoId(current => current || next[0]?.id || '')
      setStatus(added ? `${added} imagem(ns) adicionada(s).` : 'Estas imagens já estão na preparação.')
      if (failures.length) setError(failures.join(' '))
    } finally { operation.current = false; if (live.current) setBusy(false) }
  }
  async function external() {
    if (externalRequest.current || operation.current) return
    const controller = new AbortController()
    externalRequest.current = controller
    setDownloading(true)
    setError('')
    try {
      const file = await fetchExternalImage(url,controller.signal)
      controller.signal.throwIfAborted()
      await addPhotos([file],undefined,controller.signal)
      if (live.current) setUrl('')
    } catch (cause) { if (live.current) setError(errorText(cause)) }
    finally { externalRequest.current = null; if (live.current) setDownloading(false) }
  }
  function movePhoto(id: string, target: string) {
    setPhotos(items => {
      const updated = [...items]
      const from = updated.findIndex(item => item.id === id), to = updated.findIndex(item => item.id === target)
      if (from < 0 || to < 0 || from === to) return items
      updated.splice(to,0,updated.splice(from,1)[0])
      return updated
    })
  }
  function removePhoto(id: string) {
    setPhotos(items => items.filter(item => item.id !== id))
    setSlides(items => items.map(item => item.imageId === id ? { ...item, imageId:undefined } : item))
    if (photoId === id) setPhotoId('')
  }
  const inputs = slides.map(slide => ({ ...slide, image:photos.find(photo => photo.id === slide.imageId)?.object }))
  const invalid = slides.map((slide,index) => {
    if (!slide.title.trim() && !slide.body.trim()) return `Slide ${index+1}: adicione título ou texto.`
    if (slide.title.length > titleLimit || (slide.subtitle?.length ?? 0) > titleLimit ||
      slide.body.length > bodyLimit || (slide.cta?.length ?? 0) > bodyLimit) return `Slide ${index+1}: revise os limites de caracteres.`
    return ''
  }).filter(Boolean)
  async function prepare() {
    const branded = collectionBrand(style,brand)
    await loadFonts(branded)
    const project = buildCollectionProject(style,format,brand,inputs,name || slides[0]?.title || 'Produção Expressa')
    if (linked) {
      project.campaignId = linked.id
      project.campaignUpdatedAt = linked.updatedAt
    }
    const issues = inputs.map((slide,index) => composeCollection(style,sceneForCollection(slide,index,inputs.length),slide,branded,format).issues)
    return { project, issues }
  }
  async function showPreview() {
    setStep('Prévia')
    setPreview(undefined)
    setPreviewIndex(0)
    if (invalid.length) return
    setBusy(true)
    try { setPreview(await prepare()) }
    catch (cause) { setError(errorText(cause)) }
    finally { setBusy(false) }
  }
  async function create() {
    if (operation.current || invalid.length) return
    setBusy(true); setError(''); operation.current = true
    try { await open((preview ?? await prepare()).project) }
    catch (cause) { setError(errorText(cause)) }
    finally { operation.current = false; if (live.current) setBusy(false) }
  }
  function selectStep(value: string) {
    if (busy || downloading) return
    setStatus(''); setError('')
    if (value === 'Prévia') void showPreview()
    else setStep(value)
  }

  let panel: ReactNode
  if (step === 'Conteúdo') panel = <div className="express-content">
    <div className="express-paste">
      <label>Cole aqui o conteúdo do seu post ou carrossel<textarea rows={7} value={text} maxLength={maxImport}
        placeholder={'Slide 1 — Seu título\nTexto do primeiro slide\n\nSlide 2\nTexto do segundo slide'}
        onChange={event => setText(event.target.value)} /></label>
      <p className="muted">Use JSON, Markdown de campanha ou texto com marcações “Slide 1”, “Slide 2” etc.</p>
      <div className="collection-actions">
        <button className="button button-dark" onClick={applyText}>Organizar slides</button>
        {!!campaigns?.length && <label>Carregar campanha do Radar<select value={linked?.id ?? ''} onChange={event => loadCampaign(event.target.value)}>
          <option value="">Selecione uma campanha</option>
          {campaigns.map(draft => <option key={draft.id} value={draft.id}>{draft.content?.campaign.title}</option>)}
        </select></label>}
      </div>
    </div>
    <label>Nome do projeto<input value={name} maxLength={100} onChange={event => setName(event.target.value)} placeholder="Opcional" /></label>
    <div className="express-slides">{slides.map((slide,index) => <article key={slide.key}>
      <header><h3>Slide {String(index+1).padStart(2,'0')}</h3><div className="collection-actions">
        {([-1,1] as const).map(delta => <button key={delta} className="button button-outline" disabled={!slides[index+delta]}
          aria-label={delta < 0 ? `Mover slide ${index+1} para cima` : `Mover slide ${index+1} para baixo`}
          onClick={() => setSlides(items => {
            const updated=[...items]; [updated[index],updated[index+delta]]=[updated[index+delta],updated[index]]; return updated
          })}>{delta < 0 ? '↑' : '↓'}</button>)}
        <button className="button button-outline" aria-label={`Remover slide ${index+1}`} disabled={slides.length <= 1}
          onClick={() => setSlides(items => items.filter(item => item.key !== slide.key))}>Remover</button>
      </div></header>
      <label>Título<input value={slide.title} onChange={event => change(slide.key,{title:event.target.value, headlines:undefined})} /></label>
      <label>Subtítulo<input value={slide.subtitle ?? ''} onChange={event => change(slide.key,{subtitle:event.target.value})} /></label>
      <label>Texto<textarea rows={3} value={slide.body} onChange={event => change(slide.key,{body:event.target.value})} /></label>
      <label>Chamada para ação<input value={slide.cta ?? ''} onChange={event => change(slide.key,{cta:event.target.value})} /></label>
    </article>)}</div>
    <button className="button button-outline" disabled={slides.length >= maxSlides} onClick={() => setSlides(items => [...items,entry()])}>Adicionar slide</button>
  </div>
  else if (step === 'Imagens') panel = <>
    <nav aria-label="Origem das imagens da produção" className="collection-actions">
      {([['local','Arquivos locais'],['openverse','Openverse'],['library','Imagens utilizadas'],['url','Link externo']] as const).map(([value,label]) =>
        <button key={value} className="button button-outline" aria-pressed={origin === value} disabled={busy || downloading} onClick={() => setOrigin(value)}>{label}</button>)}
    </nav>
    {origin === 'local' && <div className="express-drop" onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault(); if (!busy) void addPhotos(Array.from(event.dataTransfer.files)).catch(cause => setError(errorText(cause)))
    }}><label>Adicionar imagens<input type="file" multiple disabled={busy} accept="image/png,image/jpeg,image/webp" onChange={event => {
      const files = Array.from(event.target.files ?? [])
      event.target.value = ''
      if (files.length) void addPhotos(files).catch(cause => setError(errorText(cause)))
    }} /></label><p className="muted">Arraste PNG, JPEG ou WebP. Até 20 MB por imagem.</p></div>}
    {active && origin === 'openverse' && <ImageSearch initialTerm="" insertLabel="Adicionar à produção" insert={(file,credit,signal) => addPhotos([file],credit,signal)} />}
    {active && origin === 'library' && <ImageLibrary flush={noFlush} success="Imagem adicionada à produção." insert={(file,credit,signal) => addPhotos([file],credit,signal)} />}
    {origin === 'url' && <div className="collection-actions"><label>URL externa da imagem<input type="url" value={url} onChange={event => setUrl(event.target.value)} /></label>
      <button className="button button-dark" disabled={busy || downloading || !url.trim()} onClick={() => void external()}>Importar imagem</button></div>}
    {!!photos.length && <>
      <div className="collection-actions"><h3>Imagens da produção</h3><button className="button button-outline" disabled={busy}
        onClick={() => setSlides(items => items.map((item,index) => ({ ...item,imageId:photos[index]?.id })))}>Distribuir na ordem</button></div>
      <div className="express-photos">{photos.map((photo,index) => <article key={photo.id} draggable={!busy}
        onDragStart={() => { dragged.current=photo.id }} onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault(); if (dragged.current) movePhoto(dragged.current,photo.id); dragged.current=undefined
        }}>
        <button className="express-photo" aria-pressed={photoId === photo.id} onClick={() => setPhotoId(photo.id)}>
          <img src={String(photo.object.src)} alt="" /><span>{photo.name}</span>
        </button>
        <small>{slides.some(item => item.imageId === photo.id) ? 'Vinculada' : 'Não utilizada'}</small>
        <div className="collection-actions">
          <button className="button button-outline" aria-label={`Antecipar imagem ${index+1}`} disabled={busy || index === 0} onClick={() => movePhoto(photo.id,photos[index-1].id)}>←</button>
          <button className="button button-outline" aria-label={`Adiar imagem ${index+1}`} disabled={busy || index === photos.length-1} onClick={() => movePhoto(photo.id,photos[index+1].id)}>→</button>
          <button className="button button-outline" aria-label={`Remover imagem ${index+1}`} disabled={busy} onClick={() => removePhoto(photo.id)}>×</button>
        </div>
      </article>)}</div>
      <div className="express-assignment">{photos.find(photo => photo.id === photoId) && <img
        src={String(photos.find(photo => photo.id === photoId)!.object.src)} alt="Imagem selecionada" />}
        <div>{slides.map((slide,index) => <label key={slide.key}>Imagem do slide {index+1}<select value={slide.imageId ?? ''}
          onChange={event => change(slide.key,{imageId:event.target.value || undefined})}>
          <option value="">Sem imagem</option>{photos.map((photo,i) => <option value={photo.id} key={photo.id}>{i+1} · {photo.name}</option>)}
        </select></label>)}</div></div>
    </>}
  </>
  else if (step === 'Templates') panel = <CollectionGallery selected={style.id} format={format} setFormat={setFormat} use={value => {
    setStyle(value); setStatus(`${value.name} selecionada.`)
  }} />
  else panel = <>
    <div className="express-summary"><h3>{slides.length} {slides.length === 1 ? 'slide' : 'slides'}</h3>
      <p>{style.name} · {formatNames[format]} · {brand.name || brand.handle || (collectionBrand(style,brand) === brand ? 'Marca local' : 'Paleta da coleção')}</p></div>
    {!!invalid.length && <ul className="express-warnings">{invalid.map(message => <li key={message}>{message}</li>)}</ul>}
    <div className="express-review">
      <div className="express-preview">{preview && <Preview key={previewIndex} project={preview.project} index={previewIndex} />}</div>
      <div className="express-review-list">{slides.map((slide,index) => <article key={slide.key}>
        <button className="button button-outline" aria-pressed={previewIndex === index} onClick={() => setPreviewIndex(index)}>Slide {index+1} · {compositionNames[sceneForCollection(inputs[index],index,inputs.length)]}</button>
        <strong>{slide.title || 'Sem título'}</strong>
        {slide.subtitle && <p>{slide.subtitle}</p>}
        <p>{slide.body || 'Sem corpo de texto'}</p>
        {slide.cta ? <small>Chamada: {slide.cta}</small> :
          sceneForCollection(inputs[index],index,inputs.length) === 5 && <small>Encerramento sem chamada para ação</small>}
        <small>{photos.find(photo => photo.id === slide.imageId)?.name ?? 'Área de imagem editável'}</small>
        {preview?.issues[index].map(issue => <p className="express-warning" key={issue}>Possível excesso no campo {fieldNames[issue]}. O texto será preservado.</p>)}
      </article>)}</div>
    </div>
    <button className="button button-dark" disabled={busy || !!invalid.length || !preview} onClick={() => void create()}>
      {slides.length === 1 ? 'Criar meu post' : 'Criar meu carrossel'}
    </button>
  </>

  return <section className="express" aria-label="Produção Expressa">
    <header><h2>Produção Expressa</h2><button className="button button-outline" disabled={busy || downloading} onClick={cancel}>Voltar aos projetos</button></header>
    <ContextWorkspace rail={<ContextRail label="Etapas da Produção Expressa" tools={tools} selected={step} choose={selectStep} />}>
      <div className="express-panel">
        {(busy || downloading) && <p role="status">{downloading ? 'Baixando imagem…' : 'Preparando…'}</p>}
        {error && <p className="express-warning" role="alert">{error}</p>}
        {status && <p role="status">{status}</p>}
        {panel}
      </div>
    </ContextWorkspace>
  </section>
}
