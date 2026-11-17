import { useEffect, useRef, useState } from 'react'
import { renderScene } from './export'
import { dimensions, type Scene, type Format } from './model'
import type { Project } from './model'
import { sameReviewSettings } from '../audit/review'

export type SlideReview = { project: Project; scene: Scene; errors: number; warnings: number }
export function Slides({ project, current, select, action, issues }: {
  project: Project; issues: ReadonlyMap<string,SlideReview>; current: number; select: (index: number) => void
  action: (action: 'add' | 'duplicate' | 'remove' | 'up' | 'down') => void
}) {
  return <section className="studio-slides" aria-label="Slides">
    <div className="slide-list">{project.slides.map((slide, index) => {
      const review = issues.get(slide.id)
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
        aria-pressed={current === index} onClick={() => select(index)} onKeyDown={event => {
          if (!event.altKey || current !== index || !['ArrowLeft','ArrowRight'].includes(event.key)) return
          const offset = event.key === 'ArrowLeft' ? -1 : 1
          if (index + offset < 0 || index + offset >= project.slides.length) return
          event.preventDefault()
          action(offset < 0 ? 'up' : 'down')
        }}>
        <Thumbnail scene={slide.scene} format={project.format} />
        <span>Slide {index + 1}</span>
        <span className="slide-issue" data-level={level} title={description} aria-hidden="true">{indicator}</span>
      </button>
    })}</div>
    <div className="slide-actions">
      <button disabled={project.slides.length >= 20} onClick={() => action('add')}>Adicionar slide</button>
      <button disabled={project.slides.length >= 20} onClick={() => action('duplicate')}>Duplicar slide</button>
      <button disabled={project.slides.length === 1} onClick={() => action('remove')}>Excluir slide</button>
      <button disabled={current === 0} onClick={() => action('up')}>Slide para esquerda</button>
      <button disabled={current === project.slides.length - 1} onClick={() => action('down')}>Slide para direita</button>
    </div>
  </section>
}

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
      const [width, height] = dimensions[format]
      void renderScene(scene, width, height, { scale: .1, signal: controller.signal }).then(({ blob }) => {
        if (!controller.signal.aborted) setUrl(URL.createObjectURL(blob))
      }, () => undefined)
    }, 650)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [scene, format, seen])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return <span ref={element} className="slide-mini" aria-hidden="true">{url ? <img className="slide-thumbnail" src={url} alt="" /> : 'Prévia'}</span>
}
