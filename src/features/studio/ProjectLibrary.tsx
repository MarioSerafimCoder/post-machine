import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { CampaignStart, type CampaignStartMode } from '../campaigns/CampaignStart'
import { normalize } from '../radar/contract'
import { DamagedProjects } from './DamagedProjects'
import { download, renderScene } from './export'
import { loadFonts } from './fonts'
import { newProjectIdentity, dimensions, formatNames, type Format } from './model'
import { backupProject, listProjects, loadProject, removeProject, restoreProject, saveLibraryProject, type ProjectSummary } from './storage'
import { StorageSettings } from './StorageSettings'
import './projectLibrary.css'

const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })
const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })
const previews = new Map<string, Blob>()
let previewQueue = Promise.resolve()

function ProjectPreview({ item }: { item: ProjectSummary }) {
  const target = useRef<HTMLSpanElement>(null)
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    const node = target.current
    if (!node) return
    const controller = new AbortController()
    let url: string | undefined
    const key = item.id + ':' + item.revision
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      previewQueue = previewQueue.then(async () => {
        controller.signal.throwIfAborted()
        let blob = previews.get(key)
        if (!blob) {
          const project = await loadProject(item.id)
          controller.signal.throwIfAborted()
          const first = project.slides[0]
          if (!first?.scene.objects.length) return
          await loadFonts(project.brand)
          const [width, height] = dimensions[project.format]
          blob = (await renderScene(first.scene, width, height, { scale: 320 / Math.max(width, height), signal: controller.signal })).blob
          if (previews.size >= 48) previews.delete(previews.keys().next().value!)
          previews.set(key, blob)
        }
        controller.signal.throwIfAborted()
        url = URL.createObjectURL(blob)
        setSrc(url)
      }).catch(() => undefined)
    }, { rootMargin: '120px' })
    observer.observe(node)
    return () => { controller.abort(); observer.disconnect(); if (url) URL.revokeObjectURL(url) }
  }, [item.id, item.revision])
  return <span ref={target} className="library-preview" aria-hidden="true">
    {src ? <img src={src} alt="" /> : <span className="library-placeholder" data-format={item.format}><Icon name="studio" /></span>}
  </span>
}

type Library = Awaited<ReturnType<typeof listProjects>>
type Props = {
  result?: Library; refresh: () => Promise<void>; error: string; flush: () => Promise<void>;
  open: (id: string) => Promise<void>; imported: (project: Awaited<ReturnType<typeof restoreProject>>) => void;
  create: () => void; express: () => void; templates: () => void; campaign: (mode: CampaignStartMode) => void;
  format: Format; setFormat: (format: Format) => void;
}

export function ProjectLibrary({ result, refresh, error, flush, open, imported, create, express, templates, campaign, format, setFormat }: Props) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [failure, setFailure] = useState('')
  const [rename, setRename] = useState<{ id: string; name: string }>()
  const createMenu = useRef<HTMLDetailsElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLElement>(null)
  const renameInput = useRef<HTMLInputElement>(null)
  const renameId = rename?.id
  useEffect(() => {
    if (renameId) { renameInput.current?.focus(); renameInput.current?.select() }
  }, [renameId])
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      library.current?.querySelectorAll<HTMLDetailsElement>('.library-menu[open]').forEach(menu => {
        if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false
      })
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])
  const hasCreationDates = result?.projects.some(item => item.createdAt)
  const projects = (result?.projects ?? []).filter(item => normalize(item.name).includes(normalize(query.trim())))
    .sort((a, b) => {
      if (sort === 'name') return collator.compare(a.name, b.name)
      if (sort === 'created') return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  async function run(task: () => Promise<void>, success = '', message = 'Não foi possível concluir a ação.') {
    setBusy(true); setNotice(''); setFailure('')
    try { await task(); setNotice(success) }
    catch (cause) { setFailure(cause instanceof Error ? cause.message : message) }
    finally { setBusy(false) }
  }
  function action(item: ProjectSummary, kind: 'rename' | 'copy' | 'backup' | 'delete', name?: string) {
    if (kind === 'delete' && !window.confirm('Excluir este projeto local?')) return
    void run(async () => {
      if (kind === 'delete') {
        if (!await removeProject(item)) { await refresh(); throw Error('O projeto mudou em outra aba. Confira a versão atual antes de excluir.') }
      } else {
        const current = await loadProject(item.id)
        if (kind === 'backup') {
          download(await backupProject(current), 'post-machine-projeto.zip')
          return
        }
        const project = { ...current, updatedAt: new Date().toISOString() }
        if (kind === 'rename' && name) await saveLibraryProject({ ...project, name }, current)
        if (kind === 'copy') await saveLibraryProject({ ...project, ...newProjectIdentity(), name: current.name.slice(0, 92) + ' (cópia)' })
      }
      setRename(undefined)
      await refresh()
    }, { rename: 'Projeto renomeado.', copy: 'Cópia criada.', backup: 'Backup ZIP enviado para download.', delete: 'Projeto excluído.' }[kind])
  }
  return <section ref={library} className="studio-library" aria-label="Biblioteca do Studio" onKeyDown={event => {
    if (event.key !== 'Escape' || !(event.target instanceof HTMLElement)) return
    const menu = event.target.closest<HTMLDetailsElement>('.library-menu[open]')
    if (menu) { menu.open = false; menu.querySelector('summary')?.focus() }
  }}>
    <header className="library-header">
      <div><h1 tabIndex={-1}>Studio</h1><p>Crie, organize e edite seus conteúdos.</p></div>
      <details ref={createMenu} className="library-menu library-create">
        <summary className="button">＋ Novo projeto</summary>
        <div className="library-popover">
          <button disabled={busy} onClick={express}>Produção Expressa</button>
          <button disabled={busy} onClick={templates}>Usar template</button>
          <button disabled={busy} onClick={create}>Criar projeto vazio</button>
          <label>Formato do projeto<select value={format} onChange={e => setFormat(e.target.value as Format)}>
            {Object.entries(formatNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select></label>
          <button disabled={busy} onClick={() => input.current?.click()}>Importar projeto ZIP</button>
          <CampaignStart choose={campaign} />
        </div>
      </details>
      <input ref={input} aria-label="Restaurar projeto ZIP" type="file" accept=".zip" hidden onChange={e => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) void run(async () => { imported(await restoreProject(file)) }, '', 'Não foi possível importar o ZIP.')
      }} />
    </header>
    <div className="library-tools">
      <h2>Projetos</h2>{result && <span className="library-count">{query.trim() ? `${projects.length} de ${result.projects.length}` : projects.length}</span>}
      <div className="library-controls">
        <input type="search" aria-label="Buscar projetos" placeholder="Buscar projetos" value={query} onChange={event => setQuery(event.target.value)} />
        <select aria-label="Ordenar projetos" value={!hasCreationDates && sort === 'created' ? 'recent' : sort} onChange={event => setSort(event.target.value)}>
          <option value="recent">Edição recente</option><option value="name">Nome A–Z</option>
          {hasCreationDates && <option value="created">Criação recente</option>}
        </select>
        <div className="library-view" role="group" aria-label="Visualização dos projetos">
          <button aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grade</button>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>Lista</button>
        </div>
      </div>
    </div>
    {(error || failure) && <p role="alert" className="library-feedback">{failure || error}</p>}
    {busy && <p role="status" className="library-feedback">Processando projeto…</p>}
    {notice && <p role="status" className="library-feedback">{notice}</p>}
    {!result && !error && <p role="status" className="library-feedback">Carregando projetos…</p>}
    {result && <DamagedProjects items={result.damaged} />}
    {result && !projects.length && <div className="library-empty">
      <Icon name="folder" />
      <h3>{query.trim() ? 'Nenhum projeto encontrado' : 'Seus projetos aparecem aqui'}</h3>
      <button className="button button-outline" onClick={() => {
        if (query.trim()) setQuery('')
        else { const menu = createMenu.current; if (menu) { menu.open = true; menu.querySelector('summary')?.focus() } }
      }}>{query.trim() ? 'Limpar busca' : 'Criar primeiro projeto'}</button>
    </div>}
    <div className="library-projects" data-view={view}>{projects.map(item => <article className="library-card" key={item.id}>
      <button className="library-open" aria-label={'Abrir ' + item.name} disabled={busy} onClick={() => void run(() => open(item.id))}>
        <ProjectPreview key={item.revision} item={item} />
        <span className="library-card-copy"><strong title={item.name}>{item.name}</strong>
          <span>{item.slideCount} {item.slideCount === 1 ? 'página' : 'páginas'} · {formatNames[item.format]}</span>
          {Number.isFinite(Date.parse(item.updatedAt)) && <time dateTime={item.updatedAt}>{date.format(new Date(item.updatedAt))}</time>}
        </span>
      </button>
      <details className="library-menu library-actions" key={item.revision}>
        <summary aria-label={'Ações de ' + item.name}>•••</summary>
        <div className="library-popover">
          <button disabled={busy} onClick={event => {
            const menu = event.currentTarget.closest('details')
            if (menu) menu.open = false
            setRename({ id: item.id, name: item.name })
          }}>Renomear</button>
          <button disabled={busy} onClick={() => action(item, 'copy')}>Duplicar</button>
          <button disabled={busy} onClick={() => action(item, 'backup')}>Exportar backup ZIP</button>
          <button disabled={busy} className="library-delete" aria-label={'Excluir ' + item.name} onClick={() => action(item, 'delete')}>Excluir</button>
        </div>
      </details>
      {rename?.id === item.id && <form className="library-rename" onSubmit={event => {
        event.preventDefault()
        if (rename.name.trim()) action(item, 'rename', rename.name.trim())
      }}>
        <label>Novo nome<input ref={renameInput} required maxLength={100} value={rename.name} onChange={event => setRename({ id: item.id, name: event.target.value })} /></label>
        <button disabled={busy}>Salvar nome</button><button type="button" onClick={() => setRename(undefined)}>Cancelar</button>
      </form>}
    </article>)}</div>
    <footer className="library-footer"><StorageSettings flush={flush} /></footer>
  </section>
}
