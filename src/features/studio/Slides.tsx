import { isSearchFailure } from '../images/searchDiagnostics'
import { memo, useEffect, useRef, useState } from 'react'
import { renderScene } from './export'
import { dimensions, type Scene, type Format } from './model'
import type { Project } from './model'
import { compositionNames } from './collections'
import { templates } from './templates'
import { sameReviewSettings } from '../audit/review'
import type { VisualStatus } from '../images/automaticSearch'
import { hasEditorialAlternative } from './editorialAlternative'

export type SlideReview = { project: Project; scene: Scene; errors: number; warnings: number }
export function Slides({ project, current, select, action, issues, reorder, open, toggle, imageStatus, locatePhoto }: {
  project: Project; issues: ReadonlyMap<string,SlideReview>; current: number; select: (index: number) => void
  reorder: (from: number, to: number) => void; open: boolean; toggle: () => void
  action: (action: 'add' | 'duplicate' | 'remove' | 'up' | 'down') => void
  locatePhoto: (index: number, group: 'applied' | 'empty' | 'error') => void
  imageStatus?: (id: string) => VisualStatus | undefined
}) {
  const list = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)
  useEffect(() => {
    const row = list.current
    const button = row?.querySelector<HTMLButtonElement>('[aria-pressed=true]')
    if (!open || !row || !button) return
    const bounds = row.getBoundingClientRect()
    const active = button.getBoundingClientRect()
    if (active.top < bounds.top) row.scrollTop -= bounds.top-active.top
    else if (active.bottom > bounds.bottom) row.scrollTop += active.bottom-bounds.bottom
  }, [current,open,project.slides.length])
  const photos = { applied: [] as number[], empty: [] as number[], error: [] as number[] }
  project.slides.forEach((slide, index) => {
    const state = imageStatus?.(slide.id)
    if (state === 'empty' || state === 'insufficient') photos.empty.push(index)
    else if (isSearchFailure(state)) photos.error.push(index)
    else if (slide.visualChoice?.match) photos.applied.push(index)
  })
  return <section className="studio-slides" aria-label="Slides">
    <header><strong>Slides</strong><button aria-expanded={open} onClick={toggle}>{open ? 'Recolher slides' : 'Mostrar slides'}</button></header>
    {open && Object.values(photos).some(indices => indices.length) && <div className="photo-summary" role="group" aria-label="Fotografias do projeto">
      {([{ group: 'applied', label: 'Fotos aplicadas' }, { group: 'empty', label: 'Escolher imagem' }, { group: 'error', label: 'Tentar novamente' }] as const).map(({ group, label }) =>
        photos[group].length > 0 && <button key={group} onClick={() => locatePhoto(photos[group][0], group)}>{label} · {photos[group].length}</button>)}
    </div>}
    {open && <><div className="slide-list" ref={list} role="group" aria-label="Setas navegam. Alt e setas movem o slide ativo.">{project.slides.map((slide, index) => {
      const review = issues.get(slide.id)
      const status = imageStatus?.(slide.id)
      const match = slide.visualChoice?.match
      const photoStatus = hasEditorialAlternative(slide) ? (slide.visualChoice?.reception?.confirmed ? 'Alternativa editorial confirmada' : slide.visualChoice?.reception?.documentaryRequired === false ? 'Alternativa editorial' : 'Alternativa editorial · revisão pendente') : slide.visualChoice?.reviewRequired ? 'Contexto alterado: revise a imagem' : status === 'empty' ? 'Nenhuma imagem adequada encontrada' :
        isSearchFailure(status) ? 'Revise a busca de imagem' : match ? 'Imagem encontrada' : status ? 'Buscando imagem' :
          slide.visualChoice?.mode === 'none' ? 'Slide sem imagem' : ''
      const composition = /^collection-v1:[^:]+:(\d)$/.exec(slide.layout)?.[1]
      const label = composition === undefined ? templates[slide.layout as keyof typeof templates] ?? 'Livre' : compositionNames[Number(composition)] ?? 'Livre'
      const stale = review && (review.scene !== slide.scene || !sameReviewSettings(review.project,project))
      let description = 'Ainda não revisado'
      let indicator = '·'
      let level = 'unknown'
      if (stale) {
        description = 'Revisão desatualizada'
        indicator = '↻'
        level = 'stale'
      } else if (review) {
        description = review.errors + (review.errors === 1 ? ' erro, ' : ' erros, ') +
          review.warnings + (review.warnings === 1 ? ' aviso' : ' avisos')
        indicator = review.errors || review.warnings ? review.errors + 'E · ' + review.warnings + 'A' : '✓'
        level = review.errors ? 'error' : review.warnings ? 'warning' : 'clear'
      }
      return <button key={slide.id} aria-label={'Slide ' + (index+1)} aria-description={[description, photoStatus].filter(Boolean).join('. ')}
        aria-pressed={current === index} draggable onDragStart={event => {
          drag.current = index
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain',String(index))
        }} onDragEnd={() => { drag.current = null }} onDragOver={event => {
          if (drag.current !== null) event.preventDefault()
        }} onDrop={event => {
          event.preventDefault()
          if (drag.current !== null) reorder(drag.current,index)
          drag.current = null
        }} onClick={() => select(index)} onKeyDown={event => {
          const arrows: Record<string,number> = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-1, ArrowDown:1 }
          const direction = arrows[event.key]
          if (!direction && !['Home','End'].includes(event.key)) return
          const columns = list.current ? getComputedStyle(list.current).gridTemplateColumns.split(' ').length : 1
          const vertical = ['ArrowUp','ArrowDown'].includes(event.key)
          const destination = direction ? index + direction * (vertical ? columns : 1)
            : event.key === 'Home' ? 0 : project.slides.length-1
          if (event.altKey && (!direction || current !== index)) return
          event.preventDefault()
          if (destination < 0 || destination >= project.slides.length) return
          if (event.altKey) {
            reorder(index,destination)
            requestAnimationFrame(() => list.current?.querySelectorAll('button')[destination]?.focus())
          } else {
            select(destination)
            list.current?.querySelectorAll('button')[destination]?.focus()
          }
        }}>
        <Thumbnail scene={slide.scene} format={project.format} visualRevision={slide.visualChoice?.signature} />
        <span className="slide-caption"><b>{String(index+1).padStart(2,'0')}</b> {label}</span>
        {photoStatus && <span className="slide-caption muted">{photoStatus}</span>}
        <span className="slide-issue" data-level={level} title={description} aria-hidden="true">{indicator}</span>
      </button>
    })}</div>
    <div className="slide-actions">
      <button disabled={project.slides.length >= 20} onClick={() => action('add')}>Adicionar slide</button>
      <details className="slide-menu"><summary>Ações do slide {current + 1}</summary><div className="slide-menu-items"><button disabled={project.slides.length >= 20} onClick={() => action('duplicate')}>Duplicar slide</button>
      <button disabled={project.slides.length === 1} onClick={() => action('remove')}>Excluir slide</button>
      <button disabled={current === 0} onClick={() => action('up')}>Slide para esquerda</button>
      <button disabled={current === project.slides.length - 1} onClick={() => action('down')}>Slide para direita</button></div></details>
    </div></>}
  </section>
}

const thumbnails = new WeakMap<Scene, Map<Format,Blob>>()

export const Thumbnail = memo(function Thumbnail({ scene, format, visualRevision }: { scene: Scene; format: Format; visualRevision?: string }) {
  const [url, setUrl] = useState('')
  const [seen, setSeen] = useState(false)
  const element = useRef<HTMLSpanElement>(null)
  const rendered = useRef(false)
  const lastVisualRevision = useRef(visualRevision)
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setSeen(true); observer.disconnect() }
    })
    if (element.current) observer.observe(element.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!seen) return
    const controller = new AbortController()
    const changedVisualImage = lastVisualRevision.current !== visualRevision
    const delay = thumbnails.get(scene)?.has(format) || !rendered.current || changedVisualImage ? 0 : 650
    const timer = window.setTimeout(() => {
      const cache = thumbnails.get(scene) ?? new Map<Format,Blob>()
      const existing = cache.get(format)
      if (existing) { rendered.current = true; setUrl(URL.createObjectURL(existing)); return }
      const [width, height] = dimensions[format]
      void renderScene(scene, width, height, { scale: .1, signal: controller.signal }).then(({ blob }) => {
        if (!controller.signal.aborted) {
          rendered.current = true
          lastVisualRevision.current = visualRevision
          cache.set(format,blob)
          thumbnails.set(scene,cache)
          setUrl(URL.createObjectURL(blob))
        }
      }, () => undefined)
    }, delay)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [scene, format, seen, visualRevision])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return <span ref={element} className="slide-mini" aria-hidden="true">{url ? <img className="slide-thumbnail" src={url} alt="" /> : 'Prévia'}</span>
})
