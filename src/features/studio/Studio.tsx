import { ContextHeader, ContextRail, type ContextTool } from '../../components/ContextRail'
import { ImageSearch } from '../images/ImageSearch'
import { ImageLibrary } from '../images/ImageLibrary'
import type { ImageCredit } from '../images/contract'
import { HeadlinePanel } from '../headlines/HeadlinePanel'
import { campaignHeadlineContext } from '../headlines/context'
import { readCampaign } from '../campaigns/storage'
import { replaceTextboxText } from './editText'
import { measureTitle } from './headlineFit'
import { CampaignStart, type CampaignStartMode } from '../campaigns/CampaignStart'
import { loadFonts } from './fonts'
import { useDocument } from './useDocument'
import { listProjects, loadProject, loadRecovery, removeProject, readBrand, backupProject, restoreProject, saveProject } from './storage'
import { download } from './export'
import { ExportPanel } from './ExportPanel'
import type { Draft } from '../campaigns/contract'
import { templates, compose, semantics, fromCampaign, type Template } from './templates'
import { BrandPanel } from './BrandPanel'
import { Slides, type SlideReview } from './Slides'
import { lazy, Suspense, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { ActiveSelection, Canvas, FabricImage, Textbox } from 'fabric'
import { CanvasView } from './CanvasView'
import { Properties } from './Properties'
import { defaultBrand, emptySlide, dimensions, formatNames, newProject, newProjectBrand, type Format, type Project } from './model'
import { addObject, duplicate, sceneOf } from './objects'
import { cropImage, readImage } from './images'
import './studio.css'
import { StorageSettings } from './StorageSettings'
import { AuditPanel } from '../audit/AuditPanel'
import { useAuditAssistant } from '../intelligence/auditSignal'
import { campaignScope } from '../intelligence/feedback'
import type { AuditReport, Finding } from '../audit/contract'
import { sameReviewSettings, sameReviewVersion, type Review } from '../audit/review'
import { resolvePage } from '../../lib/navigation'
import { applyCollectionBrand, buildCollectionProject, demoSlides, type Collection } from './collections'
import './collections.css'

const Express = lazy(() => import('./Express').then(module => ({ default: module.Express })))
const CollectionGallery = lazy(() => import('./CollectionGallery').then(module => ({ default: module.CollectionGallery })))

const studioTools: ContextTool[] = [
  { label: 'Templates', icon: 'studio' }, { label: 'Texto', icon: 'text' },
  { label: 'Imagens', icon: 'image' }, { label: 'Elementos', icon: 'shape' },
  { label: 'Minha marca', icon: 'shield' }, { label: 'Camadas', icon: 'layers' },
]
const backupInterval = 7 * 24 * 60 * 60 * 1000
const backupDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const backupKey = (id: string) => `post-machine:studio-backup:${id}`

function readBackupDate(id: string) {
  try {
    const date = Date.parse(localStorage.getItem(backupKey(id)) ?? '')
    return Number.isFinite(date) ? date : undefined
  } catch { return undefined }
}

export function Studio({ request, active, onStartCampaign }: { request: { draft: Draft; mode?: 'express' } | null; active: boolean; onStartCampaign: (mode: CampaignStartMode) => void }) {
  const [expressDraft, setExpressDraft] = useState<Draft>()
  const [error, setError] = useState('')
  const { project, setProject, undo, redo, history, status, saveFailed, flush, getCurrent } = useDocument()
  const [backupTimes, setBackupTimes] = useState<Record<string, number>>({})
  const [backupPending, setBackupPending] = useState(false)
  const [backupClock, setBackupClock] = useState(Date.now)
  const lastBackup = project && (backupTimes[project.id] ?? readBackupDate(project.id))
  const backupDue = lastBackup === undefined || backupClock - lastBackup >= backupInterval
  useEffect(() => {
    if (!active) return
    const update = () => setBackupClock(Date.now())
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [active])
  const [library, setLibrary] = useState<Project[]>([])
  const [brand, setBrand] = useState(defaultBrand)
  const [entry, setEntry] = useState<'express' | 'collections'>()
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const [exportProjectId, setExportProjectId] = useState<string>()
  const exportToggle = useRef<HTMLButtonElement>(null)
  const exportOpen = !!project && project.id === exportProjectId
  const [auditOpen,setAuditOpen]=useState(false)
  const [reviewedSlides, setReviewedSlides] = useState<Map<string, SlideReview>>(() => new Map())
  const [fullReview, setFullReview] = useState<Review>()
  const [guidance, setGuidance] = useState<{ finding: Finding; project: Project }>()
  const [imagePanel, setImagePanel] = useState<{ tab: 'search' | 'library'; slideId: string; term: string; request: number }>()
  const focusPath=useRef<string|null>(null)
  useEffect(() => { void listProjects().then(setLibrary, () => setError('Não foi possível carregar os projetos.')); void readBrand().then(value => { if (value) setBrand(newProjectBrand(value)) }, () => undefined) }, [])
  async function back() {
    try {
      await flush()
      setLibrary(await listProjects())
      await flush()
      setExportProjectId(undefined)
      setError('')
      setProject(undefined)
    } catch { setError('Falha ao salvar. Faça um backup antes de sair ou tente salvar novamente.') }
  }
  const [current, setCurrent] = useState(0)
  const [revision, setRevision] = useState(0)
  const currentRef = useRef(0)
  const [format, setFormat] = useState<Format>('portrait')
  const [manualZoom, setManualZoom] = useState<number>()
  const [fitZoom, setFitZoom] = useState(.1)
  const zoom = manualZoom ?? fitZoom
  const [guides, setGuides] = useState(true)
  const [framesOpen, setFramesOpen] = useState(true)
  const [panel, setPanel] = useState<string | null>('Texto')
  const [, refresh] = useState(0)
  const canvas = useRef<Canvas | null>(null)
  const [readyCanvas, setReadyCanvas] = useState<Canvas | null>(null)
  const snapshotCanvas = useCallback((record: boolean) => {
    if (!canvas.current) return
    const scene = sceneOf(canvas.current)
    setProject(p => p && ({ ...p, updatedAt: new Date().toISOString(), slides: p.slides.map((s, i) => i === currentRef.current ? { ...s, scene: { ...scene, ...(s.scene.contentImage ? { contentImage: s.scene.contentImage } : {}) } } : s) }), record)
    refresh(n => n + 1)
  }, [setProject, refresh])
  const changed = useCallback(() => snapshotCanvas(true), [snapshotCanvas])
  const [headlineTarget, setHeadlineTarget] = useState<Textbox>()
  const [linkedCampaign, setLinkedCampaign] = useState<Draft>()
  const campaignId = project?.campaignId
  useEffect(() => {
    if (!campaignId) return
    let live = true
    void readCampaign(campaignId).then(value => { if (live) setLinkedCampaign(value) }, () => undefined)
    return () => { live = false }
  }, [campaignId])
  const selectedObject = readyCanvas?.getActiveObject()
  const selectedTitle = selectedObject instanceof Textbox && selectedObject.semantic === 'title' ? selectedObject : undefined
  const campaign = request?.draft.id === campaignId ? request?.draft : linkedCampaign?.id === campaignId ? linkedCampaign : undefined
  function moveHistory(redoAction: boolean) {
    const id = getCurrent()?.slides[currentRef.current]?.id
    const next = redoAction ? redo() : undo()
    if (!next) return
    const index = next.slides.findIndex(slide => slide.id === id)
    chooseSlide(index >= 0 ? index : Math.min(currentRef.current, next.slides.length - 1))
    setRevision(value => value + 1)
  }
  const historyKey = useEffectEvent(moveHistory)
  useEffect(() => {
    if (!active) return
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || resolvePage(window.location.hash) !== 'studio' || document.querySelector('dialog[open]') || !canvas.current || event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable=true]')) return
      const selected = canvas.current.getActiveObject()
      if (selected instanceof Textbox && selected.isEditing) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); historyKey(event.shiftKey); return }
      if (event.key === 'Delete' && selected) { event.preventDefault(); canvas.current.remove(...canvas.current.getActiveObjects()); canvas.current.discardActiveObject(); changed() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selected) {
        const target = canvas.current
        event.preventDefault()
        void duplicate(target).then(() => { if (canvas.current === target) changed() }, () => setError('Não foi possível duplicar o elemento.'))
      }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [active, changed])
  function replace(value: Project, fromStorage = false) { setProject(value, !fromStorage, fromStorage); setRevision(n => n + 1) }
  function chooseSlide(index: number) { currentRef.current = index; setCurrent(index) }
  function selectPath(path:string|null){if(!path||!canvas.current)return;const object=canvas.current.getObjects()[Number(path.split('.')[0])];if(object){canvas.current.setActiveObject(object);canvas.current.requestRenderAll();refresh(n=>n+1)}}
  function focusFinding(finding: Finding) {
    if (!project) return
    const index = project.slides.findIndex(slide => slide.id === finding.slideId)
    if (index < 0) return
    setGuidance({ finding, project })
    setAuditOpen(true)
    focusPath.current = finding.objectId
    chooseSlide(index)
    if (index === current) {
      selectPath(finding.objectId)
      focusPath.current = null
    }
    requestAnimationFrame(() => {
      const stage = document.querySelector<HTMLElement>('.canvas-stage')
      stage?.focus({ preventScroll: true })
      stage?.scrollIntoView({ block:'center' })
    })
  }
  function receiveReview(report: AuditReport, source: Project, index?: number) {
    if (index === undefined) setFullReview({ project: source, report })
    setReviewedSlides(previous => new Map(source.slides.flatMap((slide, i) => {
      if (index !== undefined && index !== i) {
        const existing = previous.get(slide.id)
        return existing && sameReviewSettings(existing.project,source) ? [[slide.id,existing] as const] : []
      }
      const findings = report.findings.filter(finding => finding.slideId === slide.id)
      return [[slide.id, { project:source, scene:slide.scene,
        errors:findings.filter(f => f.severity === 'error').length,
        warnings:findings.filter(f => f.severity === 'warning').length }] as const]
    })))
  }
  const receiveAuditFocus=useEffectEvent(async(raw:string)=>{try{const target=JSON.parse(raw) as {projectId:string;slideId:string;objectId:string|null};await flush();const value=await loadProject(target.projectId);const index=value.slides.findIndex(slide=>slide.id===target.slideId);focusPath.current=target.objectId;chooseSlide(Math.max(0,index));replace(value, true);setAuditOpen(true)}catch(cause){setError(String(cause))}})
  useEffect(()=>{const receive=()=>{if(window.location.hash!=='#/studio')return;const raw=sessionStorage.getItem('post-machine:audit-focus')??sessionStorage.getItem('direto:audit-focus');if(!raw)return;sessionStorage.removeItem('post-machine:audit-focus');sessionStorage.removeItem('direto:audit-focus');queueMicrotask(()=>void receiveAuditFocus(raw))};receive();window.addEventListener('hashchange',receive);return()=>window.removeEventListener('hashchange',receive)},[])
  async function openProject(id: string) { try { await flush(); const value = await loadProject(id); chooseSlide(0); replace(value, true); setError('') } catch (e) { setError(String(e)) } }
  async function downloadBackup() {
    const snapshot = getCurrent()
    if (!snapshot || backupPending) return
    setBackupPending(true)
    try {
      const blob = await backupProject(snapshot)
      download(blob, 'post-machine-projeto.zip')
      const at = Date.now()
      setBackupTimes(times => ({ ...times, [snapshot.id]: at }))
      setBackupClock(at)
      setError('')
      try { localStorage.setItem(backupKey(snapshot.id), new Date(at).toISOString()) }
      catch { setError('O ZIP foi enviado para download. O navegador não conseguiu guardar a data para a próxima sessão.') }
    } catch { setError('Não foi possível gerar o backup deste projeto.') }
    finally { setBackupPending(false) }
  }
  async function deleteProject(item: Project) {
    if (!window.confirm('Excluir este projeto local?')) return
    try {
      const removed = await removeProject(item)
      setLibrary(await listProjects())
      setError(removed ? '' : 'O projeto mudou em outra aba. Confira a versão atual antes de excluir.')
    } catch { setError('Não foi possível excluir o projeto. Recarregue a página para conferir a biblioteca.') }
  }
  const handleRequest = useEffectEvent(async ({draft,mode}: NonNullable<typeof request>) => {
    try {
      await flush()
      if (mode === 'express' && draft.content) {
        setExpressDraft(draft)
        setProject(undefined)
        setEntry('express')
      } else {
        const savedBrand = newProjectBrand(await readBrand() ?? brand)
        await loadFonts(savedBrand)
        chooseSlide(0)
        replace(fromCampaign(draft,savedBrand))
      }
    } catch (e) { setError(String(e)) }
  })
  const handled = useRef<typeof request>(null)
  useEffect(() => { if (request && handled.current !== request) { handled.current = request; void handleRequest(request) } }, [request])
  function template(layout: Template) {
    if (!project) return
    if (project.slides[current].scene.objects.length && !window.confirm('Trocar template preserva textos e imagem, mas recompõe os ajustes gráficos. Continuar?')) return
    replace({ ...project, slides: project.slides.map((s, i) => i === current ? { ...s, layout, scene: compose(layout, semantics(s.scene), project.brand, project.format, s.role) } : s) })
  }
  function reorderFrame(from: number, to: number) {
    if (!project || from === to || !project.slides[from] || !project.slides[to]) return
    const slides = [...project.slides]
    const [moved] = slides.splice(from,1)
    slides.splice(to,0,moved)
    const selectedId = project.slides[current].id
    chooseSlide(slides.findIndex(slide => slide.id === selectedId))
    setProject({ ...project, slides })
  }
  function slideAction(action: 'add' | 'duplicate' | 'remove' | 'up' | 'down') {
    if (!project) return
    const slides = [...project.slides]
    let next = current
    if (action === 'add') { slides.push(emptySlide(project.brand.background)); next = slides.length - 1 }
    if (action === 'duplicate') { slides.splice(current + 1, 0, { ...structuredClone(slides[current]), id: crypto.randomUUID() }); next++ }
    if (action === 'remove') { if (!window.confirm('Excluir este slide?')) return; slides.splice(current, 1); next = Math.min(current, slides.length - 1) }
    if (action === 'up' || action === 'down') { next += action === 'up' ? -1 : 1; [slides[next], slides[current]] = [slides[current], slides[next]] }
    chooseSlide(next); setProject({ ...project, slides })
  }
  function openImages(tab: 'search' | 'library', useBrief = false) {
    const slide = project?.slides[current]
    if (!slide) return
    const term = useBrief ? (slide.imageBrief.trim() || semantics(slide.scene).title.trim()).replace(/\s+/g, ' ').slice(0, 160) : ''
    setPanel('Imagens')
    setImagePanel(value => ({ tab, slideId: slide.id, term, request: (value?.request ?? 0) + 1 }))
  }
  async function insertImage(file: File, credit?: ImageCredit, signal?: AbortSignal) {
    const target = readyCanvas
    const slideId = project?.slides[current]?.id
    const selected = selectedObject
    const stillOnSlide = () => target && canvas.current === target && getCurrent()?.slides[currentRef.current]?.id === slideId && target.getActiveObject() === selected
    if (!stillOnSlide() || !target) throw Error('Aguarde o canvas até carregar.')
    const image = await readImage(file)
    if (signal?.aborted || !stillOnSlide()) {
      image.dispose()
      throw Error('O slide ou a seleção mudou. Escolha o destino e tente novamente.')
    }
    if (credit) image.set({ imageCredit: credit })
    if (selected instanceof FabricImage) {
      const index = target.getObjects().indexOf(selected)
      if (index < 0) { image.dispose(); throw Error('Selecione a imagem diretamente na camada para substituí-la.') }
      image.scaleToWidth(selected.getScaledWidth())
      cropImage(image, selected.getScaledWidth() / selected.getScaledHeight())
      image.set({ semantic: selected.semantic, left: selected.left, top: selected.top, angle: selected.angle,
        originX: selected.originX, originY: selected.originY, flipX: selected.flipX, flipY: selected.flipY })
      target.remove(selected)
      target.insertAt(index, image)
    } else {
      image.semantic = 'image'
      const frame = target.getObjects().find(object => object.semantic === 'imageFrame')
      image.scaleToWidth(frame ? frame.getScaledWidth() : 700)
      image.set({ left: frame?.left ?? 80, top: frame?.top ?? 300, originX: 'left', originY: 'top' })
      const index = frame ? target.getObjects().indexOf(frame) : -1
      if (frame) {
        cropImage(image, frame.getScaledWidth() / frame.getScaledHeight())
        target.remove(frame, ...target.getObjects().filter(object => object.semantic === 'imageHint' || object.semantic === 'imageDecoration'))
      }
      if (index >= 0) target.insertAt(index, image)
      else target.add(image)
    }
    image.setCoords()
    target.setActiveObject(image)
    target.requestRenderAll()
    changed()
    setError('')
  }
  async function upload(file?: File) {
    if (file) try { await insertImage(file) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao abrir imagem.') }
  }
  async function openCreated(value: Project) {
    await flush()
    await saveProject(value)
    chooseSlide(0)
    setAuditOpen(false)
    setExportProjectId(undefined)
    replace(value, true)
    setEntry(undefined)
    setError('')
  }
  async function createFromCollection(style: Collection) {
    if (startingRef.current) return
    startingRef.current = true
    setStarting(true); setError('')
    try {
      await loadFonts(brand)
      const slides = demoSlides.map((slide, composition) => ({ ...slide, composition }))
      await openCreated(buildCollectionProject(style,format,brand,slides,style.name))
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { startingRef.current = false; setStarting(false) }
  }
  useAuditAssistant({
    area: active && (!auditOpen || exportOpen) ? 'studio' : undefined,
    project, source: fullReview?.project, report: fullReview?.report, current,
    locate: finding => {
      const latest = getCurrent()
      if (!latest || !fullReview || !sameReviewVersion(fullReview.project, latest)) return
      setExportProjectId(undefined)
      focusFinding(finding)
    },
  })
  if (!project && entry === 'express') return <Suspense fallback={<p role="status">Abrindo Produção Expressa…</p>}>
    <Express key={expressDraft?.id} campaign={expressDraft} active={active} brand={brand} format={format} cancel={() => { setEntry(undefined); setExpressDraft(undefined) }} open={openCreated} />
  </Suspense>
  if (!project && entry === 'collections') return <section className="studio-welcome">
    <div className="studio-entry"><h2>Biblioteca de templates</h2><button className="button button-outline" disabled={starting} onClick={() => setEntry(undefined)}>Voltar aos projetos</button></div>
    {error && <p role="alert">{error}</p>}
    {starting && <p role="status">Salvando projeto…</p>}
    <Suspense fallback={<p role="status">Abrindo a biblioteca…</p>}>
      <CollectionGallery format={format} setFormat={setFormat} use={style => void createFromCollection(style)} />
    </Suspense>
  </section>
  if (!project) return <section className="studio-welcome"><p className="eyebrow">POST MACHINE / STUDIO</p><h2>Dê forma à sua próxima ideia.</h2><p>Crie um post com texto, imagens e elementos editáveis.</p><div className="studio-entry"><button className="button express-entry" onClick={() => { setExpressDraft(undefined); setEntry('express') }}>Produção Expressa</button><button className="button button-outline" onClick={() => setEntry('collections')}>Biblioteca de templates</button></div><label>Formato do projeto<select value={format} onChange={e => setFormat(e.target.value as Format)}>{Object.entries(formatNames).map(([key, name]) => <option key={key} value={key}>{name} · {dimensions[key as Format].join(' × ')}</option>)}</select></label><button className="button button-dark" onClick={() => { chooseSlide(0); setProject({ ...newProject(format), brand, slides:[emptySlide(brand.background)] }) }}>Criar projeto vazio</button><CampaignStart choose={onStartCampaign} />
    <label>Restaurar projeto ZIP<input type="file" accept=".zip" onChange={e => { const file = e.target.files?.[0]; if (file) void restoreProject(file).then(value => { chooseSlide(0); replace(value, true) }, error => setError(String(error))); e.target.value = '' }} /></label>
    {error && <p role="alert">{error}</p>}
    <StorageSettings flush={flush} /><h3>Projetos neste navegador</h3><div className="project-library">{library.map(item => <article key={item.id}><h4>{item.name}</h4><p>{item.slides.length} slide(s) · {formatNames[item.format]}</p><button className="button button-outline" onClick={() => void openProject(item.id)}>Abrir {item.name}</button><button className="button button-outline" onClick={() => void deleteProject(item)}>Excluir {item.name}</button></article>)}</div></section>
  return <section className="studio" aria-label="Editor Studio">
    <header className="studio-toolbar" aria-label="Ações do projeto">
      <div className="studio-toolbar-row">
        <button onClick={() => void back()}>Projetos</button>
        <label className="studio-project-name">Projeto<input value={project.name} maxLength={100} onChange={event => setProject({ ...project, name: event.target.value, updatedAt: new Date().toISOString() })} /></label>
        <button onClick={() => void flush().catch(() => setError('Falha ao salvar. Tente novamente ou exporte um backup.'))}>Salvar</button>
        <span className="studio-save-status" role="status">{status}</span>
        <div className="studio-actions" role="group" aria-label="Histórico">
          <button disabled={!history.undo} onClick={() => moveHistory(false)}>Desfazer</button>
          <button disabled={!history.redo} onClick={() => moveHistory(true)}>Refazer</button>
        </div>
        <details className="studio-more" onBlur={event => {
          if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
        }} onKeyDown={event => {
          if (event.key !== 'Escape' || !event.currentTarget.open) return
          event.stopPropagation()
          event.currentTarget.open = false
          event.currentTarget.querySelector('summary')?.focus()
        }}>
          <summary>Mais ações</summary>
          <div className="studio-more-menu" onClick={event => {
            if (!(event.target instanceof HTMLButtonElement)) return
            const menu = event.currentTarget.parentElement as HTMLDetailsElement
            menu.open = false
            menu.querySelector('summary')?.focus()
          }}>
            <button disabled={backupPending} onClick={() => void downloadBackup()}>Backup completo</button>
            <button onClick={() => {
              if (window.confirm('Recuperar a versão anterior confirmada? Faça backup para preservar as alterações atuais.')) {
                void loadRecovery(project.id).then(value => { chooseSlide(0); replace(value) }, cause => setError(cause instanceof Error ? cause.message : 'Não foi possível recuperar a versão anterior.'))
              }
            }}>Recuperar versão anterior</button>
            <button onClick={() => {
              const copy = { ...project, id: crypto.randomUUID(), name: project.name.slice(0, 90) + ' (cópia)' }
              replace(copy)
            }}>Duplicar projeto</button>
          </div>
        </details>
      </div>
      <div className="studio-toolbar-row">
        <span className="muted">{formatNames[project.format]} · {dimensions[project.format].join(' × ')}</span>
        <label className="studio-inline-field">Zoom<select aria-label="Zoom" value={zoom} onChange={event => setManualZoom(Number(event.target.value))}>
          {[...new Set([zoom, .2, .25, .32, .4, .5, .75, 1, 1.25, 1.5, 2])].sort((a,b) => a - b).map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}
        </select></label>
        <button aria-label="Reduzir zoom" disabled={zoom <= .1} onClick={() => setManualZoom(Math.max(.1, Math.round(zoom * 80) / 100))}>−</button>
        <button aria-label="Ampliar zoom" disabled={zoom >= 2} onClick={() => setManualZoom(Math.min(2, Math.round(zoom * 125) / 100))}>+</button>
        <button aria-pressed={manualZoom === undefined} onClick={() => setManualZoom(undefined)}>Ajustar à tela</button>
        <label className="studio-inline-field"><input type="checkbox" checked={guides} onChange={event => setGuides(event.target.checked)} />Área segura</label>
        <div className="studio-actions studio-output" role="group" aria-label="Revisão e exportação">
          <button aria-expanded={auditOpen} onClick={() => setAuditOpen(value => !value)}>Auditar design</button>
          <button ref={exportToggle} className="export-primary" aria-expanded={exportOpen} aria-controls={exportOpen ? 'studio-export' : undefined}
            onClick={() => setExportProjectId(exportOpen ? undefined : project.id)}>Finalizar e exportar</button>
        </div>
      </div>
      <div className="studio-backup">
        <span aria-live="polite">{lastBackup === undefined ? 'Nenhum backup ZIP registrado para este projeto.' : <>Último backup enviado para download · <time dateTime={new Date(lastBackup).toISOString()}>{backupDate.format(lastBackup)}</time></>}</span>
        {saveFailed ? <span>Baixe o ZIP antes de fechar. Se precisar, use Restaurar projeto ZIP na biblioteca.</span>
          : backupDue && <span>{lastBackup === undefined ? 'Guarde uma cópia fora do perfil do navegador.' : 'Já é hora de atualizar sua cópia de segurança.'}</span>}
        {(backupDue || saveFailed) && <button disabled={backupPending} onClick={() => void downloadBackup()}>{backupPending ? 'Gerando backup…' : 'Baixar backup ZIP'}</button>}
      </div>
    </header>
    {exportOpen && <ExportPanel key={project.id} project={project} current={current} active={active} getCurrent={getCurrent} flush={flush} review={fullReview} onReport={receiveReview}
      caption={project.caption ?? campaign?.content?.campaign.caption ?? ''}
      changeCaption={caption => setProject(value => value && { ...value, caption, updatedAt: new Date().toISOString() })}
      locate={focusFinding} close={() => { setExportProjectId(undefined); exportToggle.current?.focus({ preventScroll:true }) }} />}
    {panel === 'Imagens' && imagePanel?.slideId === project.slides[current].id && (imagePanel.tab === 'search'
      ? <ImageSearch key={imagePanel.request} initialTerm={imagePanel.term} insert={insertImage} />
      : <ImageLibrary key={imagePanel.request} flush={flush} insert={insertImage} />)}
    {selectedTitle && headlineTarget === selectedTitle && <div className="studio-headlines"><HeadlinePanel title={selectedTitle.text} stored={selectedTitle.headlines}
      assistant={active ? { area: 'studio', scope: campaign ? campaignScope(campaign) : project.id, id: project.slides[current].id } : undefined}
      context={{ ...(campaign ? campaignHeadlineContext(campaign) : { sources: [] }), format: formatNames[project.format], selectedSlide: current + 1, slides: project.slides.map(slide => semantics(slide.scene)) }}
      measure={text => measureTitle(selectedTitle, text, dimensions[project.format])}
      save={(headlines, text) => {
        if (canvas.current?.getActiveObject() !== selectedTitle) return
        if (text !== undefined) {
          replaceTextboxText(selectedTitle,text)
          canvas.current.requestRenderAll()
        }
        selectedTitle.set({ headlines })
        snapshotCanvas(text !== undefined)
      }} /></div>}
    {auditOpen&&<AuditPanel project={project} assistantArea={active && !exportOpen ? 'studio' : undefined} currentSlide={current} onReport={receiveReview} onFocus={focusFinding} onChange={async (value, expected)=>{await flush();if(getCurrent()!==expected)throw Error('O projeto mudou. Rode novamente a auditoria.');setProject(value);setRevision(n=>n+1);await flush()}} onUndo={() => moveHistory(false)}/>}
    {error && <p role="alert">{error}</p>}
    {!readyCanvas && !error && <p className="studio-loading" role="status">Carregando o slide…</p>}
    {guidance && sameReviewVersion(guidance.project,project) && guidance.finding.slideId === project.slides[current].id && <div className="studio-guidance" role="status">
      <p><strong>{guidance.finding.message}.</strong> {guidance.finding.suggestion}</p>
      <button onClick={() => setGuidance(undefined)}>Dispensar orientação</button>
    </div>}
    <div className="studio-layout context-workspace" data-collapsed={!panel} data-selection={!!selectedObject} data-frames={framesOpen}>
      <ContextRail label="Ferramentas do Studio" tools={studioTools} selected={panel} choose={name => setPanel(panel === name ? null : name)} />
      <div className="studio-left"><aside className="studio-tools" hidden={!panel}>{panel && <ContextHeader title={panel} close={() => setPanel(null)} />}
      {panel === 'Templates' && <><h3>Templates originais</h3>{Object.entries(templates).map(([key, name]) => <button key={key} onClick={() => template(key as Template)}>{name}</button>)}</>}
      {panel === 'Minha marca' && <BrandPanel brand={project.brand} update={brand => setProject({ ...project, brand })} error={setError} apply={() => { if (window.confirm('Aplicar a marca em todos os slides? Os layouts legados serão recompostos.')) replace({ ...project, slides: project.slides.map(s => ({ ...s, scene: s.layout.startsWith('collection-v1:') ? applyCollectionBrand(s.scene, project.brand, project.format, /^(collection-v1:)(impacto|cartao|narrativa):/.test(s.layout)) : compose(s.layout in templates ? s.layout as Template : 'text', semantics(s.scene), project.brand, project.format, s.role) })) }) }} />}
      {panel === 'Texto' && <><h3>Tipografia</h3><button disabled={!readyCanvas} onClick={() => { if (canvas.current) { addObject(canvas.current, 'title', project.brand.primary); changed() } }}>Adicionar título</button><button disabled={!readyCanvas} onClick={() => { if (canvas.current) { addObject(canvas.current, 'text', project.brand.primary); changed() } }}>Adicionar texto</button></>}
      {panel === 'Elementos' && <><h3>Formas</h3>{([['rect', 'Retângulo'], ['circle', 'Círculo'], ['line', 'Linha']] as const).map(([type, name]) => <button key={type} disabled={!readyCanvas} onClick={() => { if (canvas.current) { addObject(canvas.current, type, project.brand.primary); changed() } }}>{name}</button>)}</>}
      {panel === 'Imagens' && <><h3>Imagens</h3><div className="image-tabs" role="group" aria-label="Origem da imagem">
        <button aria-pressed={imagePanel?.tab === 'search' && imagePanel.slideId === project.slides[current].id} onClick={() => openImages('search')}>Pesquisar imagens</button>
        <button onClick={() => openImages('search', true)}>Buscar imagem para este slide</button>
        <button aria-pressed={imagePanel?.tab === 'library' && imagePanel.slideId === project.slides[current].id} onClick={() => openImages('library')}>Imagens utilizadas</button>
        {imagePanel && <button onClick={() => setImagePanel(undefined)}>Fechar painel de imagens</button>}
      </div><h4>Upload local</h4><label>Adicionar ou substituir imagem<input id="studio-image-upload" type="file" accept="image/png,image/jpeg,image/webp" disabled={!readyCanvas} onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} /></label><p>PNG, JPEG ou WebP. Até 20 MB e 40 MP. Selecione uma imagem para substituí-la.</p></>}
      {panel === 'Camadas' && readyCanvas?.getObjects().map((o, i) => {
        const label = o instanceof Textbox ? o.text.slice(0, 32) || 'Texto vazio' : (o.semantic === 'editorialGradient' ? 'Gradiente editorial' : o.label) || ({ image:'Imagem', rect:'Retângulo', circle:'Círculo', line:'Linha', group:'Grupo' }[o.type.toLowerCase()] ?? 'Elemento')
        return <button key={i} aria-pressed={readyCanvas.getActiveObjects().includes(o)} onClick={event => {
          const selection = readyCanvas.getActiveObjects()
          readyCanvas.discardActiveObject()
          const next = event.shiftKey ? selection.includes(o) ? selection.filter(item => item !== o) : [...selection,o] : [o]
          if (next.length > 1) readyCanvas.setActiveObject(new ActiveSelection(next,{ canvas:readyCanvas }))
          else if (next[0]) readyCanvas.setActiveObject(next[0])
          readyCanvas.requestRenderAll(); refresh(n => n + 1)
        }}>{i + 1} · {label}{!o.visible && ' (oculta)'}</button>
      }).reverse()}
    </aside><Properties brand={project.brand} canvas={readyCanvas} changed={changed} replaceImage={() => { setPanel('Imagens'); requestAnimationFrame(() => document.getElementById('studio-image-upload')?.focus()) }}>
    {selectedTitle && <button type="button" className="button button-outline" aria-expanded={headlineTarget === selectedTitle} onClick={() => setHeadlineTarget(headlineTarget === selectedTitle ? undefined : selectedTitle)}>Melhorar título</button>}
    </Properties></div>
      <CanvasView key={`${project.id}:${project.slides[current].id}:${revision}`} brand={project.brand} format={project.format} initial={project.slides[current].scene} zoom={zoom} onFit={setFitZoom} guides={guides} onReady={value => { canvas.current = value; setReadyCanvas(value);if(value&&focusPath.current){selectPath(focusPath.current);focusPath.current=null} }} onChange={changed} onSelection={() => refresh(n => n + 1)} onError={setError} />
      <Slides issues={reviewedSlides} project={project} current={current} select={chooseSlide} action={slideAction} reorder={reorderFrame} open={framesOpen} toggle={() => setFramesOpen(value => !value)} />
    </div>
    {project.campaignId && <p>Design vinculado à campanha. Alterações editoriais posteriores não substituem este design: gere uma nova versão pela campanha.</p>}
    <p className="muted">Ctrl+Z desfaz · Ctrl+Shift+Z refaz · Ctrl+D duplica · Delete exclui · Salvamento local automático. Faça backups: limpar dados do navegador remove projetos.</p>
  </section>
}
