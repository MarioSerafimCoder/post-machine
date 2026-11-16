import { useEffect, useRef, useState } from 'react'
import { listProjects, loadProject, saveProject } from '../studio/storage'
import type { Project } from '../studio/model'
import { AuditPanel } from './AuditPanel'
import type { Finding } from './contract'
import { ContextHeader, ContextRail, ContextWorkspace, type ContextTool } from '../../components/ContextRail'

export function AuditPage() {
  const [library, setLibrary] = useState<Project[]>([])
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
    if (!id) return
    try {
      const value = await loadProject(id)
      if (request === generation.current) { active.current = value; setProject(value) }
    } catch (cause) { if (request === generation.current) setError(String(cause)) }
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
    <label>Projeto<select aria-label="Projeto para auditar" value={selection} disabled={busy} onChange={event => void select(event.target.value)}>
      <option value="">Selecione um projeto</option>
      {library.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label></div>}
    {error && <p role="alert">{error}</p>}
    {project ? <div hidden={!panel}><AuditPanel key={project.id} project={project} onFocus={focus} onChange={change} onUndo={undo}
      view={panel === 'Correções' ? 'corrections' : panel === 'Resultados' ? 'results' : 'diagnosis'} /></div>
      : <p>Selecione um projeto salvo neste navegador ou <a className="text-button" href="#/studio">abra o Studio</a>.</p>}
  </section></ContextWorkspace>
}
