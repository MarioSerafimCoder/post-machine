import { useEffect, useRef, useState } from 'react'
import { listProjects, loadProject, saveProject } from '../studio/storage'
import type { Project } from '../studio/model'
import { DamagedProjects } from '../studio/DamagedProjects'
import { AuditPanel } from './AuditPanel'
import type { Finding } from './contract'
import { ContextHeader, ContextRail, ContextWorkspace, type ContextTool } from '../../components/ContextRail'

const projectDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

export function AuditPage() {
  const [libraryResult, setLibrary] = useState<Awaited<ReturnType<typeof listProjects>>>()
  const library = libraryResult?.projects
  const [loadingProject, setLoadingProject] = useState(false)
  const [project, setProject] = useState<Project>()
  const [selection, setSelection] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState<string | null>('Projetos')
  const active = useRef<Project | undefined>(undefined)
  const checkpoint = useRef<{ before: Project; after: Project } | undefined>(undefined)
  const generation = useRef(0)
  const writing = useRef(false)
  useEffect(() => {
    void listProjects().then(setLibrary, () => setError('Não foi possível carregar os projetos locais.'))
  }, [])

  async function select(id: string) {
    if (writing.current) return
    const request = ++generation.current
    checkpoint.current = undefined
    active.current = undefined
    setProject(undefined)
    setSelection(id)
    setError('')
    setLoadingProject(Boolean(id))
    if (!id) return
    try {
      const value = await loadProject(id)
      if (request === generation.current) { active.current = value; setProject(value) }
    } catch { if (request === generation.current) setError('Não foi possível abrir o projeto. Selecione-o novamente ou restaure um backup no Studio.') }
    finally { if (request === generation.current) setLoadingProject(false) }
  }

  async function change(value: Project, expected: Project, correction = false) {
    if (writing.current || active.current !== expected || value.id !== expected.id) throw Error('O projeto selecionado mudou.')
    writing.current = true
    setBusy(true)
    try {
      await saveProject(value, expected)
      checkpoint.current = correction ? { before: expected, after: value } : undefined
      active.current = value
      setProject(value)
      return value
    } finally { writing.current = false; setBusy(false) }
  }

  async function undo() {
    const saved = checkpoint.current
    if (!saved || active.current !== saved.after || saved.before.id !== saved.after.id) throw Error('Não há correção para desfazer neste projeto.')
    await change({ ...saved.before, updatedAt: new Date().toISOString() }, saved.after)
  }

  function focus(finding: Finding) {
    if (!project) return
    sessionStorage.setItem('post-machine:audit-focus', JSON.stringify({ projectId: project.id, slideId: finding.slideId, objectId: finding.objectId }))
    window.location.hash = '/studio'
  }

  const tools: ContextTool[] = [{ label: 'Projetos', icon: 'folder' }]
  if (project) tools.push({ label: 'Diagnóstico', icon: 'audit' }, { label: 'Correções', icon: 'shape' }, { label: 'Resultados', icon: 'layers' })
  return <ContextWorkspace rail={<ContextRail label="Ferramentas da Auditoria" tools={tools} selected={panel}
    choose={value => {
      setPanel(value === panel ? null : value)
      if (value !== panel && value !== 'Projetos') requestAnimationFrame(() =>
        document.getElementById(`audit-${value}`)?.focus())
    }} />}><section className="audit-page">
    {panel === 'Projetos' && <div className="context-panel"><ContextHeader title="Projetos" close={() => setPanel(null)} />
    {!library && !error && <p role="status">Buscando projetos neste navegador…</p>}
    {libraryResult && <DamagedProjects items={libraryResult.damaged} />}
    {library && library.length === 0 && <div className="audit-start">
      <h2>Nenhum projeto para revisar</h2><p>Crie ou restaure um projeto no Studio para revisar sua arte.</p>
      <a className="button button-dark" href="#/studio">Abrir Studio</a>
    </div>}
    {library && library.length > 0 && <>
    {!project && <div className="audit-start"><h2>Projetos recentes</h2><ul className="audit-projects">
      {library.slice(0, 6).map(item => <li key={item.id}>
        <div><strong>{item.name || 'Projeto sem nome'}</strong>
          <p>{item.slideCount} {item.slideCount === 1 ? 'slide' : 'slides'} · <time dateTime={item.updatedAt}>{projectDate.format(new Date(item.updatedAt))}</time></p></div>
        <button className="button button-dark" aria-label={`Revisar projeto: ${item.name || 'Projeto sem nome'}`} disabled={busy || loadingProject}
          onClick={() => void select(item.id)}>Revisar projeto</button>
      </li>)}
    </ul></div>}
    <label>Projeto<select aria-label="Projeto para auditar" value={selection} disabled={busy} onChange={event => void select(event.target.value)}>
      <option value="">Selecione um projeto</option>
      {library.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label></>}</div>}
    {loadingProject && <p role="status">Abrindo projeto para revisão…</p>}
    {error && <p role="alert">{error}</p>}
    {project ? <div hidden={!panel}><AuditPanel key={project.id} project={project} assistantArea={panel ? 'auditoria' : undefined} onFocus={focus} onChange={change} onUndo={undo}
      view={panel === 'Correções' ? 'corrections' : panel === 'Resultados' ? 'results' : 'diagnosis'} /></div>
      : error && <a className="button button-outline" href="#/studio">Abrir Studio</a>}
  </section></ContextWorkspace>
}
