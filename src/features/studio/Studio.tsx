import { ImageSearch } from '../images/ImageSearch'
import { ImageLibrary } from '../images/ImageLibrary'
import { projectCredits } from '../images/credits'
import type { ImageCredit } from '../images/contract'
import { HeadlinePanel } from '../headlines/HeadlinePanel'
import { campaignHeadlineContext } from '../headlines/context'
import { readCampaign } from '../campaigns/storage'
import { measureTitle } from './headlineFit'
import { CampaignStart, type CampaignStartMode } from '../campaigns/CampaignStart'
import { loadFonts } from './fonts'
import { useDocument } from './useDocument'
import { listProjects, loadProject, loadRecovery, removeProject, readBrand, backupProject, restoreProject } from './storage'
import { download, exportProject } from './export'
import type { Draft } from '../campaigns/contract'
import { templates, compose, semantics, fromCampaign, type Template } from './templates'
import { BrandPanel } from './BrandPanel'
import { Slides } from './Slides'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { Canvas, FabricImage, Textbox } from 'fabric'
import { CanvasView } from './CanvasView'
import { Properties } from './Properties'
import { defaultBrand, emptySlide, dimensions, formatNames, newProject, type Format, type Project } from './model'
import { addObject, duplicate, sceneOf } from './objects'
import { cropImage, readImage } from './images'
import './studio.css'
import { StorageSettings } from './StorageSettings'
import { AuditPanel } from '../audit/AuditPanel'
import type { Finding } from '../audit/contract'
import { resolvePage } from '../../lib/navigation'

export function Studio({ request, active, onStartCampaign }: { request: Draft | null; active: boolean; onStartCampaign: (mode: CampaignStartMode) => void }) {
  const [error, setError] = useState('')
  const { project, setProject, undo, redo, history, status, flush, getCurrent } = useDocument()
  const [library, setLibrary] = useState<Project[]>([])
  const [brand, setBrand] = useState(defaultBrand)
  const [busy, setBusy] = useState(false)
  const [pendingExport, setPendingExport] = useState<Awaited<ReturnType<typeof exportProject>>>()
  const [auditOpen,setAuditOpen]=useState(false)
  const [imagePanel, setImagePanel] = useState<{ tab: 'search' | 'library'; slideId: string; term: string; request: number }>()
  const [showCredits, setShowCredits] = useState(false)
  const [creditStatus, setCreditStatus] = useState('')
  const credits = project ? projectCredits(project) : ''
  const focusPath=useRef<string|null>(null)
  useEffect(() => { void listProjects().then(setLibrary, () => setError('Não foi possível carregar os projetos.')); void readBrand().then(value => { if (value) setBrand(value) }, () => undefined) }, [])
  async function back() {
    try {
      await flush()
      setLibrary(await listProjects())
      await flush()
      setPendingExport(undefined)
      setError('')
      setProject(undefined)
    } catch { setError('Falha ao salvar. Faça um backup antes de sair ou tente salvar novamente.') }
  }
  async function exportDesign(all: boolean) {
    if (!project) return
    setBusy(true); setError(''); setPendingExport(undefined)
    try {
      const result = await exportProject(project, all ? undefined : current)
      const latest = getCurrent()
      if (latest?.id !== project.id) return
      if (latest !== project) { setError('O projeto mudou durante a exportação. Exporte novamente para incluir as últimas edições.'); return }
      if (result.warnings.length) { setPendingExport(result); setAuditOpen(true) }
      else download(result.blob, result.name)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível exportar o design. Tente novamente.') }
    finally { setBusy(false) }
  }
  const [current, setCurrent] = useState(0)
  const [revision, setRevision] = useState(0)
  const currentRef = useRef(0)
  const [format, setFormat] = useState<Format>('portrait')
  const [zoom, setZoom] = useState(.32)
  const [guides, setGuides] = useState(true)
  const [panel, setPanel] = useState('Texto')
  const [, refresh] = useState(0)
  const canvas = useRef<Canvas | null>(null)
  const canvasStage = useRef<HTMLDivElement>(null)
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
  const campaign = request?.id === campaignId ? request : linkedCampaign?.id === campaignId ? linkedCampaign : undefined
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
  function focusFinding(finding:Finding){const index=project?.slides.findIndex(slide=>slide.id===finding.slideId)??-1;if(index<0)return;setAuditOpen(true);focusPath.current=finding.objectId;chooseSlide(index);if(index===current){selectPath(finding.objectId);focusPath.current=null}document.querySelector('.canvas-stage')?.scrollIntoView({block:'center',behavior:'smooth'})}
  const receiveAuditFocus=useEffectEvent(async(raw:string)=>{try{const target=JSON.parse(raw) as {projectId:string;slideId:string;objectId:string|null};await flush();const value=await loadProject(target.projectId);const index=value.slides.findIndex(slide=>slide.id===target.slideId);focusPath.current=target.objectId;chooseSlide(Math.max(0,index));replace(value, true);setAuditOpen(true)}catch(cause){setError(String(cause))}})
  useEffect(()=>{const receive=()=>{if(window.location.hash!=='#/studio')return;const raw=sessionStorage.getItem('post-machine:audit-focus')??sessionStorage.getItem('direto:audit-focus');if(!raw)return;sessionStorage.removeItem('post-machine:audit-focus');sessionStorage.removeItem('direto:audit-focus');queueMicrotask(()=>void receiveAuditFocus(raw))};receive();window.addEventListener('hashchange',receive);return()=>window.removeEventListener('hashchange',receive)},[])
  async function openProject(id: string) { try { await flush(); const value = await loadProject(id); chooseSlide(0); replace(value, true); setError('') } catch (e) { setError(String(e)) } }
  const handleRequest = useEffectEvent(async (draft: Draft) => {
    try { await flush(); const savedBrand = await readBrand(); await loadFonts(savedBrand ?? brand); chooseSlide(0); replace(fromCampaign(draft, savedBrand ?? brand)) } catch (e) { setError(String(e)) }
  })
  const handled = useRef<Draft | null>(null)
  useEffect(() => { if (request && handled.current !== request) { handled.current = request; void handleRequest(request) } }, [request])
  function template(layout: Template) {
    if (!project) return
    if (project.slides[current].scene.objects.length && !window.confirm('Trocar template preserva textos e imagem, mas recompõe os ajustes gráficos. Continuar?')) return
    replace({ ...project, slides: project.slides.map((s, i) => i === current ? { ...s, layout, scene: compose(layout, semantics(s.scene), project.brand, project.format, s.role) } : s) })
  }
  function slideAction(action: 'add' | 'duplicate' | 'remove' | 'up' | 'down') {
    if (!project) return
    const slides = [...project.slides]
    let next = current
    if (action === 'add') { slides.push(emptySlide()); next = slides.length - 1 }
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
        target.remove(frame, ...target.getObjects().filter(object => object.semantic === 'imageHint'))
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
  function exportCredits(value = credits) {
    if (value) download(new Blob([value], { type: 'text/plain;charset=utf-8' }), 'creditos.txt')
  }
  async function copyCredits() {
    try { await navigator.clipboard.writeText(credits); setCreditStatus('Créditos copiados.') }
    catch { setCreditStatus('Não foi possível copiar. Selecione o texto dos créditos.') }
  }
  if (!project) return <section className="studio-welcome"><p className="eyebrow">POST MACHINE / STUDIO</p><h2>Dê forma à sua próxima ideia.</h2><p>Crie um post com texto, imagens e elementos editáveis.</p><label>Formato do projeto<select value={format} onChange={e => setFormat(e.target.value as Format)}>{Object.entries(formatNames).map(([key, name]) => <option key={key} value={key}>{name} · {dimensions[key as Format].join(' × ')}</option>)}</select></label><button className="button button-dark" onClick={() => { chooseSlide(0); setProject({ ...newProject(format), brand }) }}>Criar projeto vazio</button><CampaignStart choose={onStartCampaign} />
    <label>Restaurar projeto ZIP<input type="file" accept=".zip" onChange={e => { const file = e.target.files?.[0]; if (file) void restoreProject(file).then(value => { chooseSlide(0); replace(value, true) }, error => setError(String(error))); e.target.value = '' }} /></label>
    {error && <p role="alert">{error}</p>}
    <StorageSettings flush={flush} /><h3>Projetos neste navegador</h3><div className="project-library">{library.map(item => <article key={item.id}><h4>{item.name}</h4><p>{item.slides.length} slide(s) · {formatNames[item.format]}</p><button className="button button-outline" onClick={() => void openProject(item.id)}>Abrir {item.name}</button><button className="button button-outline" onClick={() => { if (window.confirm('Excluir este projeto local?')) void removeProject(item.id).then(() => listProjects()).then(setLibrary, error => setError(String(error))) }}>Excluir {item.name}</button></article>)}</div></section>
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
            <button onClick={() => setShowCredits(value => !value)}>Gerar créditos do projeto</button>
            <button onClick={() => void backupProject(project).then(blob => download(blob, 'post-machine-projeto.zip'), () => setError('Não foi possível gerar o backup deste projeto.'))}>Backup completo</button>
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
        <label className="studio-inline-field">Zoom<select aria-label="Zoom" value={zoom} onChange={event => setZoom(Number(event.target.value))}>
          {[...new Set([zoom, .2, .25, .32, .4, .5, .75, 1])].sort((a,b) => a - b).map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}
        </select></label>
        <button onClick={() => {
          const stage = canvasStage.current?.querySelector('.canvas-stage')
          if (stage) setZoom(Math.max(.1, Math.min(1, (stage.clientWidth - 40) / 1080, (stage.clientHeight - 40) / dimensions[project.format][1])))
        }}>Ajustar à tela</button>
        <label className="studio-inline-field"><input type="checkbox" checked={guides} onChange={event => setGuides(event.target.checked)} />Área segura</label>
        <div className="studio-actions studio-output" role="group" aria-label="Revisão e exportação" aria-busy={busy}>
          <button aria-expanded={auditOpen} onClick={() => setAuditOpen(value => !value)}>Auditar design</button>
          <button disabled={busy} onClick={() => void exportDesign(false)}>Exportar PNG</button>
          <button disabled={busy} onClick={() => void exportDesign(true)}>Exportar ZIP</button>
        </div>
      </div>
    </header>
    {pendingExport?.source.id === project.id && <div className="export-warnings" role="alert"><h3>Revise antes de exportar</h3><ul>{pendingExport.findings.filter(f=>f.severity!=='info').map(f => <li key={f.id}><button onClick={()=>focusFinding(f)}>Slide {f.slideNumber}: {f.message} — localizar</button></li>)}</ul>{pendingExport.credits && <button onClick={() => exportCredits(pendingExport.credits)}>Exportar créditos desta arte</button>}<button disabled={pendingExport.source!==project} onClick={() => { download(pendingExport.blob, pendingExport.name); setPendingExport(undefined) }}>Exportar com avisos</button><button onClick={() => setPendingExport(undefined)}>Voltar para corrigir</button>{pendingExport.source!==project&&<p>O projeto mudou. Exporte novamente para revisar a versão atual.</p>}</div>}
    {showCredits && <section className="image-workspace" aria-label="Créditos do projeto">
      <h3>Créditos do projeto</h3>
      {credits ? <><label>Texto de atribuição<textarea readOnly rows={8} value={credits} /></label>
        <div className="image-actions"><button onClick={() => void copyCredits()}>Copiar créditos</button><button onClick={() => exportCredits()}>Exportar créditos</button></div>
        {creditStatus && <p role="status">{creditStatus}</p>}</> : <p>Este projeto ainda não tem imagens com créditos registrados.</p>}
    </section>}
    {panel === 'Imagens' && imagePanel?.slideId === project.slides[current].id && (imagePanel.tab === 'search'
      ? <ImageSearch key={imagePanel.request} initialTerm={imagePanel.term} insert={insertImage} />
      : <ImageLibrary key={imagePanel.request} flush={flush} insert={insertImage} />)}
    {selectedTitle && <button type="button" className="button button-outline" aria-expanded={headlineTarget === selectedTitle} onClick={() => setHeadlineTarget(headlineTarget === selectedTitle ? undefined : selectedTitle)}>Melhorar título</button>}
    {selectedTitle && headlineTarget === selectedTitle && <div className="studio-headlines"><HeadlinePanel title={selectedTitle.text} stored={selectedTitle.headlines}
      context={{ ...(campaign ? campaignHeadlineContext(campaign) : { sources: [] }), format: formatNames[project.format], selectedSlide: current + 1, slides: project.slides.map(slide => semantics(slide.scene)) }}
      measure={text => measureTitle(selectedTitle, text, dimensions[project.format])}
      save={(headlines, text) => {
        if (canvas.current?.getActiveObject() !== selectedTitle) return
        if (text !== undefined) {
          selectedTitle.set({ text })
          selectedTitle.initDimensions()
          selectedTitle.setCoords()
          canvas.current.requestRenderAll()
        }
        selectedTitle.set({ headlines })
        snapshotCanvas(text !== undefined)
      }} /></div>}
    {auditOpen&&<AuditPanel project={project} currentSlide={current} onFocus={focusFinding} onChange={async (value, expected)=>{await flush();if(getCurrent()!==expected)throw Error('O projeto mudou. Rode novamente a auditoria.');setPendingExport(undefined);setProject(value);setRevision(n=>n+1);await flush()}} onUndo={() => moveHistory(false)}/>}
    {error && <p role="alert">{error}</p>}
    {!readyCanvas && !error && <p className="studio-loading" role="status">Carregando o slide…</p>}
    <div className="studio-layout" ref={canvasStage}><aside className="studio-tools"><nav aria-label="Ferramentas do Studio">{['Templates', 'Texto', 'Imagens', 'Elementos', 'Minha marca', 'Camadas'].map(name => <button key={name} aria-pressed={panel === name} onClick={() => setPanel(name)}>{name}</button>)}</nav>
      {panel === 'Templates' && <><h3>Templates originais</h3>{Object.entries(templates).map(([key, name]) => <button key={key} onClick={() => template(key as Template)}>{name}</button>)}</>}
      {panel === 'Minha marca' && <BrandPanel brand={project.brand} update={brand => setProject({ ...project, brand })} error={setError} apply={() => { if (window.confirm('Aplicar marca e recompor os templates de todos os slides?')) replace({ ...project, slides: project.slides.map(s => ({ ...s, scene: compose(s.layout in templates ? s.layout as Template : 'text', semantics(s.scene), project.brand, project.format, s.role) })) }) }} />}
      {panel === 'Texto' && <><h3>Tipografia</h3><button disabled={!readyCanvas} onClick={() => { if (canvas.current) { addObject(canvas.current, 'title'); changed() } }}>Adicionar título</button><button disabled={!readyCanvas} onClick={() => { if (canvas.current) { addObject(canvas.current, 'text'); changed() } }}>Adicionar texto</button></>}
      {panel === 'Elementos' && <><h3>Formas</h3>{([['rect', 'Retângulo'], ['circle', 'Círculo'], ['line', 'Linha']] as const).map(([type, name]) => <button key={type} disabled={!readyCanvas} onClick={() => { if (canvas.current) { addObject(canvas.current, type); changed() } }}>{name}</button>)}</>}
      {panel === 'Imagens' && <><h3>Imagens</h3><div className="image-tabs" role="group" aria-label="Origem da imagem">
        <button aria-pressed={imagePanel?.tab === 'search' && imagePanel.slideId === project.slides[current].id} onClick={() => openImages('search')}>Pesquisar imagens</button>
        <button onClick={() => openImages('search', true)}>Buscar imagem para este slide</button>
        <button aria-pressed={imagePanel?.tab === 'library' && imagePanel.slideId === project.slides[current].id} onClick={() => openImages('library')}>Imagens utilizadas</button>
        {imagePanel && <button onClick={() => setImagePanel(undefined)}>Fechar painel de imagens</button>}
      </div><h4>Upload local</h4><label>Adicionar ou substituir imagem<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!readyCanvas} onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} /></label><p>PNG, JPEG ou WebP. Até 20 MB e 40 MP. Selecione uma imagem para substituí-la.</p></>}
      {panel === 'Camadas' && <><h3>Camadas</h3>{readyCanvas?.getObjects().map((o, i) => <button key={i} aria-pressed={selectedObject === o} onClick={() => { canvas.current?.setActiveObject(o); canvas.current?.requestRenderAll(); refresh(n => n + 1) }}>{i + 1} · {o instanceof Textbox ? o.text.slice(0, 32) || ({ title: 'Título', body: 'Corpo', cta: 'Chamada para ação', brand: 'Marca' }[o.semantic ?? ''] ?? 'Texto vazio') : o.type}</button>).reverse()}</>}
    </aside><CanvasView key={`${project.id}:${project.slides[current].id}:${revision}`} brand={project.brand} format={project.format} initial={project.slides[current].scene} zoom={zoom} guides={guides} onReady={value => { canvas.current = value; setReadyCanvas(value);if(value&&focusPath.current){selectPath(focusPath.current);focusPath.current=null} }} onChange={changed} onSelection={() => refresh(n => n + 1)} onError={setError} /><Properties brand={project.brand} canvas={readyCanvas} changed={changed} /></div>
    <Slides project={project} current={current} select={chooseSlide} action={slideAction} />
    {project.campaignId && <p>Design vinculado à campanha. Alterações editoriais posteriores não substituem este design: gere uma nova versão pela campanha.</p>}
    <p className="muted">Ctrl+Z desfaz · Ctrl+Shift+Z refaz · Ctrl+D duplica · Delete exclui · Salvamento local automático. Faça backups: limpar dados do navegador remove projetos.</p>
  </section>
}
