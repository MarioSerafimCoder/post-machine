import { useEffect, useState } from 'react'
import { renderScene } from './export'
import { dimensions, type Scene, type Format } from './model'
import type { Project } from './model'
export function Slides({ project, current, select, action }: { project: Project; current: number; select: (index: number) => void; action: (action: 'add' | 'duplicate' | 'remove' | 'up' | 'down') => void }) {
  return <section className="studio-slides" aria-label="Slides"><div className="slide-list">{project.slides.map((slide, index) => <button key={slide.id} aria-pressed={current === index} onClick={() => select(index)}><Thumbnail scene={slide.scene} format={project.format} /><span>Slide {index + 1}</span></button>)}</div><div className="slide-actions"><button disabled={project.slides.length >= 20} onClick={() => action('add')}>Adicionar slide</button><button disabled={project.slides.length >= 20} onClick={() => action('duplicate')}>Duplicar slide</button><button disabled={project.slides.length === 1} onClick={() => action('remove')}>Excluir slide</button><button disabled={current === 0} onClick={() => action('up')}>Slide para esquerda</button><button disabled={current === project.slides.length - 1} onClick={() => action('down')}>Slide para direita</button></div></section>
}

function Thumbnail({ scene, format }: { scene: Scene; format: Format }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true; let source = ''
    const timer = window.setTimeout(() => { void renderScene(scene, dimensions[format][0], dimensions[format][1], 0, .1).then(({ blob }) => { if (active) { source = URL.createObjectURL(blob); setUrl(source) } }, () => undefined) }, 650)
    return () => { active = false; window.clearTimeout(timer); if (source) URL.revokeObjectURL(source) }
  }, [scene, format])
  return url ? <img className="slide-thumbnail" src={url} alt="Prévia do slide" /> : <span className="slide-mini">Preparando prévia…</span>
}
