import { useEffect, useRef, useState } from 'react'
import { Canvas, FabricImage, Textbox } from 'fabric'
import { CanvasView } from './CanvasView'
import { Properties } from './Properties'
import { dimensions, formatNames, newProject, type Format, type Project } from './model'
import { addObject, duplicate, sceneOf } from './objects'
import { readImage } from './images'
import './studio.css'

export function Studio() {
  const [project, setProject] = useState<Project>()
  const [format, setFormat] = useState<Format>('portrait')
  const [zoom, setZoom] = useState(.32)
  const [guides, setGuides] = useState(true)
  const [panel, setPanel] = useState('Texto')
  const [error, setError] = useState('')
  const [, refresh] = useState(0)
  const canvas = useRef<Canvas | null>(null)
  const [readyCanvas, setReadyCanvas] = useState<Canvas | null>(null)
  const changed = () => {
    if (!canvas.current) return
    const scene = sceneOf(canvas.current)
    setProject(p => p && ({ ...p, updatedAt: new Date().toISOString(), slides: p.slides.map((s, i) => i === 0 ? { ...s, scene } : s) }))
    refresh(n => n + 1)
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!canvas.current || event.target instanceof HTMLElement && (event.target.closest('input, textarea, select, [contenteditable=true]'))) return
      const selected = canvas.current.getActiveObject()
      if (selected instanceof Textbox && selected.isEditing) return
      if (event.key === 'Delete') { event.preventDefault(); canvas.current.remove(...canvas.current.getActiveObjects()); canvas.current.discardActiveObject(); changed() }
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') { event.preventDefault(); void duplicate(canvas.current).then(changed) }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [])
  async function upload(file?: File) {
    if (!file || !canvas.current) return
    try {
      const image = await readImage(file)
      const selected = canvas.current.getActiveObject()
      if (selected instanceof FabricImage) {
        image.set({ left: selected.left, top: selected.top, angle: selected.angle, scaleX: selected.getScaledWidth() / image.width, scaleY: selected.getScaledHeight() / image.height })
        canvas.current.remove(selected)
      } else { image.scaleToWidth(700); image.set({ left: 80, top: 300 }) }
      canvas.current.add(image); canvas.current.setActiveObject(image); canvas.current.requestRenderAll(); changed(); setError('')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Falha ao abrir imagem.') }
  }
  if (!project) return <section className="studio-welcome"><p className="eyebrow">DIRETO / STUDIO</p><h2>Dê forma à sua próxima ideia.</h2><p>Crie um post com texto, imagens e elementos editáveis.</p><label>Formato do projeto<select value={format} onChange={e => setFormat(e.target.value as Format)}>{Object.entries(formatNames).map(([key, name]) => <option key={key} value={key}>{name} · {dimensions[key as Format].join(' × ')}</option>)}</select></label><button className="button button-dark" onClick={() => setProject(newProject(format))}>Criar projeto vazio</button><a className="button button-outline" href="#/radar">Nova campanha</a></section>
  return <section className="studio" aria-label="Editor Studio">
    <header className="studio-toolbar"><label>Projeto<input value={project.name} maxLength={100} onChange={e => setProject({ ...project, name: e.target.value })} /></label><span>{formatNames[project.format]} · {dimensions[project.format].join(' × ')}</span><label>Zoom<select value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[.2, .25, .32, .4, .5, .75, 1].map(n => <option key={n} value={n}>{Math.round(n * 100)}%</option>)}</select></label><button onClick={() => setZoom(Math.min(.5, (window.innerWidth - 690) / 1080))}>Ajustar à tela</button><label><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} />Área segura</label></header>
    {error && <p role="alert">{error}</p>}
    <div className="studio-layout"><aside className="studio-tools"><nav aria-label="Ferramentas do Studio">{['Texto', 'Imagens', 'Elementos', 'Camadas'].map(name => <button key={name} aria-pressed={panel === name} onClick={() => setPanel(name)}>{name}</button>)}</nav>
      {panel === 'Texto' && <><h3>Tipografia</h3><button onClick={() => { if (canvas.current) { addObject(canvas.current, 'title'); changed() } }}>Adicionar título</button><button onClick={() => { if (canvas.current) { addObject(canvas.current, 'text'); changed() } }}>Adicionar texto</button></>}
      {panel === 'Elementos' && <><h3>Formas</h3>{([['rect', 'Retângulo'], ['circle', 'Círculo'], ['line', 'Linha']] as const).map(([type, name]) => <button key={type} onClick={() => { if (canvas.current) { addObject(canvas.current, type); changed() } }}>{name}</button>)}</>}
      {panel === 'Imagens' && <><h3>Imagens locais</h3><label>Adicionar ou substituir imagem<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} /></label><p>PNG, JPEG ou WebP. Até 20 MB e 40 MP. Selecione uma imagem para substituí-la.</p></>}
      {panel === 'Camadas' && <><h3>Camadas</h3>{readyCanvas?.getObjects().map((o, i) => <button key={i} onClick={() => { canvas.current?.setActiveObject(o); canvas.current?.requestRenderAll(); refresh(n => n + 1) }}>{i + 1} · {o instanceof Textbox ? o.text.slice(0, 32) : o.type}</button>).reverse()}</>}
    </aside><CanvasView key={project.id} format={project.format} initial={project.slides[0].scene} zoom={zoom} guides={guides} onReady={value => { canvas.current = value; setReadyCanvas(value) }} onChange={changed} onSelection={() => refresh(n => n + 1)} onError={setError} /><Properties canvas={readyCanvas} changed={changed} /></div>
    <p className="muted">Ctrl+D duplica · Delete exclui · Edição local em memória nesta entrega. Persistência e exportação na entrega 3.3.</p>
  </section>
}
