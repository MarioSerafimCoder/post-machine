import { ContextHeader, ContextRail, type ContextTool } from '../../components/ContextRail'
import { ImageSearch } from '../images/ImageSearch'
import { ImageLibrary } from '../images/ImageLibrary'
import { editorialImageQuery } from '../images/editorialQuery'
import type { ImageCredit } from '../images/contract'
import { HeadlinePanel } from '../headlines/HeadlinePanel'
import { campaignHeadlineContext } from '../headlines/context'
import { readCampaign } from '../campaigns/storage'
import { replaceTextboxText } from './editText'
import { measureTitle } from './headlineFit'
import { type CampaignStartMode } from '../campaigns/CampaignStart'
import { loadFonts } from './fonts'
import { useDocument } from './useDocument'
import { listProjects, loadProject, loadRecovery, readBrand, backupProject, saveProject, openOrCreateStudioProject, BackupLimitError } from './storage'
import { ProjectLibrary } from './ProjectLibrary'
import { download } from './export'
import { ExportPanel } from './ExportPanel'
import { defaultPreferences, newDraft, type DesignMode, type Draft } from '../campaigns/contract'
import { templates, compose, semantics, fromCampaign, textExceedsLayout, type Template } from './templates'
import { BrandPanel } from './BrandPanel'
import { Slides, type SlideReview } from './Slides'
import { lazy, Suspense, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useEditingReview } from './useEditingReview'
import { EditorialReview } from './EditorialReview'
import { ActiveSelection, Canvas, FabricImage, Textbox } from 'fabric'
import { CanvasView } from './CanvasView'
import { Properties } from './Properties'
import { newProjectIdentity, defaultBrand, emptySlide, dimensions, formatNames, newProject, newProjectBrand, type Format, type Project } from './model'
import { addObject, duplicate, sceneOf } from './objects'
import { cropImage, readImage } from './images'
import './studio.css'
import { AuditPanel } from '../audit/AuditPanel'
import { useAuditAssistant } from '../intelligence/auditSignal'
import { useAssistantAnchor } from '../intelligence/signals'
import { campaignScope } from '../intelligence/feedback'
import type { AuditReport, Finding } from '../audit/contract'
import { sameReviewSettings, sameReviewVersion, type Review } from '../audit/review'
import { resolvePage } from '../../lib/navigation'
import { applyCollectionBrand, buildCollectionProject, demoSlides, type Collection } from './collections'
import { AuthorTemplates, SaveTemplate } from './AuthorTemplates'
import { copyTemplateDesign, templateRole, type AuthorTemplate, type TemplateSummary } from './authorTemplate'
import { AdaptLayoutDialog } from './AdaptLayoutDialog'
import { frameImage, frameRequest, imageWasEdited, rewriteVisualFrame } from './visualFrames'
import { useAutomaticImages } from '../images/useAutomaticImages'
import { VisualSearchStatus } from '../images/VisualSearchStatus'
import { prepareArticleContent, preparePastedContent } from './editorialContent'
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

export function Studio({ request, active, homeEntry, onStartCampaign }: { request: { draft: Draft; mode?: DesignMode } | null; active: boolean; homeEntry?: { projectId?: string; mode?: 'express' }; onStartCampaign: (mode: CampaignStartMode, campaignId?: string) => void }) {
  const [expressDraft, setExpressDraft] = useState<Draft>()
  const [error, setError] = useState('')
  const [slideFeedback, setSlideFeedback] = useState<{ text: string; id: string }>()
  useEffect(() => {
    if (!slideFeedback) return
    const timer = window.setTimeout(() => setSlideFeedback(undefined), 2800)
    return () => window.clearTimeout(timer)
  }, [slideFeedback])
  const [templateDraft, setTemplateDraft] = useState<{ design: Project; previous?: TemplateSummary }>()
  const [templateEdit, setTemplateEdit] = useState<{ projectId: string; template: TemplateSummary }>()
  const [adaptSource, setAdaptSource] = useState<Project>()
  const { project, setProject, undo, redo, history, status, saveFailed, flush, getCurrent, endTextSession } = useDocument()
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
  const [libraryResult, setLibrary] = useState<Awaited<ReturnType<typeof listProjects>>>()
  const [brand, setBrand] = useState(defaultBrand)
  const [entry, setEntry] = useState<'express' | 'collections'>()
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const [openingArticle, setOpeningArticle] = useState(false)
  const [retryArticle, setRetryArticle] = useState(0)
  const [articleOpenFailed, setArticleOpenFailed] = useState(false)
  const [pasteProject, setPasteProject] = useState<string>()
  const [pastedText, setPastedText] = useState('')
  const [pastedTemplate, setPastedTemplate] = useState<Template>()
  const [exportProjectId, setExportProjectId] = useState<string>()
  const exportToggle = useRef<HTMLButtonElement>(null)
  const exportOpen = !!project && project.id === exportProjectId
  const [auditOpen,setAuditOpen]=useState(false)
  const [editorialProject, setEditorialProject] = useState<string>()
  const editorialToggle = useRef<HTMLElement>(null)
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
  const snapshotCanvas = useCallback((record: boolean, textTarget?: Textbox) => {
    if (!canvas.current) return
    const scene = sceneOf(canvas.current)
    setProject(p => p && ({ ...p, updatedAt: new Date().toISOString(), slides: p.slides.map((s, i) => {
      if (i !== currentRef.current) return s
      const edited = imageWasEdited(s.scene, scene)
      const visualChoice = s.visualChoice && edited
        ? { mode: frameImage(scene) ? s.visualChoice.mode === 'locked' ? 'locked' as const : 'manual' as const : 'none' as const }
        : s.visualChoice
      return { ...s, visualChoice, scene: { ...scene, ...(!edited && s.scene.contentImage ? { contentImage: s.scene.contentImage } : {}) } }
    }) }), record, false, textTarget && { target: textTarget, slide: currentRef.current })
    refresh(n => n + 1)
  }, [setProject, refresh])
  const changed = useCallback(() => snapshotCanvas(true), [snapshotCanvas])
  const frameTargets = useMemo(() => project?.slides.flatMap(slide => {
    if (slide.visualChoice?.mode !== 'automatic') return []
    const request = frameRequest(project, slide)
    return request && request.signature !== slide.visualChoice.signature ? [request] : []
  }) ?? [], [project])
  const projectImageSources = useMemo(() => new Set(project?.slides.flatMap(slide => {
    const credit = frameImage(slide.scene)?.imageCredit as ImageCredit | undefined
    return [credit?.sourceId, credit?.originalUrl, slide.visualChoice?.match?.fingerprint && 'foto:' + slide.visualChoice.match.fingerprint,
      credit?.creator && 'autor:' + credit.creator.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()]
      .filter((value): value is string => !!value)
  })), [project])
  const hasSelection = !!readyCanvas?.getActiveObject()
  const currentFrameKey = project && project.id + '/' + project.slides[current]?.id
  const availableFrameTargets = useMemo(() => hasSelection ? frameTargets.filter(item => item.key !== currentFrameKey) : frameTargets,
    [hasSelection, frameTargets, currentFrameKey])
  const autoSearch = useAutomaticImages(active && !!project && !exportOpen, availableFrameTargets, projectImageSources, (request, image) => {
    const latest = getCurrent()
    if (!latest) return false
    const index = latest.slides.findIndex(slide => latest.id + '/' + slide.id === request.key)
    const slide = latest.slides[index]
    if (slide?.visualChoice?.mode !== 'automatic' || frameRequest(latest, slide)?.signature !== request.signature) return false
    if (index === currentRef.current && canvas.current?.getActiveObjects().length) return false
    const next = rewriteVisualFrame(slide, { ...slide.visualChoice, signature: request.signature, match: image.match }, image)
    setProject({ ...latest, slides: latest.slides.map(item => item.id === slide.id ? next : item) })
    if (index === currentRef.current) setRevision(value => value + 1)
    return true
  })
  function changeVisualFrame(mode: 'automatic' | 'manual' | 'locked' | 'none') {
    const latest = getCurrent()
    const slide = latest?.slides[currentRef.current]
    if (!latest || !slide) return
    const next = mode === 'none' || mode === 'automatic' ? rewriteVisualFrame(slide, { mode, revision: (slide.visualChoice?.revision ?? 0) + 1 })
      : { ...slide, visualChoice: { ...slide.visualChoice, mode } }
    setProject({ ...latest, slides: latest.slides.map(item => item.id === slide.id ? next : item) })
    if (next.scene !== slide.scene) setRevision(value => value + 1)
  }
  const [headlineTarget, setHeadlineTarget] = useState<Textbox>()
  const [linkedCampaign, setLinkedCampaign] = useState<Draft>()
  const campaignId = project?.campaignId
  useEffect(() => {
    if (!active || !campaignId) return
    let live = true
    void readCampaign(campaignId).then(value => { if (live) setLinkedCampaign(value) }, () => undefined)
    return () => { live = false }
  }, [active, campaignId])
  const selectedObject = readyCanvas?.getActiveObject()
  const selectedTitle = selectedObject instanceof Textbox && selectedObject.semantic === 'title' ? selectedObject : undefined
  const requestedCampaign = request?.draft.id === campaignId ? request?.draft : undefined
  const campaign = linkedCampaign && linkedCampaign.id === campaignId && linkedCampaign.updatedAt >= (requestedCampaign?.updatedAt ?? '')
    ? linkedCampaign : requestedCampaign
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
      const paper = stage?.querySelector('.canvas-paper')
      if (paper && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        paper.animate([{ outline: '3px solid #d60016' }, { outline: '3px solid transparent' }], { duration: 420 })
      }
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
  function createEmptyProject(projectBrand = brand) {
    chooseSlide(0)
    setEntry(undefined)
    setProject({ ...newProject(format), brand: projectBrand, slides: [emptySlide(projectBrand.background)] })
  }
  const openFromHome = useEffectEvent(async ({ projectId: id, mode }: NonNullable<typeof homeEntry>) => {
    if (id) {
      if (getCurrent()?.id !== id) await openProject(id)
      return
    }
    try {
      await flush()
      if (mode === 'express') {
        if (getCurrent()) setProject(undefined)
        setExpressDraft(undefined)
        setEntry('express')
        return
      }
      createEmptyProject(newProjectBrand(await readBrand()))
    } catch { setError('Não foi possível criar o projeto. Confira o salvamento e tente novamente.') }
  })
  const handledHomeEntry = useRef<typeof homeEntry>(undefined)
  useEffect(() => {
    if (active && homeEntry && handledHomeEntry.current !== homeEntry) {
      handledHomeEntry.current = homeEntry
      void openFromHome(homeEntry)
    }
  }, [active, homeEntry])
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
    } catch (cause) { setError(cause instanceof BackupLimitError ? cause.message : 'Não foi possível gerar o backup deste projeto.') }
    finally { setBackupPending(false) }
  }
  const handleRequest = useEffectEvent(async ({draft,mode}: NonNullable<typeof request>) => {
    setError('')
    setArticleOpenFailed(false)
    if (mode === 'radar') { setOpeningArticle(true); setEntry(undefined) }
    try {
      await flush()
      if (mode === 'express' && draft.content) {
        setExpressDraft(draft)
        setProject(undefined)
        setEntry('express')
      } else if (mode === 'radar') {
        const value = await openOrCreateStudioProject(draft.id, async () => {
          const savedBrand = newProjectBrand(await readBrand() ?? brand)
          await loadFonts(savedBrand)
          return fromCampaign({ ...draft, content: prepareArticleContent(draft) }, savedBrand)
        })
        await flush()
        if (getCurrent()?.id !== value.id) {
          chooseSlide(0)
          setAuditOpen(false)
          setExportProjectId(undefined)
          setEntry(undefined)
          replace(value, true)
        }
      } else {
        const savedBrand = newProjectBrand(await readBrand() ?? brand)
        await loadFonts(savedBrand)
        chooseSlide(0)
        replace(fromCampaign(draft,savedBrand))
      }
    } catch (e) {
      setArticleOpenFailed(mode === 'radar')
      setError(mode === 'radar' ? 'Não foi possível abrir a notícia no Studio. Tente novamente.' : String(e))
    } finally { if (mode === 'radar') setOpeningArticle(false) }
  })
  const handled = useRef<{ request: typeof request; retry: number }>(undefined)
  useEffect(() => {
    if (active && request && (handled.current?.request !== request || handled.current.retry !== retryArticle)) {
      handled.current = { request, retry: retryArticle }
      void handleRequest(request)
    }
  }, [active, request, retryArticle])
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
    setSlideFeedback({ text: `Slide movido para a posição ${to + 1}.`, id: crypto.randomUUID() })
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
    setSlideFeedback({ text: {
      add: 'Slide adicionado.', duplicate: 'Slide duplicado.', remove: 'Slide excluído.',
      up: `Slide movido para a posição ${next + 1}.`, down: `Slide movido para a posição ${next + 1}.`,
    }[action], id: crypto.randomUUID() })
  }
  function openImages(tab: 'search' | 'library', useBrief = false, index = current) {
    const slide = project?.slides[index]
    if (!slide) return
    const term = useBrief ? editorialImageQuery(slide.imageBrief, semantics(slide.scene).title) : ''
    setPanel('Imagens')
    setImagePanel(value => ({ tab, slideId: slide.id, term, request: (value?.request ?? 0) + 1 }))
  }
  async function insertImage(file: File, credit?: ImageCredit, signal?: AbortSignal) {
    const target = readyCanvas
    const slideId = project?.slides[current]?.id
    const activeObject = selectedObject
    const visualChoice = project?.slides[current]?.visualChoice
    if (visualChoice?.mode === 'locked') throw Error('Destrave a imagem do slide antes de substituí-la.')
    const selected = activeObject ?? (visualChoice && target?.getObjects().find(object => object instanceof FabricImage && object.semantic === 'image'))
    const stillOnSlide = () => target && canvas.current === target && getCurrent()?.slides[currentRef.current]?.id === slideId &&
      target.getActiveObject() === activeObject && getCurrent()?.slides[currentRef.current]?.visualChoice?.mode !== 'locked'
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
      image.set({ semantic: selected.semantic, templateRole: selected.templateRole, left: selected.left, top: selected.top, angle: selected.angle,
        originX: selected.originX, originY: selected.originY, flipX: selected.flipX, flipY: selected.flipY })
      target.remove(selected)
      target.insertAt(index, image)
    } else {
      image.semantic = 'image'
      const frame = selected && templateRole(selected) === 'image' && !selected.group ? selected :
        target.getObjects().find(object => object.semantic === 'imageFrame' && !object.templateRole)
      image.scaleToWidth(frame ? frame.getScaledWidth() : 700)
      image.set({ left: frame?.left ?? 80, top: frame?.top ?? 300, originX: frame?.originX ?? 'left', originY: frame?.originY ?? 'top',
        angle: frame?.angle ?? 0, templateRole: frame?.templateRole })
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
  async function importPasted() {
    const original = getCurrent()
    if (!original || startingRef.current || !pastedText.trim()) return
    startingRef.current = true
    setStarting(true)
    setError('')
    try {
      const draft = campaign ?? { ...newDraft(original.editorialSource ?? null, defaultPreferences), title: original.name }
      const content = preparePastedContent(pastedText, draft)
      await loadFonts(original.brand)
      if (getCurrent()?.id !== original.id || resolvePage(window.location.hash) !== 'studio') return
      const copy = fromCampaign({ ...draft, content }, original.brand, pastedTemplate, original.format)
      await openCreated({ ...copy, campaignId: original.campaignId, campaignUpdatedAt: original.campaignUpdatedAt })
      setPasteProject(undefined)
      setPastedText('')
      setPastedTemplate(undefined)
      setSlideFeedback({ text: 'Conteúdo organizado em uma nova versão.', id: crypto.randomUUID() })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível organizar o conteúdo.') }
    finally { startingRef.current = false; setStarting(false) }
  }
  async function editTemplate(template: AuthorTemplate) {
    const copy = copyTemplateDesign(template)
    await openCreated(copy)
    setTemplateEdit({ projectId: copy.id, template })
  }
  function prepareTemplate(previous?: TemplateSummary) {
    const source = getCurrent()
    const slide = source?.slides[currentRef.current]
    if (!source || !slide?.scene.objects.length) {
      setError('Adicione elementos ao slide antes de salvar a composição como template.')
      return
    }
    setTemplateDraft({ design: { ...source, slides: [slide] }, previous })
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
  const assistantAnchor = useAssistantAnchor(active && !!project)
  const editorialOpen = !!project && editorialProject === project.id
  useEditingReview(active && !auditOpen && !exportOpen && !editorialOpen, readyCanvas, project, current, focusFinding, () => {
    const title = readyCanvas?.getObjects().find(object => object instanceof Textbox && object.semantic === 'title')
    if (!(title instanceof Textbox)) return
    selectPath(String(readyCanvas?.getObjects().indexOf(title)))
    setHeadlineTarget(title)
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.studio-headlines .headline-diagnosis')?.focus())
  })
  const articleFeedback = openingArticle ? <p role="status">Organizando frames da notícia…</p> :
    articleOpenFailed ? <button className="button button-outline" onClick={() => setRetryArticle(value => value + 1)}>Tentar abrir notícia novamente</button> : null
  if (!project && openingArticle) return <section className="studio-welcome">{articleFeedback}</section>
  if (!project && entry === 'express') return <Suspense fallback={<p role="status">Abrindo Produção Expressa…</p>}>
    <Express key={expressDraft?.id} campaign={expressDraft} active={active} brand={brand} format={format}
      cancel={() => { setEntry(undefined); setExpressDraft(undefined) }} open={openCreated} editTemplate={editTemplate} />
  </Suspense>
  if (!project && entry === 'collections') return <section className="studio-welcome">
    <div className="studio-entry"><h2>Biblioteca de templates</h2><button className="button button-outline" disabled={starting} onClick={() => setEntry(undefined)}>Voltar aos projetos</button></div>
    {error && <p role="alert">{error}</p>}
    {starting && <p role="status">Salvando projeto…</p>}
    <AuthorTemplates format={format} use={template => openCreated(copyTemplateDesign(template))} edit={editTemplate} />
    <Suspense fallback={<p role="status">Abrindo a biblioteca…</p>}>
      <CollectionGallery format={format} setFormat={setFormat} use={style => void createFromCollection(style)} />
    </Suspense>
  </section>
  if (!project) return <>{articleFeedback}<ProjectLibrary result={libraryResult} refresh={async () => setLibrary(await listProjects())}
    error={error} flush={flush} open={openProject} create={() => createEmptyProject()}
    express={() => { setExpressDraft(undefined); setEntry('express') }} templates={() => setEntry('collections')}
    format={format} setFormat={setFormat} campaign={onStartCampaign} imported={value => {
      chooseSlide(0); replace(value, true); setError('')
      setSlideFeedback({ text: 'Projeto importado.', id: crypto.randomUUID() })
    }} /></>
  const source = project.editorialSource ?? campaign?.article
  const overflow = textExceedsLayout(project.slides[current].scene)
  const searchesPending = frameTargets.some(item => {
    const value = autoSearch.status(item)
    return value === 'documental' || value === 'editorial' || value === 'illustration'
  })
  return <section className="studio" aria-label="Editor Studio">
    {adaptSource && <AdaptLayoutDialog source={adaptSource} firstSlide={current} close={() => setAdaptSource(undefined)}
      confirm={async copy => { await openCreated(copy); setAdaptSource(undefined) }} />}
    {templateDraft && <SaveTemplate project={templateDraft.design} previous={templateDraft.previous}
      close={() => setTemplateDraft(undefined)} saved={item => {
        if (templateDraft.previous && templateEdit) setTemplateEdit({ ...templateEdit, template: item })
        setTemplateDraft(undefined)
        setSlideFeedback({ text: 'Template salvo em Meus templates.', id: crypto.randomUUID() })
      }} />}
    <header className="studio-toolbar" aria-label="Ações do projeto">
      <div className="studio-toolbar-row">
        <div className="studio-actions studio-project-actions" role="group" aria-label="Gestão do projeto">
        <button onClick={() => void back()}>Projetos</button>
        <label className="studio-project-name">Projeto<input value={project.name} maxLength={100} onChange={event => setProject({ ...project, name: event.target.value, updatedAt: new Date().toISOString() })} /></label>
        <button onClick={() => void flush().catch(() => setError('Falha ao salvar. Tente novamente ou exporte um backup.'))}>Salvar</button>
        {campaign && <button onClick={() => void flush().then(() => onStartCampaign('blank', campaign.id),
          () => setError('Salve o projeto antes de voltar ao briefing.'))}>Editar briefing</button>}
        {source && <button aria-expanded={pasteProject === project.id}
          onClick={() => { setPasteProject(pasteProject === project.id ? undefined : project.id); setPastedText(''); setPastedTemplate(undefined) }}>Colar conteúdo</button>}
        <span key={status} className={status === 'Salvo' ? 'studio-save-status studio-feedback' : 'studio-save-status'} data-error={saveFailed || undefined} data-saved={status === 'Salvo' || undefined} role="status">{status}</span>
        <div className="studio-backup">
          {(backupDue || saveFailed) && <button title={lastBackup === undefined ? 'Nenhum backup ZIP registrado para este projeto.' : 'Atualize sua cópia de segurança'} disabled={backupPending} onClick={() => void downloadBackup()}>{backupPending ? 'Gerando backup…' : 'Baixar backup ZIP'}</button>}
          {lastBackup !== undefined && <time title="Último backup enviado para download" dateTime={new Date(lastBackup).toISOString()}>{backupDate.format(lastBackup)}</time>}
          {saveFailed && <span role="alert">Baixe o ZIP antes de fechar para preservar sua edição.</span>}
        </div>
        {slideFeedback && <span key={slideFeedback.id} className="studio-save-status studio-feedback" role="status">{slideFeedback.text}</span>}
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
            <button onClick={() => prepareTemplate()}>Salvar como template</button>
            <button onClick={() => setAdaptSource(getCurrent())}>Adaptar formato</button>
            {project.id === templateEdit?.projectId && <button onClick={() => prepareTemplate(templateEdit.template)}>Atualizar template</button>}
            <button onClick={() => {
              if (window.confirm('Recuperar a versão anterior confirmada? Faça backup para preservar as alterações atuais.')) {
                void loadRecovery(project.id).then(value => { chooseSlide(0); replace(value) }, cause => setError(cause instanceof Error ? cause.message : 'Não foi possível recuperar a versão anterior.'))
              }
            }}>Recuperar versão anterior</button>
            <button onClick={() => {
              const copy = { ...project, ...newProjectIdentity(), name: project.name.slice(0, 90) + ' (cópia)' }
              replace(copy)
            }}>Duplicar projeto</button>
          </div>
        </details>
      </div>
      <div className="studio-toolbar-row">
        <div className="studio-actions" role="group" aria-label="Edição">
        <div className="studio-actions" role="group" aria-label="Histórico">
          <button disabled={!history.undo} onClick={() => moveHistory(false)}>Desfazer</button>
          <button disabled={!history.redo} onClick={() => moveHistory(true)}>Refazer</button>
        </div>
        <span className="muted">{formatNames[project.format]} · {dimensions[project.format].join(' × ')}</span>
        <label className="studio-inline-field">Zoom<select aria-label="Zoom" value={zoom} onChange={event => setManualZoom(Number(event.target.value))}>
          {[...new Set([zoom, .2, .25, .32, .4, .5, .75, 1, 1.25, 1.5, 2])].sort((a,b) => a - b).map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}
        </select></label>
        <button aria-label="Reduzir zoom" disabled={zoom <= .1} onClick={() => setManualZoom(Math.max(.1, Math.round(zoom * 80) / 100))}>−</button>
        <button aria-label="Ampliar zoom" disabled={zoom >= 2} onClick={() => setManualZoom(Math.min(2, Math.round(zoom * 125) / 100))}>+</button>
        <button aria-pressed={manualZoom === undefined} onClick={() => setManualZoom(undefined)}>Ajustar à tela</button>
        <label className="studio-inline-field"><input type="checkbox" checked={guides} onChange={event => setGuides(event.target.checked)} />Área segura</label>
        </div>
        <div className="studio-actions studio-output" role="group" aria-label="Finalização">
          <details className="review-menu" onKeyDown={event => {
            if (event.key === 'Escape') { event.currentTarget.open = false; editorialToggle.current?.focus() }
          }} onBlur={event => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
          }}>
            <summary ref={editorialToggle}>Revisar</summary>
            <div className="studio-more-menu" onClick={event => {
              event.currentTarget.parentElement?.removeAttribute('open')
              editorialToggle.current?.focus()
            }}>
          <button aria-expanded={auditOpen} onClick={() => setAuditOpen(value => !value)}>Problemas técnicos</button>
          <button aria-expanded={editorialOpen} aria-controls={editorialOpen ? 'studio-editorial-review' : undefined}
            onClick={() => {
              setEditorialProject(editorialOpen ? undefined : project.id)
              if (!editorialOpen) requestAnimationFrame(() => document.getElementById('studio-editorial-heading')?.focus())
            }}>Texto e sequência</button>
            </div>
          </details>
          <button ref={exportToggle} className="export-primary" aria-expanded={exportOpen} aria-controls={exportOpen ? 'studio-export' : undefined}
            onClick={() => setExportProjectId(exportOpen ? undefined : project.id)}>Finalizar e exportar</button>
        </div>
      </div>
    </header>
    {articleFeedback}
    {source && <details className="studio-origin">
      <summary>Notícia de origem</summary>
      <p><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · {source.source} · {source.category}
        {source.publishedAt && <> · <time dateTime={source.publishedAt}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(source.publishedAt))}</time></>}</p>
      {source.summary && <p>{source.summary}</p>}
      {project.editorialReferences?.filter(reference => reference.url !== source.url).map((reference, index) =>
        <p key={reference.url + index}><a href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a></p>)}
    </details>}
    {pasteProject === project.id && <section className="studio-paste context-panel" aria-label="Importar conteúdo editorial">
      <label>Texto, JSON ou Markdown<textarea rows={5} value={pastedText} onChange={event => setPastedText(event.target.value)} /></label>
      <label>Template da nova versão<select value={pastedTemplate ?? ''} onChange={event => setPastedTemplate((event.target.value || undefined) as Template | undefined)}>
        <option value="">Escolher pelo conteúdo</option>
        {Object.entries(templates).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <div className="studio-actions">
        <button disabled={!pastedText.trim() || starting} onClick={() => void importPasted()}>{starting ? 'Organizando frames…' : 'Criar nova versão'}</button>
        <button onClick={() => setPasteProject(undefined)} disabled={starting}>Fechar importação</button>
      </div>
      <p className="muted">A nova versão fica na biblioteca junto com este projeto.</p>
    </section>}
    {source && <p className="studio-editorial-status" role="status">{searchesPending ? 'Frames editáveis · Buscando imagens…' : 'Frames prontos para revisão.'}</p>}
    {overflow && <p className="studio-guidance" role="status">Há texto além da área neste frame. Edite a caixa ou confira em Revisar → Problemas técnicos.</p>}
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
    {editorialOpen && <EditorialReview project={project} campaign={campaign} select={index => {
      chooseSlide(index)
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.canvas-stage')?.focus())
    }} close={() => { setEditorialProject(undefined); editorialToggle.current?.focus({ preventScroll: true }) }} />}
    {auditOpen&&<AuditPanel project={project} assistantArea={active && !exportOpen ? 'studio' : undefined} currentSlide={current} onReport={receiveReview} onFocus={focusFinding} onChange={async (value, expected) => {
      await flush()
      if (getCurrent() !== expected) throw Error('O projeto mudou. Rode novamente a auditoria.')
      const applied = setProject(value) ?? value
      setRevision(n => n + 1)
      await flush()
      return applied
    }} onUndo={() => moveHistory(false)}/>}
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
      {panel === 'Imagens' && <><h3>Imagens</h3>
      {project.slides[current].visualChoice && <div className="studio-visual-choice">
        <p>Modo visual Documental</p>
        <VisualSearchStatus status={autoSearch.status(frameTargets.find(item => item.key === project.id + '/' + project.slides[current].id))}
          match={project.slides[current].visualChoice?.match} />
        <p>{({ automatic: 'Automático', manual: 'Confirmado manualmente', locked: 'Travado', none: 'Sem imagem' } as const)[project.slides[current].visualChoice!.mode]}</p>
        {project.slides[current].visualChoice?.mode === 'locked' ? <button onClick={() => changeVisualFrame('manual')}>Destravar imagem</button> : <>
          {frameImage(project.slides[current].scene) && <>
            {project.slides[current].visualChoice?.mode === 'automatic' && <button onClick={() => changeVisualFrame('manual')}>Manter esta</button>}
            <button onClick={() => changeVisualFrame('locked')}>Travar imagem</button>
            <button onClick={() => changeVisualFrame('none')}>{project.slides[current].visualChoice?.match ? 'Desfazer escolha automática' : 'Remover imagem'}</button>
          </>}
          <button onClick={() => changeVisualFrame('automatic')}>{project.slides[current].visualChoice?.mode === 'automatic' ? 'Buscar novamente' : 'Voltar ao automático'}</button>
        </>}
      </div>}
      <div className="image-tabs" role="group" aria-label="Origem da imagem">
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
    </aside><Properties brand={project.brand} format={project.format} canvas={readyCanvas} changed={changed} endTextSession={endTextSession} textChanged={target => snapshotCanvas(true, target)} replaceImage={() => { setPanel('Imagens'); requestAnimationFrame(() => document.getElementById('studio-image-upload')?.focus()) }}>
    {selectedTitle && <button type="button" className="button button-outline" aria-expanded={headlineTarget === selectedTitle} onClick={() => setHeadlineTarget(headlineTarget === selectedTitle ? undefined : selectedTitle)}>Melhorar título</button>}
    </Properties></div>
      <div className="studio-canvas-workspace" ref={assistantAnchor}>
        <CanvasView key={`${project.id}:${project.slides[current].id}:${revision}`} brand={project.brand} format={project.format} initial={project.slides[current].scene} zoom={zoom} onFit={setFitZoom} guides={guides} onReady={value => { canvas.current = value; setReadyCanvas(value);if(value&&focusPath.current){selectPath(focusPath.current);focusPath.current=null} }} onChange={(_, target) => snapshotCanvas(true, target)} onTextEnd={endTextSession} onSelection={() => refresh(n => n + 1)} onError={setError} />
      </div>
      <Slides locatePhoto={(index, operation) => {
        chooseSlide(index)
        setPanel('Imagens')
        if (operation === 'empty') openImages('search', true, index)
        else if (operation === 'error') {
          const failed = new Set(frameTargets.filter(item => autoSearch.status(item) === 'error').map(item => item.key))
          setProject(latest => latest && ({ ...latest, slides: latest.slides.map(slide =>
            slide.visualChoice?.mode === 'automatic' && failed.has(latest.id + '/' + slide.id)
              ? { ...slide, visualChoice: { ...slide.visualChoice, revision: (slide.visualChoice.revision ?? 0) + 1 } } : slide) }))
        }
      }} issues={reviewedSlides} project={project} current={current} select={chooseSlide} action={slideAction} reorder={reorderFrame}
        imageStatus={id => autoSearch.status(frameTargets.find(item => item.key === project.id + '/' + id))}
        open={framesOpen} toggle={() => setFramesOpen(value => !value)} />
    </div>
    {project.campaignId && <p>Design vinculado à campanha. Alterações editoriais posteriores não substituem este design: gere uma nova versão pela campanha.</p>}
    <p className="muted">Ctrl+Z desfaz · Ctrl+Shift+Z refaz · Ctrl+D duplica · Delete exclui · Salvamento local automático. Faça backups: limpar dados do navegador remove projetos.</p>
  </section>
}
