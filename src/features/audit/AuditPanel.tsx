import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Project } from '../studio/model'
import { download } from '../studio/export'
import { auditProject } from './engine'
import { defaultSettings, type AuditReport, type Category, type Finding, type Severity } from './contract'
import { prepareSafeMove } from './fix'
import { sameReviewVersion } from './review'
import { useAuditAssistant } from '../intelligence/auditSignal'
import './audit.css'

const categories: Record<Category,string> = {
  geometry:'Posição e margens', typography:'Tipografia', image:'Imagens',
  contrast:'Contraste', branding:'Marca', consistency:'Consistência',
}

type Props = { view?: 'diagnosis' | 'corrections' | 'results'; project: Project; assistantArea?: 'studio' | 'auditoria'; currentSlide?: number; onFocus: (finding: Finding) => void; onChange: (project: Project, expected: Project, correction?: boolean) => Promise<Project>; onReport?: (report: AuditReport, project: Project, index?: number) => void; onUndo?: () => void | Promise<void> }
export function AuditPanel({project,assistantArea,currentSlide,onFocus,onChange,onUndo,onReport,view='diagnosis'}: Props) {
  const [report,setReport] = useState<AuditReport>()
  const [source,setSource] = useState<Project>()
  const [scope,setScope] = useState<number>()
  const [busy,setBusy] = useState(false)
  const [progress,setProgress] = useState('')
  const [analyzed, setAnalyzed] = useState({ done: 0, total: 1 })
  const [feedback, setFeedback] = useState('')
  const [error,setError] = useState('')
  const [severity,setSeverity] = useState<Severity|'all'>('all')
  const [category,setCategory] = useState<Category|'all'>('all')
  const [slide,setSlide] = useState('all')
  const [situation,setSituation] = useState('all')
  const [reviewed,setReviewed] = useState<Set<string>>(new Set())
  const [attempts,setAttempts] = useState<Record<string,number>>({})
  const attemptsRef=useRef<Record<string,number>>({})
  const controller = useRef<AbortController | null>(null)
  const fixes = useRef<string[]>([])
  const latest = useRef<Project | undefined>(project)
  const [undoSource, setUndoSource] = useState<Project>()
  const [proposing, setProposing] = useState(false)
  const processing = useRef(false)
  const stale = !!source && !sameReviewVersion(source,project)
  const contextual = currentSlide !== undefined
  useLayoutEffect(() => {
    latest.current = project
    return () => { latest.current = undefined }
  }, [project])
  useEffect(() => () => controller.current?.abort(), [])
  async function run(index?: number, value=project, corrections: string[] = fixes.current) {
    controller.current?.abort(); const abort = new AbortController();controller.current=abort
    setBusy(true);setError('');setProgress('Preparando…');setAnalyzed({ done: 0, total: index === undefined ? value.slides.length : 1 })
    try {
      const result=await auditProject({project:value,slideIndex:index,signal:abort.signal,progress:(done,total)=>{
        if (!abort.signal.aborted) { setAnalyzed({ done, total }); setProgress(`${done} de ${total} slides`) }
      }})
      if(abort.signal.aborted)return
      onReport?.(result,value,index)
      setReport({...result,corrections});setSource(value);setScope(index);setReviewed(new Set());setProgress('')
    } catch (cause) {if(!abort.signal.aborted){setProgress('');setError(cause instanceof Error?cause.message:String(cause))}}
    finally {if(controller.current===abort){controller.current=null;setBusy(false)}}
  }
  async function fix(finding: Finding) {
    if (processing.current) return
    processing.current = true
    setProposing(true)
    try {
      if (stale || latest.current !== project) throw Error('O projeto mudou. Execute uma nova auditoria antes de corrigir.')
      if ((attemptsRef.current[finding.id] ?? 0) >= 2) throw Error('Limite de duas tentativas atingido. Edite manualmente.')
      const proposal = await prepareSafeMove(project, finding)
      if (latest.current !== project) throw Error('A proposta ficou desatualizada. Rode novamente a auditoria.')
      if (!window.confirm(`${finding.message}\n${proposal.description}\n\nAplicar correção? Você poderá desfazer.`)) return
      attemptsRef.current[finding.id] = (attemptsRef.current[finding.id] ?? 0) + 1
      setAttempts({ ...attemptsRef.current })
      const applied = await onChange(proposal.project, project, true)
      fixes.current = [...fixes.current, `${finding.id}: ${proposal.description}`]
      setUndoSource(applied)
      setFeedback('Correção aplicada. Você pode desfazer a alteração.')
      await run(scope, applied)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      processing.current = false
      setProposing(false)
    }
  }

  async function undoLast() {
    try {
      await onUndo?.()
      fixes.current = [...fixes.current, 'Última correção desfeita.']
      setUndoSource(undefined)
      setFeedback('Última correção desfeita.')
    } catch (cause) { setError(String(cause)) }
  }
  async function fixBatch(items: Finding[]) {
    if (processing.current || stale || latest.current !== project || !report) return
    processing.current = true
    setProposing(true)
    setError('')
    try {
      const ordered = [...items].sort((a, b) => Number(b.ruleId === 'SAFE_MARGIN') - Number(a.ruleId === 'SAFE_MARGIN'))
      const moved = new Set<string>()
      const changes: { finding: Finding; description: string }[] = []
      let candidate = project
      for (const finding of ordered) {
        const object = `${finding.slideId}:${finding.objectId}`
        if (moved.has(object)) continue
        const plan = await prepareSafeMove(candidate, finding)
        candidate = plan.project
        moved.add(object)
        changes.push({ finding, description: plan.description })
      }
      const checked = await auditProject({ project: candidate, slideIndex: scope })
      const previous = new Set(report.findings.map(item => item.id))
      const remaining = new Set(checked.findings.map(item => item.id))
      if (changes.some(item => remaining.has(item.finding.id)) ||
          checked.findings.some(item => item.category === 'geometry' && !previous.has(item.id))) {
        throw Error('Os movimentos em conjunto criam uma nova ocorrência geométrica. Revise as correções individualmente.')
      }
      if (latest.current !== project) throw Error('O projeto mudou. Execute uma nova auditoria.')
      const preview = changes.map(({ finding, description }) => `Slide ${finding.slideNumber} · ${description}`).join('\n')
      if (!window.confirm(`${preview}\n\nAplicar ${changes.length} ajuste(s) de posição? Você poderá desfazer o lote.`)) return
      const applied = await onChange(candidate, project, true)
      for (const { finding } of changes) attemptsRef.current[finding.id] = (attemptsRef.current[finding.id] ?? 0) + 1
      setAttempts({ ...attemptsRef.current })
      fixes.current = [...fixes.current, ...changes.map(({ finding, description }) => `${finding.id}: ${description}`)]
      setUndoSource(applied)
      setFeedback(`${changes.length} correções aplicadas. Você pode desfazer o lote.`)
      await run(scope, applied)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { processing.current = false; setProposing(false) }
  }
  useAuditAssistant({
    area: busy || proposing ? undefined : assistantArea, project, source, report, current: currentSlide,
    locate: finding => { if (latest.current && source && sameReviewVersion(source, latest.current)) onFocus(finding) },
    fix: finding => void fix(finding),
    canFix: finding => (attempts[finding.id] ?? 0) < 2,
  })
  const visible=(report?.findings??[]).filter(f=>(view !== 'corrections' || f.autoFixAvailable)&&(severity==='all'||f.severity===severity)&&(category==='all'||f.category===category)&&(slide==='all'||String(f.slideNumber)===slide)&&(situation==='all'||(situation==='reviewed')===reviewed.has(f.id)))
  const safeMoves = visible.filter(item => item.autoFixAvailable && (attempts[item.id] ?? 0) < 2)
  const count=(level:Severity)=>report?.findings.filter(f=>f.severity===level).length??0
  const settings=project.auditSettings??defaultSettings
  const updateSettings=(next:typeof settings)=>{if(next.minBodySize<1||next.minBodySize>200||next.minLargeSize<1||next.minLargeSize>200||next.contrastNormal<1||next.contrastNormal>21||next.contrastLarge<1||next.contrastLarge>21)return;void Promise.resolve().then(()=>onChange({...project,auditSettings:next,updatedAt:new Date().toISOString()}, project)).catch(cause=>setError(String(cause)))}
  const toggle=(key:'requireBrand'|'requireLogo'|'enforcePalette')=>updateSettings({...settings,[key]:!settings[key]})
  return <section className={contextual ? "audit-panel audit-context" : "audit-panel"} aria-label="Auditoria de design" tabIndex={-1} id={currentSlide === undefined ? 'audit-Diagnóstico' : undefined}>
    {busy && <progress aria-label="Progresso da auditoria" value={analyzed.done} max={analyzed.total} />}
    {feedback && <p className="audit-feedback" key={feedback} role="status">{feedback}</p>}
    <div className="audit-actions" hidden={view !== 'diagnosis' && !!report}><button className="button button-dark" disabled={busy || proposing} onClick={()=>void run()}>Auditar todos os slides</button>{currentSlide!==undefined&&<button className="button button-outline" disabled={busy || proposing} onClick={()=>void run(currentSlide)}>Auditar slide atual</button>}{progress&&<span role="status">{progress}</span>}{busy&&<button onClick={()=>{controller.current?.abort();setProgress('Auditoria interrompida.')}}>Cancelar</button>}</div>
    <details className="audit-settings" hidden={view !== 'diagnosis'}><summary>Regras da marca e limites</summary><label><input type="checkbox" checked={settings.requireBrand} onChange={()=>toggle('requireBrand')}/> Exigir identificação de marca</label><label><input type="checkbox" checked={settings.requireLogo} onChange={()=>toggle('requireLogo')}/> Exigir logotipo</label><label><input type="checkbox" checked={settings.enforcePalette} onChange={()=>toggle('enforcePalette')}/> Conferir paleta</label><label>Texto mínimo (px) <input type="number" min="1" max="200" value={settings.minBodySize} onChange={e=>updateSettings({...settings,minBodySize:Number(e.target.value)})}/></label><label>Título mínimo (px) <input type="number" min="1" max="200" value={settings.minLargeSize} onChange={e=>updateSettings({...settings,minLargeSize:Number(e.target.value)})}/></label><label>Contraste texto comum <input type="number" min="1" max="21" step="0.1" value={settings.contrastNormal} onChange={e=>updateSettings({...settings,contrastNormal:Number(e.target.value)})}/></label><label>Contraste texto grande <input type="number" min="1" max="21" step="0.1" value={settings.contrastLarge} onChange={e=>updateSettings({...settings,contrastLarge:Number(e.target.value)})}/></label></details>
    {error&&<p role="alert" className="audit-error">{error}</p>}
    {stale && <div className="audit-stale"><p role="status">A análise está desatualizada. Revise a versão atual para localizar ou corrigir ocorrências.</p><button disabled={busy || proposing} onClick={() => void run(scope === undefined ? undefined : currentSlide)}>Reanalisar</button></div>}
    {report&&<><div className="audit-summary" tabIndex={-1} id={currentSlide === undefined ? 'audit-Resultados' : undefined} aria-label="Resumo da auditoria"><strong>{count('error')} erros</strong><strong>{count('warning')} avisos</strong><strong>{count('info')} observações</strong><span>{scope === undefined ? report.totalSlides + ' slides avaliados' : 'Slide ' + String(scope+1).padStart(2,'0')}</span>{!contextual && <><span>{report.unverifiable.length} verificações inconclusivas</span><span>Última análise: {new Date(report.analyzedAt).toLocaleString('pt-BR')}</span></>}</div>
      <div className="audit-actions"><button disabled={stale} onClick={()=>download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),`auditoria-${project.id}.json`)}>Baixar relatório JSON</button>{onUndo&&undoSource===project&&<button disabled={busy || proposing} onClick={()=>void undoLast()}>Desfazer última alteração</button>}</div>
      <details className="audit-advanced" hidden={view === 'results'}><summary>Filtros avançados</summary><div className="audit-filters"><label>Gravidade<select value={severity} onChange={e=>setSeverity(e.target.value as typeof severity)}><option value="all">Todas</option><option value="error">Erros</option><option value="warning">Avisos</option><option value="info">Observações</option></select></label><label>Categoria<select value={category} onChange={e=>setCategory(e.target.value as typeof category)}><option value="all">Todas</option>{(['geometry','typography','image','contrast','branding','consistency'] as const).map(c=><option key={c} value={c}>{categories[c]}</option>)}</select></label><label>Slide<select value={slide} onChange={e=>setSlide(e.target.value)}><option value="all">Todos</option>{project.slides.map((s,i)=><option key={s.id} value={i+1}>{i+1}</option>)}</select></label><label>Situação<select value={situation} onChange={e=>setSituation(e.target.value)}><option value="all">Todas</option><option value="open">Abertas</option><option value="reviewed">Revisadas</option></select></label></div></details>
      {view !== 'results' && new Set(safeMoves.map(item => `${item.slideId}:${item.objectId}`)).size > 1 &&
        <div className="audit-actions"><button disabled={stale || busy || proposing} onClick={() => void fixBatch(safeMoves)}>Prévia de correções de posição em lote</button></div>}
      <div hidden={view === 'results'} className="audit-findings" tabIndex={-1} id={currentSlide === undefined ? 'audit-Correções' : undefined}>{visible.length===0?<p>Nenhuma ocorrência neste filtro.</p>:visible.map(f=><article key={f.id} className={`audit-finding ${f.severity}`}><div><span className="badge">Slide {f.slideNumber} · {f.severity==='error'?'Erro':f.severity==='warning'?'Atenção':'Informação'}</span><span className="muted">{categories[f.category]} · {f.confidence==='measured'?'medido':f.confidence==='estimated'?'estimado':'revisão visual'}</span></div><h3>{f.message}</h3>{contextual ? <details className="audit-finding-detail"><summary>Como resolver</summary><p>{f.details}</p><p>{f.suggestion}</p></details>
        : <><p>{f.details}</p><p><strong>Como resolver:</strong> {f.suggestion}</p></>}<div className="audit-actions"><button disabled={stale} onClick={()=>onFocus(f)}>Localizar no Studio</button><button aria-pressed={reviewed.has(f.id)} onClick={()=>setReviewed(value=>{const next=new Set(value);if(next.has(f.id))next.delete(f.id);else next.add(f.id);return next})}>{reviewed.has(f.id)?'Revisada':'Marcar como revisada'}</button>{f.autoFixAvailable&&<button disabled={stale||busy||proposing||(attempts[f.id]??0)>=2} onClick={()=>void fix(f)}>{(attempts[f.id]??0)>=2?'Edite manualmente':'Propor correção'}</button>}</div></article>)}</div>
    </>}
  </section>
}
