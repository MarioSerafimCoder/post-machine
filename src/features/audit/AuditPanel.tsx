import { useEffect, useRef, useState } from 'react'
import type { Project } from '../studio/model'
import { download } from '../studio/export'
import { auditProject } from './engine'
import { defaultSettings, type AuditReport, type Category, type Finding, type Severity } from './contract'
import { prepareSafeMove } from './fix'
import './audit.css'

type Props = { project: Project; currentSlide?: number; onFocus: (finding: Finding) => void; onChange: (project: Project) => void | Promise<void>; onUndo?: () => void }
export function AuditPanel({project,currentSlide,onFocus,onChange,onUndo}: Props) {
  const [report,setReport] = useState<AuditReport>()
  const [source,setSource] = useState<Project>()
  const [busy,setBusy] = useState(false)
  const [progress,setProgress] = useState('')
  const [error,setError] = useState('')
  const [severity,setSeverity] = useState<Severity|'all'>('all')
  const [category,setCategory] = useState<Category|'all'>('all')
  const [slide,setSlide] = useState('all')
  const [situation,setSituation] = useState('all')
  const [reviewed,setReviewed] = useState<Set<string>>(new Set())
  const [attempts,setAttempts] = useState<Record<string,number>>({})
  const attemptsRef=useRef<Record<string,number>>({})
  const controller = useRef<AbortController | null>(null)
  const stale = !!report && source !== project
  useEffect(() => () => controller.current?.abort(), [])
  async function run(index?: number, value=project, corrections: string[] = []) {
    controller.current?.abort(); const abort = new AbortController();controller.current=abort
    setBusy(true);setError('');setProgress('Preparando…')
    try {
      const result=await auditProject({project:value,slideIndex:index,signal:abort.signal,progress:(done,total)=>setProgress(`${done} de ${total} slides`)})
      if(abort.signal.aborted)return
      setReport({...result,corrections});setSource(value);setReviewed(new Set());setProgress('')
    } catch (cause) {if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:String(cause))}
    finally {if(controller.current===abort){controller.current=null;setBusy(false)}}
  }
  async function fix(finding: Finding) {
    try {
      if(stale) throw Error('O projeto mudou. Execute uma nova auditoria antes de corrigir.')
      if((attemptsRef.current[finding.id]??0)>=2) throw Error('Limite de duas tentativas atingido. Edite manualmente.')
      attemptsRef.current[finding.id]=(attemptsRef.current[finding.id]??0)+1
      setAttempts({...attemptsRef.current})
      const proposal=await prepareSafeMove(project,finding)
      if(!window.confirm(`${finding.message}\n${proposal.description}\n\nAplicar correção? Você poderá desfazer.`))return
      await onChange(proposal.project)
      await run(undefined,proposal.project,[...(report?.corrections??[]),`${finding.id}: ${proposal.description}`])
    } catch(cause){setError(cause instanceof Error?cause.message:String(cause))}
  }
  const visible=(report?.findings??[]).filter(f=>(severity==='all'||f.severity===severity)&&(category==='all'||f.category===category)&&(slide==='all'||String(f.slideNumber)===slide)&&(situation==='all'||(situation==='reviewed')===reviewed.has(f.id)))
  const count=(level:Severity)=>report?.findings.filter(f=>f.severity===level).length??0
  const settings=project.auditSettings??defaultSettings
  const updateSettings=(next:typeof settings)=>{if(next.minBodySize<1||next.minBodySize>200||next.minLargeSize<1||next.minLargeSize>200||next.contrastNormal<1||next.contrastNormal>21||next.contrastLarge<1||next.contrastLarge>21)return;void Promise.resolve().then(()=>onChange({...project,auditSettings:next,updatedAt:new Date().toISOString()})).catch(cause=>setError(String(cause)))}
  const toggle=(key:'requireBrand'|'requireLogo'|'enforcePalette')=>updateSettings({...settings,[key]:!settings[key]})
  return <section className="audit-panel" aria-label="Auditoria de design">
    <div className="audit-actions"><button className="button button-dark" disabled={busy} onClick={()=>void run()}>Auditar todos os slides</button>{currentSlide!==undefined&&<button className="button button-outline" disabled={busy} onClick={()=>void run(currentSlide)}>Auditar slide atual</button>}{busy&&<><span role="status">{progress}</span><button onClick={()=>controller.current?.abort()}>Cancelar</button></>}</div>
    <details className="audit-settings"><summary>Regras da marca e limites</summary><label><input type="checkbox" checked={settings.requireBrand} onChange={()=>toggle('requireBrand')}/> Exigir identificação de marca</label><label><input type="checkbox" checked={settings.requireLogo} onChange={()=>toggle('requireLogo')}/> Exigir logotipo</label><label><input type="checkbox" checked={settings.enforcePalette} onChange={()=>toggle('enforcePalette')}/> Conferir paleta</label><label>Texto mínimo (px) <input type="number" min="1" max="200" value={settings.minBodySize} onChange={e=>updateSettings({...settings,minBodySize:Number(e.target.value)})}/></label><label>Título mínimo (px) <input type="number" min="1" max="200" value={settings.minLargeSize} onChange={e=>updateSettings({...settings,minLargeSize:Number(e.target.value)})}/></label><label>Contraste texto comum <input type="number" min="1" max="21" step="0.1" value={settings.contrastNormal} onChange={e=>updateSettings({...settings,contrastNormal:Number(e.target.value)})}/></label><label>Contraste texto grande <input type="number" min="1" max="21" step="0.1" value={settings.contrastLarge} onChange={e=>updateSettings({...settings,contrastLarge:Number(e.target.value)})}/></label></details>
    {error&&<p role="alert" className="audit-error">{error}</p>}
    {stale&&<p role="status" className="audit-stale">O projeto mudou desde a última análise. Execute novamente antes de corrigir ou exportar o relatório.</p>}
    {report&&<><div className="audit-summary" aria-label="Resumo da auditoria"><strong>{count('error')} erros</strong><strong>{count('warning')} avisos</strong><strong>{count('info')} observações</strong><span>{report.totalSlides} slides avaliados</span><span>{report.unverifiable.length} verificações inconclusivas</span><span>Última análise: {new Date(report.analyzedAt).toLocaleString('pt-BR')}</span></div>
      <div className="audit-actions"><button disabled={stale} onClick={()=>download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),`auditoria-${project.id}.json`)}>Baixar relatório JSON</button>{onUndo&&report.corrections.length>0&&<button onClick={onUndo}>Desfazer última alteração</button>}</div>
      <div className="audit-filters"><label>Gravidade<select value={severity} onChange={e=>setSeverity(e.target.value as typeof severity)}><option value="all">Todas</option><option value="error">Erros</option><option value="warning">Avisos</option><option value="info">Observações</option></select></label><label>Categoria<select value={category} onChange={e=>setCategory(e.target.value as typeof category)}><option value="all">Todas</option>{(['geometry','typography','image','contrast','branding','consistency'] as const).map(c=><option key={c} value={c}>{c}</option>)}</select></label><label>Slide<select value={slide} onChange={e=>setSlide(e.target.value)}><option value="all">Todos</option>{project.slides.map((s,i)=><option key={s.id} value={i+1}>{i+1}</option>)}</select></label><label>Situação<select value={situation} onChange={e=>setSituation(e.target.value)}><option value="all">Todas</option><option value="open">Abertas</option><option value="reviewed">Revisadas</option></select></label></div>
      <div className="audit-findings">{visible.length===0?<p>Nenhuma ocorrência neste filtro.</p>:visible.map(f=><article key={f.id} className={`audit-finding ${f.severity}`}><div><span className="badge">Slide {f.slideNumber} · {f.severity==='error'?'Erro':f.severity==='warning'?'Atenção':'Informação'}</span><span className="muted">{f.category} · {f.confidence==='measured'?'medido':f.confidence==='estimated'?'estimado':'revisão visual'}</span></div><h3>{f.message}</h3><p>{f.details}</p><p><strong>Como resolver:</strong> {f.suggestion}</p><div className="audit-actions"><button onClick={()=>onFocus(f)}>Localizar no Studio</button><button aria-pressed={reviewed.has(f.id)} onClick={()=>setReviewed(value=>{const next=new Set(value);if(next.has(f.id))next.delete(f.id);else next.add(f.id);return next})}>{reviewed.has(f.id)?'Revisada':'Marcar como revisada'}</button>{f.autoFixAvailable&&<button disabled={stale||busy||(attempts[f.id]??0)>=2} onClick={()=>void fix(f)}>{(attempts[f.id]??0)>=2?'Edite manualmente':'Propor correção'}</button>}</div></article>)}</div>
    </>}
  </section>
}
