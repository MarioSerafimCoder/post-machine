import { useEffect, useRef, useState } from 'react'
import { renderScene } from './export'
import { dimensions, type Scene, type Format } from './model'
import type { Project } from './model'
export function Slides({ project, current, select, action, issues }: { project: Project; issues: ReadonlyMap<Scene,boolean>; current: number; select: (index: number) => void; action: (action: 'add' | 'duplicate' | 'remove' | 'up' | 'down') => void }) {
  return <section className="studio-slides" aria-label="Slides"><div className="slide-list">{project.slides.map((slide, index) => <button key={slide.id} aria-pressed={current === index} onClick={() => select(index)} onKeyDown={event => {
    if (event.altKey && current === index && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      const offset = event.key === 'ArrowLeft' ? -1 : 1
      if (index + offset >= 0 && index + offset < project.slides.length) { event.preventDefault(); action(offset < 0 ? 'up' : 'down') }
    }
  }}><Thumbnail scene={slide.scene} format={project.format} /><span>Slide {index + 1}</span>{issues.get(slide.scene) && <span className="slide-issue" title="A auditoria encontrou problemas" role="img" aria-label="Revisão pendente">!</span>}</button>)}</div><div className="slide-actions"><button disabled={project.slides.length >= 20} onClick={() => action('add')}>Adicionar slide</button><button disabled={project.slides.length >= 20} onClick={() => action('duplicate')}>Duplicar slide</button><button disabled={project.slides.length === 1} onClick={() => action('remove')}>Excluir slide</button><button disabled={current === 0} onClick={() => action('up')}>Slide para esquerda</button><button disabled={current === project.slides.length - 1} onClick={() => action('down')}>Slide para direita</button></div></section>
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
