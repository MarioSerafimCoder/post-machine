import { useEffect, useRef, useState } from 'react'
import { renderScene } from './export'
import { dimensions, type Scene, type Format } from './model'
import type { Project } from './model'
import { compositionNames } from './collections'
import { templates } from './templates'
import { sameReviewSettings } from '../audit/review'

export type SlideReview = { project: Project; scene: Scene; errors: number; warnings: number }
export function Slides({ project, current, select, action, issues, reorder, open, toggle }: {
  project: Project; issues: ReadonlyMap<string,SlideReview>; current: number; select: (index: number) => void
  reorder: (from: number, to: number) => void; open: boolean; toggle: () => void
  action: (action: 'add' | 'duplicate' | 'remove' | 'up' | 'down') => void
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
  return <section className="studio-slides" aria-label="Slides">
    <header><strong>Frames</strong><button aria-expanded={open} onClick={toggle}>{open ? 'Recolher frames' : 'Mostrar frames'}</button></header>
    {open && <><div className="slide-list" ref={list}>{project.slides.map((slide, index) => {
      const review = issues.get(slide.id)
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
      return <button key={slide.id} aria-label={'Slide ' + (index+1)} aria-description={description}
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
          if (!event.altKey || current !== index || !['ArrowLeft','ArrowRight'].includes(event.key)) return
          const offset = event.key === 'ArrowLeft' ? -1 : 1
          if (index + offset < 0 || index + offset >= project.slides.length) return
          event.preventDefault()
          action(offset < 0 ? 'up' : 'down')
        }}>
        <Thumbnail scene={slide.scene} format={project.format} />
        <span className="slide-caption"><b>{String(index+1).padStart(2,'0')}</b> {label}</span>
        <span className="slide-issue" data-level={level} title={description} aria-hidden="true">{indicator}</span>
      </button>
    })}</div>
    <div className="slide-actions">
      <button disabled={project.slides.length >= 20} onClick={() => action('add')}>Adicionar slide</button>
      <button disabled={project.slides.length >= 20} onClick={() => action('duplicate')}>Duplicar slide</button>
      <button disabled={project.slides.length === 1} onClick={() => action('remove')}>Excluir slide</button>
      <button disabled={current === 0} onClick={() => action('up')}>Slide para esquerda</button>
      <button disabled={current === project.slides.length - 1} onClick={() => action('down')}>Slide para direita</button>
    </div></>}
  </section>
}

const thumbnails = new WeakMap<Scene, Map<Format,Blob>>()

function Thumbnail({ scene, format }: { scene: Scene; format: Format }) {
  const [url, setUrl] = useState('')
  const [seen, setSeen] = useState(false)
  const element = useRef<HTMLSpanElement>(null)
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
    const timer = window.setTimeout(() => {
      const cache = thumbnails.get(scene) ?? new Map<Format,Blob>()
      const existing = cache.get(format)
      if (existing) { setUrl(URL.createObjectURL(existing)); return }
      const [width, height] = dimensions[format]
      void renderScene(scene, width, height, { scale: .1, signal: controller.signal }).then(({ blob }) => {
        if (!controller.signal.aborted) {
          cache.set(format,blob)
          thumbnails.set(scene,cache)
          setUrl(URL.createObjectURL(blob))
        }
      }, () => undefined)
    }, 650)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [scene, format, seen])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return <span ref={element} className="slide-mini" aria-hidden="true">{url ? <img className="slide-thumbnail" src={url} alt="" /> : 'Prévia'}</span>
}
