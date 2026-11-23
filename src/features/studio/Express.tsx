import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ContextRail, ContextWorkspace, type ContextTool } from '../../components/ContextRail'
import { maxImport, maxSlides, type Draft } from '../campaigns/contract'
import { readCampaigns } from '../campaigns/storage'
import { ResponsePreview } from '../campaigns/ResponsePreview'
import { ImageSearch } from '../images/ImageSearch'
import { ImageLibrary } from '../images/ImageLibrary'
import { editorialImageQuery } from '../images/editorialQuery'
import type { ImageCredit } from '../images/contract'
import { fetchExternalImage } from '../images/openverse'
import { collections, type CollectionSlide, collectionBrand, prepareCollectionImage } from './collections'
import { CollectionGallery } from './CollectionGallery'
import { bodyLimit, fromStructured, parseExpress, titleLimit } from './expressContent'
import { fabricate, planFactoryImages, recompose, type Fabrication, type FactoryInput, type Proposal } from './factory/fabricate'
import { divideBody } from './factory/planning'
import { readImage } from './images'
import { dimensions, formatNames, type Brand, type Format, type Project } from './model'
import { ProposalReview } from './factory/ProposalReview'
import { useAssistantSignal } from '../intelligence/signals'
import { requiresReview, type Issue } from './factory/evaluate'
import { SaveQueue } from '../../lib/saveQueue'
import { openExpressDraft, reconcileExpressSlides, type ExpressDraft, type ExpressPhoto, type ExpressSlide } from './expressDraft'
import { AuthorTemplates } from './AuthorTemplates'
import { templateRole, type AuthorTemplate } from './authorTemplate'
import { fabricateAuthorTemplate, planAuthorImages } from './factory/authorFabrication'
import { loadAuthorTemplate } from './storage'
import { useLocalVision } from './vision/useLocalVision'
import { visualQueries } from '../images/automaticSearch'
import { requestFor, useAutomaticImages } from '../images/useAutomaticImages'
import { VisualSearchStatus } from '../images/VisualSearchStatus'
import { frameImage, frameRequest } from './visualFrames'
import './collections.css'

const tools: ContextTool[] = [
  { label: 'Conteúdo', icon: 'text' }, { label: 'Imagens', icon: 'image' },
  { label: 'Templates', icon: 'studio' }, { label: 'Prévia', icon: 'audit' },
]
type Step = typeof tools[number]['label']
type Entry = ExpressSlide
type Photo = ExpressPhoto
const noFlush = async () => {}
const maxImages = 30
const maxImageBytes = 80_000_000
const key = () => crypto.randomUUID()
const entry = (data: CollectionSlide = { title:'', body:'' }): Entry => ({ ...data, key:key() })
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
export function Express({ active, brand, campaign, format: initialFormat, cancel, open, editTemplate }: {
  active: boolean; brand: Brand; campaign?: Draft; format: Format; cancel: () => void; open: (project: Project) => Promise<void>
  editTemplate: (template: AuthorTemplate) => Promise<void>
}) {
  const [step, setStep] = useState<Step>('Conteúdo')
  const [text, setText] = useState('')
  const [slides, setSlides] = useState<Entry[]>(() => campaign?.content ? fromStructured(campaign.content, campaign.briefing).map(entry) : [entry()])
  const [campaigns, setCampaigns] = useState<Draft[]>()
  const [linked, setLinked] = useState(campaign)
  const [name, setName] = useState(campaign?.content?.campaign.title.slice(0,100) ?? '')
  const [caption, setCaption] = useState(campaign?.content?.campaign.caption)
  const [style, setStyle] = useState(collections[0])
  const [author, setAuthor] = useState<AuthorTemplate>()
  const [format, setFormat] = useState(campaign?.content?.campaign.format === 'story' ? 'story' : initialFormat)
  const [photos, setPhotos] = useState<Photo[]>([])
  const vision = useLocalVision(active)
  const visual = vision.analyses
  const [photoId, setPhotoId] = useState('')
  const [origin, setOrigin] = useState<'local' | 'openverse' | 'library' | 'url'>('local')
  const [imageBriefSlide, setImageBriefSlide] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [prepared, setPrepared] = useState<{ input: FactoryInput; result: Fabrication }>()
  const [selected, setSelected] = useState(0)
  const [progress, setProgress] = useState<number>()
  const [editTarget, setEditTarget] = useState<{ index: number; field: 'text' | 'image' }>()
  const generation = useRef<AbortController | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const operation = useRef(false)
  const dragged = useRef<string | undefined>(undefined)
  const live = useRef(true)
  const externalRequest = useRef<AbortController | null>(null)
  const [lastOrganized, setLastOrganized] = useState<string>()
  const [slot] = useState(() => campaign?.id ?? 'independent')
  const [draftGate, setDraftGate] = useState<'loading' | 'ready' | 'recover' | 'error'>('loading')
  const [candidate, setCandidate] = useState<ExpressDraft>()
  const [draftError, setDraftError] = useState('')
  const [storedDraft] = useState(() => openExpressDraft(slot))
  const completed = useRef(false)
  const targets = useMemo(() => {
    const frame = author?.design.slides[0].scene.objects.find(object => templateRole(object) === 'image' && object.visible !== false)
    if (author && !frame) return []
    const [width, height] = dimensions[format]
    const slot = style.layouts[3]?.image
    const ratio = frame ? (Number(frame.width) * Number(frame.scaleX ?? 1)) / (Number(frame.height) * Number(frame.scaleY ?? 1))
      : slot ? slot[2] * width / (slot[3] * height) : width / height
    return slides.flatMap(slide => {
      if (slide.imageId !== undefined || slide.image || slide.imageLocked || slide.focalPoint || (!slide.title.trim() && !slide.body.trim())) return []
      const query = visualQueries({ ...slide, role: slide.intent ?? slide.role, ratio, campaign: linked?.content?.campaign.title })
      return query ? [requestFor(slide.key, query, slide.searchRevision)] : []
    })
  }, [slides, author, format, style, linked])
  const localInput = useMemo(() => ({ style, format, brand, slides, author, visual,
    assets: photos.filter(photo => !photo.automatic || slides.some(slide => slide.imageId === photo.id)),
  }), [style, format, brand, slides, author, visual, photos])
  const localPlan = useMemo(() => author ? planAuthorImages(author, localInput) : planFactoryImages(localInput), [author, localInput])
  const automaticBySlide = useMemo(() => new Map(targets.flatMap(target => {
    const photo = photos.find(item => item.automatic?.slideKey === target.key && item.automatic.signature === target.signature)
    return photo ? [[target.key, photo] as const] : []
  })), [targets, photos])
  const requests = useMemo(() => targets.filter(target => !automaticBySlide.has(target.key) &&
    !localPlan[slides.findIndex(slide => slide.key === target.key)]?.picture), [targets, automaticBySlide, localPlan, slides])
  const occupied = useMemo(() => new Set(photos.filter(photo => !photo.automatic ||
    automaticBySlide.get(photo.automatic.slideKey) === photo || slides.some(slide => slide.imageId === photo.id)).flatMap(photo => {
    const credit = photo.object.imageCredit as ImageCredit | undefined
    return [credit?.sourceId, credit?.originalUrl, credit?.title && 'titulo:' + credit.title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[_-]/g, ' '),
      photo.automatic?.match.fingerprint && 'foto:' + photo.automatic.match.fingerprint,
      credit?.creator && 'autor:' + credit.creator.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()].filter((item): item is string => !!item)
  })), [photos, automaticBySlide, slides])
  const search = useAutomaticImages(active && draftGate === 'ready' && (step !== 'Prévia' || !prepared) && progress === undefined && !busy, requests, occupied, (request, image) => {
    const retained = photos.filter(photo => photo.automatic?.slideKey !== request.key || slides.some(slide => slide.imageId === photo.id))
    if (retained.length >= maxImages || retained.reduce((total, photo) => total + photo.bytes, image.file.size) > maxImageBytes) return false
    if (retained.some(photo => (photo.object.imageCredit as ImageCredit | undefined)?.sourceId === image.id)) return false
    setPhotos(items => [...items.filter(photo => photo.automatic?.slideKey !== request.key || slides.some(slide => slide.imageId === photo.id)),
      { id: 'auto-' + image.id, name: image.name, bytes: image.file.size, file: image.file, object: image.object,
        automatic: { slideKey: request.key, signature: request.signature, match: image.match, focalPoint: image.focalPoint } }])
    return true
  })
  const factoryInput = useMemo(() => ({
    ...localInput,
    slides: slides.map((slide, index) => {
      const auto = automaticBySlide.get(slide.key)
      return auto && !localPlan[index].picture ? { ...slide, image: auto.object, focalPoint: auto.automatic?.focalPoint } : slide
    }),
  }), [localInput, slides, automaticBySlide, localPlan])
  const imagePlan = useMemo(() => author ? planAuthorImages(author, factoryInput) : planFactoryImages(factoryInput), [author, factoryInput])
  const plannedPhotos = new Set([...imagePlan.map(item => item.picture?.id), ...[...automaticBySlide.values()].map(photo => photo.id)])
  const matchedPhotos = slides.flatMap(slide => {
    const photo = slide.imageId === undefined ? automaticBySlide.get(slide.key) : photos.find(item => item.id === slide.imageId)
    return photo?.automatic ? [photo.automatic.match] : []
  })
  const result = prepared?.input === factoryInput ? prepared.result : undefined
  const [draftQueue] = useState(() => new SaveQueue<ExpressDraft>(storedDraft.save, (_id, state, failure) => {
    if (state === 'error') setDraftError(`Falha ao salvar a preparação. ${errorText(failure)}`)
    else if (state === 'saved') setDraftError('')
  }, 250))
  const snapshot = useMemo<ExpressDraft>(() => ({ text, slides, linked, name, caption, styleId: style.id, format, step, origin, photos, authorTemplateId: author?.id }),
    [text, slides, linked, name, caption, style, format, step, origin, photos, author])
  useEffect(() => {
    let alive = true
    void storedDraft.load().then(result => {
      if (!alive) return
      setCandidate(result)
      setDraftGate(result ? 'recover' : 'ready')
    }, cause => {
      if (!alive) return
      setDraftError(errorText(cause))
      setDraftGate('error')
    })
    return () => { alive = false }
  }, [storedDraft])
  useEffect(() => {
    if (draftGate !== 'ready' || completed.current) return
    if (!(text.trim() || name.trim() || caption?.trim() || photos.length || slides.some(slide => slide.title.trim() || slide.body.trim()) ||
      author || style !== collections[0] || format !== initialFormat || slides.length > 1 || storedDraft.hasSaved())) return
    draftQueue.schedule(slot, snapshot)
  }, [draftGate, draftQueue, slot, snapshot, text, name, caption, photos, slides, style, format, initialFormat, storedDraft, author])
  useEffect(() => {
    const flush = () => { if (!completed.current) void draftQueue.flush(slot).catch(() => undefined) }
    const unload = (event: BeforeUnloadEvent) => { if (draftQueue.hasPending && !completed.current) { flush(); event.preventDefault() } }
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', unload)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('visibilitychange', flush)
      flush()
    }
  }, [draftQueue, slot])
  useEffect(() => {
    live.current = true
    void readCampaigns().then(data => { if (live.current) setCampaigns(data.campaigns.filter(draft => draft.content)) },
      () => { if (live.current) setStatus('Não foi possível ler campanhas locais. Você ainda pode colar conteúdo.') })
    return () => { live.current = false; externalRequest.current?.abort(); generation.current?.abort() }
  },[])

  useEffect(() => {
    if (!active) generation.current?.abort()
  },[active])
  useEffect(() => {
    if (!editTarget) return
    const field = document.getElementById('express-edit-' + editTarget.field + '-' + editTarget.index)
    const imageFallback = editTarget.field === 'image' ? document.getElementById('express-upload') ?? document.getElementById('express-origin-local') : null
    const target = field ?? imageFallback
    target?.focus()
  },[editTarget,step])

  function change(slide: string, patch: Partial<Entry>) {
    setSlides(value => value.map(item => item.key === slide ? { ...item, ...patch } : item))
  }
  function assignPhoto(slide: Entry, index: number, id: string | null | undefined) {
    const photo = photos.find(item => item.id === id)
    change(slide.key, { imageId: id, imageLocked: false,
      ...(id === undefined ? { focalPoint: undefined, searchRevision: (slide.searchRevision ?? 0) + 1 } :
        { focalPoint: photo?.automatic?.focalPoint }),
    })
    setStatus(photo ? `${photo.name} vinculada ao slide ${index + 1}.` :
      id === null ? `Slide ${index + 1} definido sem imagem.` : `Slide ${index + 1} voltou à distribuição automática.`)
  }
  function organize(values: CollectionSlide[]) {
    setSlides(previous => reconcileExpressSlides(values, previous, key))
  }
  function applyText(raw = text, onlyStructured = false) {
    if (raw === lastOrganized) return
    try {
      const result = parseExpress(raw)
      if (onlyStructured && !result.structured) return
      if (slides.some(slide => slide.title.trim() || slide.body.trim()) &&
          !window.confirm('Substituir o conteúdo dos slides desta preparação? As imagens continuam disponíveis para vinculação.')) return
      organize(result.slides)
      setLastOrganized(raw)
      setLinked(undefined)
      setCaption(result.structured?.campaign.caption)
      if (result.structured) {
        setName(result.structured.campaign.title.slice(0,100))
        if (!author) setFormat(result.structured.campaign.format === 'story' ? 'story' : initialFormat === 'story' ? 'portrait' : initialFormat)
      }
      setError('')
      setStatus(`${result.slides.length} slide(s) organizados. Confira o conteúdo e avance para Imagens ou Templates.`)
    } catch (cause) { setError(errorText(cause)) }
  }

  function updateRaw(raw: string) {
    setText(raw)
    setError('')
    if (!lastOrganized && slides.length === 1 && !slides[0].title.trim() && !slides[0].body.trim() &&
        /^(?:```(?:json|md|markdown)?\s*)?(?:[[{]|# Campanha\b)/i.test(raw.trim())) {
      try {
        if (parseExpress(raw).structured) applyText(raw, true)
      } catch { /* A prévia informa ajustes da resposta em edição. */ }
    }
  }
  function loadCampaign(id: string) {
    const item = campaigns?.find(draft => draft.id === id)
    if (!item?.content) return
    if (linked?.id !== id && slides.some(slide => slide.title.trim() || slide.body.trim()) &&
        !window.confirm('Substituir o conteúdo dos slides pela campanha selecionada? As imagens continuam disponíveis.')) return
    organize(fromStructured(item.content, item.briefing)); setLinked(item); setCaption(item.content.campaign.caption); setName(item.content.campaign.title.slice(0,100))
    if (!author && item.content.campaign.format === 'story') setFormat('story')
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
      return { id, name:file.name, bytes:file.size, object:prepareCollectionImage(image), file }
    } finally { image.dispose() }
  }
  async function addPhotos(files: File[], credit?: ImageCredit, signal?: AbortSignal, slideKey?: string) {
    if (operation.current) throw Error('Aguarde a importação atual.')
    if (files.length > maxImages) throw Error(`Selecione até ${maxImages} imagens por vez.`)
    operation.current = true
    setBusy(true)
    setStatus('')
    setError('')
    const next = [...photos]
    const failures: string[] = []
    let added = 0
    let selectedImage: string | undefined
    try {
      for (const file of files) {
        try {
          if (file.size > 20_000_000) throw Error('Máximo de 20 MB por imagem.')
          const item = await imagePhoto(file,credit,signal)
          const previous = next.findIndex(photo => photo.id === item.id)
          if (previous >= 0) {
            if (credit && !next[previous].object.imageCredit) next[previous] = item
            selectedImage = item.id
            continue
          }
          if (next.length >= maxImages || next.reduce((sum,photo) => sum+photo.bytes,0)+item.bytes > maxImageBytes)
            throw Error('Limite da preparação: 30 imagens e 80 MB no total.')
          next.push(item); added++
          selectedImage = item.id
        } catch (cause) { failures.push(`${file.name}: ${errorText(cause)}`) }
      }
      if (!live.current) return
      signal?.throwIfAborted()
      if (!added && failures.length && files.length === 1) throw Error(failures[0])
      setPhotos(next)
      if (slideKey && selectedImage) change(slideKey, { imageId: selectedImage })
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
    if (slides.some(item => item.imageId === id && item.imageLocked)) return
    setPhotos(items => items.filter(item => item.id !== id))
    const auto = photos.find(item => item.id === id)?.automatic
    setSlides(items => items.map(item => item.imageId === id || item.key === auto?.slideKey && item.imageId === undefined
      ? { ...item, imageId: auto ? null : undefined, focalPoint: undefined } : item))
    if (photoId === id) setPhotoId('')
    setStatus('Imagem e seus vínculos removidos da preparação.')
  }

  const invalid = slides.map((slide,index) => {
    if (!slide.title.trim() && !slide.body.trim()) return `Slide ${index+1}: adicione título ou texto.`
    if (slide.title.length > titleLimit || (slide.subtitle?.length ?? 0) > titleLimit ||
      slide.body.length > bodyLimit || (slide.cta?.length ?? 0) > bodyLimit) return `Slide ${index+1}: revise os limites de caracteres.`
    return ''
  }).filter(Boolean)
  async function startFabrication() {
    if (invalid.length || generation.current || busy || downloading || vision.progress) return
    const controller = new AbortController()
    generation.current = controller
    setError('')
    setStatus('')
    setProgress(0)
    try {
      const output = author
        ? await fabricateAuthorTemplate(author, factoryInput, controller.signal, setProgress)
        : await fabricate(factoryInput, controller.signal, complete => setProgress(complete))
      if (live.current && !controller.signal.aborted) {
        setPrepared({ input:factoryInput,result:output })
        setSelected(0)
        setPreviewIndex(0)
        setStatus(author ? 'Prévia do template pronta para revisar.' : 'Três propostas prontas para comparar.')
      }
    } catch (cause) {
      if (live.current && !controller.signal.aborted) setError(errorText(cause))
    } finally {
      if (generation.current === controller) {
        generation.current = null
        if (live.current) setProgress(undefined)
      }
    }
  }
  async function create(proposal: Proposal) {
    if (operation.current || invalid.length || !result) return
    setBusy(true); setError(''); operation.current = true
    try {
      if (draftGate === 'ready') await draftQueue.flush(slot)
      const project = {
        ...proposal.project, name:(name.trim() || slides[0]?.title.trim() || 'Produção Expressa').slice(0,100),
        caption, campaignId:linked?.id ?? null, campaignUpdatedAt:linked?.updatedAt ?? null,
      }
      project.slides = project.slides.map((slide, index) => {
        const entry = slides[index]
        const image = frameImage(slide.scene)
        const request = frameRequest(project, slide)
        if (!request) return slide
        const auto = automaticBySlide.get(entry.key)?.automatic
        if (entry.imageId === null) return { ...slide, visualChoice: { mode: 'none' } }
        if (image && (entry.imageId || localPlan[index]?.picture)) {
          return { ...slide, visualChoice: { mode: entry.imageLocked ? 'locked' : 'manual' } }
        }
        return { ...slide, visualChoice: { mode: 'automatic', ...(image && auto ? { signature: request.signature, match: auto.match } : {}) } }
      })
      await open(project)
      completed.current = true
      if (storedDraft.hasSaved()) await storedDraft.clear()
    } catch (cause) { setError(errorText(cause)) }
    finally { operation.current = false; if (live.current) setBusy(false) }
  }
  function selectStep(value: string) {
    if (busy || downloading) return
    generation.current?.abort()
    setStatus(''); setError(''); setEditTarget(undefined)
    setStep(value)
  }
  function editSlide(destination: 'Conteúdo' | 'Imagens') {
    selectStep(destination)
    setEditTarget({ index:previewIndex,field:destination === 'Conteúdo' ? 'text' : 'image' })
  }
  function splitSlide() {
    const slide = slides[previewIndex]
    const parts = divideBody(slide.body)
    if (!parts || slides.length >= maxSlides || !window.confirm('Dividir o texto deste slide em dois, preservando os parágrafos?')) return
    const first = { ...slide,body:parts[0],cta:undefined,role:slide.role === 'cta' ? 'content' as const : slide.role }
    const second = entry({ title:'',body:parts[1],role:slide.role === 'cta' || slide.cta ? 'cta' : 'content',cta:slide.cta })
    setSlides(items => [...items.slice(0,previewIndex),first,{ ...second,imageId:null },...items.slice(previewIndex+1)])
    editSlide('Conteúdo')
  }
  function replaceComposition(composition: number) {
    if (!result || busy) return
    const updated = recompose(factoryInput,result.slides[previewIndex],result.proposals[selected],previewIndex,composition)
    setPrepared({ input:factoryInput,result:{ ...result,proposals:result.proposals.map((proposal,index) => index === selected ? updated : proposal) } })
  }

  const reviewedProposal = active && !busy && step === 'Prévia' ? result?.proposals[selected] : undefined
  const issues = reviewedProposal?.details.flatMap((detail, index) => detail.issues.filter(requiresReview).map(issue => ({ index, issue }))) ?? []
  const issuePriority: Record<Issue['kind'], number> = { text: 4, layout: 3, image: 2, font: 1 }
  const primaryIssue = issues.reduce<typeof issues[number] | undefined>((current, entry) =>
    !current || issuePriority[entry.issue.kind] > issuePriority[current.issue.kind] ? entry : current, undefined)
  const issuePosition = primaryIssue?.index ?? -1
  const productionIssue = primaryIssue?.issue
  const lighter = result?.proposals.findIndex((proposal, index) => index !== selected &&
    proposal.details.reduce((sum, detail) => sum + detail.issues.filter(requiresReview).length, 0) < issues.length) ?? -1
  useAssistantSignal(reviewedProposal && productionIssue ? {
    area: 'studio', scope: reviewedProposal.project.id, priority: 65, category: 'production',
    subject: reviewedProposal.project.slides[issuePosition]?.id, severity: 'warning',
    insight: {
      id: `express:${issuePosition}:${productionIssue.kind}:${productionIssue.field ?? ''}`,
      ruleId: productionIssue.kind === 'text' ? 'VIS-003' : productionIssue.kind === 'layout' ? 'VIS-001' : 'OPS-001',
      title: `Revise o slide ${issuePosition + 1} da proposta`,
      detail: productionIssue.message,
      assessment: 'needs_review',
      alternative: lighter >= 0 ? 'Outra proposta desta fabricação gerou menos avisos. Compare o resultado e o recorte.' : undefined,
      actions: [
        { label: 'Ver slide da proposta', run: () => { setPreviewIndex(issuePosition); document.getElementById('express-proposal-preview')?.focus() } },
        ...(lighter >= 0 ? [{ label: 'Comparar proposta com menos avisos', run: () => { setSelected(lighter); document.getElementById('express-proposal-preview')?.focus() } }] : []),
      ],
    },
  } : reviewedProposal && result ? {
    area: 'studio', scope: reviewedProposal.project.id, priority: 25, category: 'production',
    insight: {
      id: 'express:compare', ruleId: 'VIS-004', title: `Compare as ${result.proposals.length} propostas fabricadas`,
      detail: `A proposta selecionada tem ${reviewedProposal.details.length} peça(s), sem avisos que exijam revisão do motor de fabricação. Confira a leitura e o enquadramento antes de escolher.`,
      assessment: 'heuristic',
      actions: [{ label: 'Abrir comparação', run: () => document.getElementById('express-proposal-preview')?.focus() }],
    },
  } : undefined)

  let panel: ReactNode
  if (step === 'Conteúdo') panel = <div className="express-content">
    <div className="express-paste">
      <label>Cole aqui o conteúdo do seu post ou carrossel<textarea rows={7} value={text} maxLength={maxImport}
        placeholder={'Slide 1 — Seu título\nTexto do primeiro slide\n\nSlide 2\nTexto do segundo slide'}
        onPaste={event => {
          if (text.trim() || slides.some(slide => slide.title.trim() || slide.body.trim())) return
          const raw = event.clipboardData.getData('text/plain')
          if (!raw.trim() || raw.length > maxImport) return
          event.preventDefault(); setText(raw); applyText(raw)
        }}
        onChange={event => updateRaw(event.target.value)} /></label>
      <p className="muted">Cole a resposta do GPT em JSON ou Markdown de campanha, ou use texto com marcações “Slide 1”, “Slide 2” etc.</p>
      <ResponsePreview raw={text} express />
      <div className="collection-actions">
        <button className={`button ${lastOrganized === text ? 'button-outline' : 'button-dark'}`} onClick={() => applyText()}>Organizar slides</button>
        <label>Importar arquivo JSON ou Markdown<input type="file" accept=".json,.md,application/json,text/markdown" onChange={async event => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return
          try {
            if (file.size > maxImport * 4) throw Error('O arquivo excede o limite de importação.')
            const raw = await file.text()
            if (raw.length > maxImport) throw Error('O conteúdo excede o limite de importação.')
            if (live.current) updateRaw(raw)
          } catch (cause) { if (live.current) setError(errorText(cause)) }
        }} /></label>
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
      {style.premium && <label>Trecho em destaque<input value={slide.emphasis ?? ''} maxLength={titleLimit}
        placeholder="Parte exata do título" aria-invalid={!!slide.emphasis?.trim() && !slide.title.includes(slide.emphasis.trim())}
        onChange={event => change(slide.key,{emphasis:event.target.value})} />
        {slide.emphasis?.trim() && !slide.title.includes(slide.emphasis.trim()) && <small>Use um trecho que apareça exatamente no título.</small>}</label>}
      <label>Subtítulo<input value={slide.subtitle ?? ''} onChange={event => change(slide.key,{subtitle:event.target.value})} /></label>
      <label>Texto<textarea id={'express-edit-text-' + index} rows={3} value={slide.body} onChange={event => change(slide.key,{body:event.target.value})} /></label>
        <label>Chamada para ação<input value={slide.cta ?? ''} onChange={event => change(slide.key,{cta:event.target.value})} /></label>
        <label>Briefing de imagem<input value={slide.imageBrief ?? ''} onChange={event => change(slide.key,{imageBrief:event.target.value})} /></label>
        {(automaticBySlide.has(slide.key) || requests.some(item => item.key === slide.key)) && <div className="express-image-match">
          {automaticBySlide.has(slide.key) ? <img src={String(automaticBySlide.get(slide.key)?.object.src)} alt="" /> :
            <span className="visual-search-placeholder" aria-hidden="true" />}
          <VisualSearchStatus status={search.status(requests.find(item => item.key === slide.key))}
            match={automaticBySlide.get(slide.key)?.automatic?.match} />
        </div>}
    </article>)}</div>
    <button className="button button-outline" disabled={slides.length >= maxSlides} onClick={() => setSlides(items => [...items,entry()])}>Adicionar slide</button>
  </div>
  else if (step === 'Imagens') panel = <>
    <nav aria-label="Origem das imagens da produção" className="collection-actions">
      {([['local','Arquivos locais'],['openverse','Openverse'],['library','Imagens utilizadas'],['url','Link externo']] as const).map(([value,label]) =>
        <button key={value} id={`express-origin-${value}`} className="button button-outline" aria-pressed={origin === value} disabled={busy || downloading} onClick={() => setOrigin(value)}>{label}</button>)}
    </nav>
    {origin === 'local' && <div className="express-drop" onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault(); if (!busy) void addPhotos(Array.from(event.dataTransfer.files)).catch(cause => setError(errorText(cause)))
    }}><label>Adicionar imagens<input id="express-upload" type="file" multiple disabled={busy} accept="image/png,image/jpeg,image/webp" onChange={event => {
      const files = Array.from(event.target.files ?? [])
      event.target.value = ''
      if (files.length) void addPhotos(files).catch(cause => setError(errorText(cause)))
    }} /></label><p className="muted">Arraste PNG, JPEG ou WebP. Até 20 MB por imagem.</p></div>}
    {active && origin === 'openverse' && <div>
      <label>Buscar pelo conteúdo do slide<select value={imageBriefSlide} disabled={busy} onChange={event => setImageBriefSlide(event.target.value)}>
        <option value="">Pesquisa livre</option>
        {slides.map((slide, index) => <option key={slide.key} value={slide.key}>Slide {index + 1} · {slide.title || 'Sem título'}</option>)}
      </select></label>
      <ImageSearch key={imageBriefSlide} initialTerm={(() => {
        const slide = slides.find(item => item.key === imageBriefSlide)
        return slide ? editorialImageQuery(slide.imageBrief, slide.title) : ''
      })()} insertLabel={imageBriefSlide ? 'Vincular ao slide com créditos' : 'Adicionar à produção'}
        insert={(file,credit,signal) => addPhotos([file],credit,signal,imageBriefSlide || undefined)} />
    </div>}
    {active && origin === 'library' && <ImageLibrary flush={noFlush} success="Imagem adicionada à produção." insert={(file,credit,signal) => addPhotos([file],credit,signal)} />}
    {origin === 'url' && <div className="collection-actions"><label>URL externa da imagem<input type="url" value={url} onChange={event => setUrl(event.target.value)} /></label>
      <button className="button button-dark" disabled={busy || downloading || !url.trim()} onClick={() => void external()}>Importar imagem</button></div>}
    {!!photos.length && <>
      <section className="express-vision" aria-label="Análise visual opcional">
        <p>{visual.size ? 'Sugestões combinam classes visuais reconhecidas e metadados, quando há correspondência. Os vínculos manuais têm prioridade.'
          : 'Sugestões usam briefing, nomes e metadados. A análise visual opcional carrega cerca de 19 MB e processa as fotos neste navegador.'}</p>
        <div className="collection-actions">
          <button className="button button-outline" disabled={busy || downloading || !!vision.progress} onClick={() => vision.start(photos)}>
            {visual.size ? 'Reanalisar imagens localmente' : 'Analisar imagens localmente'}
          </button>
          {(visual.size > 0 || vision.progress) && <button className="button button-outline" onClick={vision.clear}>
            {vision.progress ? 'Cancelar análise visual' : 'Usar somente metadados'}
          </button>}
          {vision.progress && <progress aria-label="Progresso da análise visual" value={vision.progress.done} max={vision.progress.total} />}
        </div>
        {vision.progress && <p role="status">{vision.progress.done} de {vision.progress.total} imagens analisadas.</p>}
        {vision.status && <p role="status">{vision.status}</p>}
      </section>
      <div className="collection-actions"><h3>Imagens da produção</h3><button className="button button-outline" disabled={busy}
        onClick={() => setSlides(items => {
          const reserved = new Set(items.map(item => item.imageId))
          const available = photos.filter(item => !reserved.has(item.id))
          let index = 0
          return items.map(item => item.imageId === undefined && !item.imageLocked ? { ...item,imageId:available[index++]?.id } : item)
        })}>Distribuir na ordem</button></div>
      <div className="express-photos">{photos.map((photo,index) => <article key={photo.id} draggable={!busy}
        onDragStart={() => { dragged.current=photo.id }} onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault(); if (dragged.current) movePhoto(dragged.current,photo.id); dragged.current=undefined
        }}>
        <button className="express-photo" aria-pressed={photoId === photo.id} onClick={() => setPhotoId(photo.id)}>
          <img src={String(photo.object.src)} alt="" /><span>{photo.name}</span>
        </button>
        <small>{slides.some(item => item.imageId === photo.id) ? 'Vinculada' : plannedPhotos.has(photo.id) ? 'Na distribuição prevista' : 'Não utilizada'}</small>
        <div className="collection-actions">
          <button className="button button-outline" aria-label={`Antecipar imagem ${index+1}`} disabled={busy || index === 0} onClick={() => movePhoto(photo.id,photos[index-1].id)}>←</button>
          <button className="button button-outline" aria-label={`Adiar imagem ${index+1}`} disabled={busy || index === photos.length-1} onClick={() => movePhoto(photo.id,photos[index+1].id)}>→</button>
          <button className="button button-outline" aria-label={`Remover imagem ${index+1}`} disabled={busy || slides.some(slide => slide.imageLocked && slide.imageId === photo.id)} onClick={() => removePhoto(photo.id)}>×</button>
        </div>
      </article>)}</div>
    </>}
    <div className="express-assignment">{photos.find(photo => photo.id === photoId) && <img
        src={String(photos.find(photo => photo.id === photoId)!.object.src)} alt="Imagem selecionada" />}
        <div>{slides.map((slide,index) => {
          const planned = imagePlan[index]
          const auto = automaticBySlide.get(slide.key)
          const match = !localPlan[index]?.picture ? auto?.automatic?.match : photos.find(photo => photo.id === slide.imageId)?.automatic?.match
          const request = requests.find(item => item.key === slide.key)
          const focal = planned?.content.focalPoint ?? { x: .5, y: .5 }
          return <div className="express-image-row" key={slide.key} onDragOver={event => {
          if (dragged.current && !busy) event.preventDefault()
        }} onDrop={event => {
          event.preventDefault()
          if (!busy && !slide.imageLocked && photos.some(photo => photo.id === dragged.current)) assignPhoto(slide, index, dragged.current)
          dragged.current = undefined
        }}><div className="express-image-match">
          {typeof planned?.content.image?.src === 'string' ? <img src={planned.content.image.src} alt="" /> :
            <span className="visual-search-placeholder" aria-hidden="true" />}
          <div><strong>{auto?.name ?? planned?.picture?.name ?? 'Sem imagem prevista'}</strong>
            {imagePlan[index]?.picture?.reason && <p>{imagePlan[index].picture!.reason}</p>}
            {imagePlan[index]?.picture?.origin === 'automatic' && <p>Distribuição pela ordem dos arquivos.</p>}
            {planned?.content.focalPoint && !slide.focalPoint && <p>Ponto focal sugerido pela concentração de contraste.</p>}
          </div>
        </div>
        <VisualSearchStatus status={search.status(request)} match={match} />
        <p className="muted">{slide.imageLocked ? 'Travado' : slide.imageId === null ? 'Sem imagem' : slide.imageId ? 'Confirmado manualmente' : 'Automático'}</p>
        <div className="collection-actions">
          {match && auto && <button className="button button-outline" onClick={() => assignPhoto(slide, index, auto.id)}>Manter esta</button>}
          {planned?.content.image && !slide.imageLocked && <button className="button button-outline" onClick={() =>
            change(slide.key, { imageId: slide.imageId ?? auto?.id ?? planned.picture?.id, imageLocked: true,
              focalPoint: slide.focalPoint ?? planned.content.focalPoint })}>Travar imagem</button>}
          {slide.imageLocked && <button className="button button-outline" onClick={() => change(slide.key, { imageLocked: false })}>Destravar imagem</button>}
          {!slide.imageLocked && <button className="button button-outline" onClick={() => { setOrigin('openverse'); setImageBriefSlide(slide.key) }}>Trocar imagem</button>}
          {!slide.imageLocked && (slide.imageId !== undefined || match || request) && <button className="button button-outline" onClick={() => {
            setPrepared(undefined); assignPhoto(slide, index, undefined)
          }}>{slide.imageId !== undefined ? 'Voltar ao automático' : 'Buscar novamente'}</button>}
          {!slide.imageLocked && planned?.content.image && <button className="button button-outline" onClick={() => assignPhoto(slide, index, null)}>
            {match ? 'Desfazer escolha automática' : 'Remover imagem'}
          </button>}
        </div>
        {planned?.picture?.origin === 'suggested' && planned.picture.id && <div className="collection-actions">
          <button className="button button-outline" onClick={() => assignPhoto(slide, index, planned.picture!.id)}>Aceitar sugestão</button>
          {!!visual.size && !slide.ignoreVisual && <button className="button button-outline" onClick={() => change(slide.key, { ignoreVisual: true })}>Ignorar análise visual neste slide</button>}
        </div>}
        {slide.ignoreVisual && !!visual.size && <button className="button button-outline" onClick={() => change(slide.key, { ignoreVisual: false })}>Reativar análise visual neste slide</button>}
        <label>Imagem do slide {index+1}<select id={'express-edit-image-' + index} disabled={slide.imageLocked} value={slide.imageId === null ? 'none' : slide.imageId ?? ''}
          onChange={event => assignPhoto(slide, index, event.target.value === 'none' ? null : event.target.value || undefined)}>
          <option value="">Automática</option><option value="none">Sem imagem</option>{photos.map((photo,i) => <option value={photo.id} key={photo.id}>{i+1} · {photo.name}</option>)}
        </select></label><label>Enquadramento do slide {index+1}<select value={slide.framing ?? 'cover'}
          onChange={event => change(slide.key, { framing: event.target.value === 'contain' ? 'contain' : 'cover',
            ...(auto && match ? { imageId: auto.id, focalPoint: focal } : {}) })}>
          <option value="cover">Preencher a área</option><option value="contain">Mostrar imagem inteira</option>
        </select></label>
        {planned?.content.image && slide.framing !== 'contain' && <details className="express-focal">
          <summary>Ajustar ponto focal do slide {index + 1}</summary>
          {(['x', 'y'] as const).map(axis => <label key={axis}>Ponto focal {axis === 'x' ? 'horizontal' : 'vertical'}
            <input type="range" min={0} max={100} step={1} value={Math.round(focal[axis] * 100)}
              onChange={event => change(slide.key, { imageId: slide.imageId ?? (match ? auto?.id : undefined),
                focalPoint: { ...focal, [axis]: event.currentTarget.valueAsNumber / 100 } })} />
          </label>)}
          <div className="collection-actions">
            <button className="button button-outline" onClick={() => change(slide.key, { imageId: slide.imageId ?? (match ? auto?.id : undefined), focalPoint: { x: .5, y: .5 } })}>Centralizar enquadramento</button>
            <button className="button button-outline" disabled={!slide.focalPoint} onClick={() => change(slide.key, { focalPoint: undefined })}>Restaurar enquadramento automático</button>
          </div>
        </details>}
        </div>})}</div></div>
  </>
  else if (step === 'Templates') panel = <>
    <AuthorTemplates format={format} selected={author?.id} use={value => {
      setAuthor(value); setFormat(value.format); setStatus(`${value.name} selecionado em ${formatNames[value.format]}.`)
    }} edit={async value => { await draftQueue.flush(slot); await editTemplate(value) }} />
    <CollectionGallery selected={author ? undefined : style.id} format={format} setFormat={value => {
      setFormat(value)
      if (author && author.format !== value) { setAuthor(undefined); setStatus('Formato da coleção alterado. Selecione uma composição nesse formato.') }
    }} use={value => {
      setAuthor(undefined); setStyle(value); setStatus(`${value.name} selecionada.`)
    }} />
  </>
  else panel = <>
    <div className="express-summary"><h3>{slides.length} {slides.length === 1 ? 'slide' : 'slides'}</h3>
      <p>{author?.name ?? style.name} · {formatNames[format]} · {author
        ? author.brandMode === 'linked' ? 'Identidade do template' : 'Minha marca'
        : brand.name || brand.handle || (collectionBrand(style,brand) === brand ? 'Marca local' : 'Paleta da coleção')}</p></div>
    {!!invalid.length && <ul className="express-warnings">{invalid.map(message => <li key={message}>{message}</li>)}</ul>}
    <div className="factory-action">
      {!result && <button className="button button-dark" disabled={!!invalid.length || progress !== undefined || busy || !!vision.progress}
        onClick={() => void startFabrication()}>{slides.length === 1 ? 'Fabricar meu post' : 'Fabricar meu carrossel'}</button>}
      {progress !== undefined && <>
        <progress aria-label="Progresso da fabricação" value={progress} max={slides.length} />
        <button className="button button-outline" onClick={() => {
          generation.current?.abort()
          setStatus('Fabricação cancelada. O conteúdo continua disponível.')
        }}>Cancelar fabricação</button>
      </>}
      {!result && progress === undefined && !invalid.length && <p className="muted">{author
        ? 'Confira como o conteúdo se encaixa nas áreas do template.' : 'Compare três propostas na coleção selecionada.'}</p>}
    </div>
    {result && <ProposalReview result={result} selected={selected} slideIndex={previewIndex} busy={busy}
      show={(version,index) => { setSelected(version); if (index !== undefined) setPreviewIndex(index) }}
      open={proposal => void create(proposal)} edit={editSlide} divide={splitSlide} canDivide={slides.length < maxSlides}
      replace={author ? undefined : replaceComposition} />}
  </>

  async function leave() {
    try { await draftQueue.flush(slot); cancel() }
    catch { /* A tentativa fica disponível na preparação. */ }
  }

  async function recover(data: ExpressDraft) {
    if (data.authorTemplateId) {
      setBusy(true)
      try {
        const template = await loadAuthorTemplate(data.authorTemplateId)
        setAuthor(template)
        data = { ...data, format: template.format }
      } catch (cause) {
        setDraftError(`Template da preparação indisponível. Selecione outro em Templates. ${errorText(cause)}`)
        data = { ...data, step: 'Templates' }
      } finally { setBusy(false) }
    }
    setText(data.text); setSlides(data.slides); setLinked(data.linked); setName(data.name)
    setCaption(data.caption); setPhotos(data.photos); setPhotoId(data.photos[0]?.id ?? '')
    setFormat(data.format); setStyle(collections.find(item => item.id === data.styleId) ?? collections[0])
    setStep(tools.some(tool => tool.label === data.step) ? data.step : 'Conteúdo')
    setOrigin(data.origin)
    setCandidate(undefined); setDraftGate('ready')
  }

  async function discard() {
    if (operation.current || !window.confirm('Descartar esta preparação e suas imagens locais?')) return
    operation.current = true
    setBusy(true)
    try {
      await storedDraft.clear()
      setCandidate(undefined); setDraftError(''); setDraftGate('ready')
    } catch (cause) { setDraftError(errorText(cause)) }
    finally { operation.current = false; setBusy(false) }
  }

  return <section className="express" aria-label="Produção Expressa">
    <header><h2>Produção Expressa</h2><button className="button button-outline" disabled={busy || downloading} onClick={() => void leave()}>Voltar aos projetos</button></header>
    {draftError && <p className="express-warning" role="alert">{draftError}</p>}
    {draftGate === 'loading' && <p role="status">Verificando preparação local…</p>}
    {draftGate === 'error' && <button className="button button-outline" onClick={() => setDraftGate('ready')}>Continuar com a preparação atual</button>}
    {draftGate === 'recover' && candidate && <div className="express-panel">
      <h3>Preparação anterior disponível</h3>
      <p>{candidate.name || 'Produção Expressa'} · {candidate.slides.length} slide(s) · {candidate.photos.length} imagem(ns)</p>
      <div className="collection-actions">
        <button className="button button-dark" disabled={busy} onClick={() => void recover(candidate)}>Retomar preparação</button>
        <button className="button button-outline" disabled={busy} onClick={() => void discard()}>Descartar rascunho</button>
      </div>
    </div>}
    {draftGate === 'ready' && <>
    <ContextWorkspace rail={<ContextRail label="Etapas da Produção Expressa" tools={tools} selected={step} choose={selectStep}
      disabled={busy || downloading} completed={[
        ...(!invalid.length ? ['Conteúdo'] : []), ...(photos.length || slides.every(item => item.imageId === null) ? ['Imagens'] : []),
        ...(step === 'Prévia' || author || style !== collections[0] ? ['Templates'] : []), ...(result ? ['Prévia'] : []),
      ]} />}>
      <div className="express-panel">
        <header className="express-step">
          <h3>{step}</h3>
          <span className="muted">{slides.length - invalid.length} de {slides.length} slide(s) com conteúdo · {photos.length} imagem(ns) · {author?.name ?? style.name}</span>
        </header>
        {(busy || downloading) && <p role="status">{downloading ? 'Baixando imagem…' : 'Preparando…'}</p>}
        {error && <p className="express-warning" role="alert">{error}</p>}
        {status && <p className="express-feedback" key={status} role="status">{status}</p>}
        {(targets.length > 0 || matchedPhotos.length > 0) && <p className="muted">
          Modo visual Documental · Openverse · {matchedPhotos.length} de {slides.length} slides com sugestão do acervo
          {' · '}{matchedPhotos.filter(match => match.strategy === 'editorial').length} em apoio editorial
          {' · '}{requests.filter(item => search.status(item) === 'empty').length} sem resultado confiável
        </p>}
        <div className="express-stage" key={step}>{panel}</div>
        {step !== 'Prévia' && <div className="collection-actions express-next">
          <button className="button button-dark" disabled={busy || downloading || (step === 'Conteúdo' && !!invalid.length)}
            onClick={() => selectStep(step === 'Conteúdo' ? 'Imagens' : step === 'Imagens' ? 'Templates' : 'Prévia')}>
            {step === 'Conteúdo' ? 'Avançar para imagens' : step === 'Imagens' ? 'Avançar para templates' : 'Avançar para prévia'}
          </button>
        </div>}
      </div>
    </ContextWorkspace></>}
  </section>
}
