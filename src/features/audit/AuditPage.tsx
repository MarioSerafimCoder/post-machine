import { useEffect, useRef, useState } from 'react'
import { listProjects, loadProject, saveProject } from '../studio/storage'
import type { Project } from '../studio/model'
import { AuditPanel } from './AuditPanel'
import type { Finding } from './contract'

export function AuditPage() {
  const [library,setLibrary]=useState<Project[]>([])
  const [project,setProject]=useState<Project>()
  const [error,setError]=useState('')
  const previous=useRef<Project | undefined>(undefined)
  useEffect(()=>{void listProjects().then(setLibrary,()=>setError('Não foi possível carregar os projetos locais.'))},[])
  async function select(id:string){try{setProject(await loadProject(id));setError('')}catch(cause){setError(String(cause))}}
  async function change(value:Project){if(project)previous.current=project;await saveProject(value);setProject(value)}
  async function undo(){if(!previous.current)return;const value=previous.current;previous.current=undefined;await saveProject(value);setProject(value)}
  function focus(finding:Finding){if(!project)return;sessionStorage.setItem('direto:audit-focus',JSON.stringify({projectId:project.id,slideId:finding.slideId,objectId:finding.objectId}));window.location.hash='/studio'}
  return <section className="audit-page"><p className="page-description">Verifique problemas técnicos e revise cada arte antes de exportar.</p><label>Projeto<select aria-label="Projeto para auditar" value={project?.id??''} onChange={e=>void select(e.target.value)}><option value="">Selecione um projeto</option>{library.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{error&&<p role="alert">{error}</p>}{project?<AuditPanel key={project.id} project={project} onFocus={focus} onChange={change} onUndo={()=>void undo()}/>:<p>Selecione um projeto salvo neste navegador ou crie um no Studio.</p>}</section>
}
