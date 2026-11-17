import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { AuditReport, Finding } from '../audit/contract'
import { projectCredits } from '../images/credits'
import { download, exportProject } from './export'
import { auditProject } from '../audit/engine'
import { sameReviewVersion, type Review } from '../audit/review'
import { dimensions, formatNames, type Project } from './model'

type Props = {
  project: Project; current: number; active: boolean
  getCurrent: () => Project | undefined
  flush: () => Promise<void>; review?: Review; onReport: (report: AuditReport, project: Project) => void
  caption: string; changeCaption: (value: string) => void
  locate: (finding: Finding) => void
  close: () => void
}

export function ExportPanel({ project, current, active, getCurrent, flush, review, onReport, caption, changeCaption, locate, close }: Props) {
  const controller = useRef<AbortController | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [includeCaption, setIncludeCaption] = useState(false)
  const [pending, setPending] = useState<Awaited<ReturnType<typeof exportProject>>>()
  const credits = useMemo(() => projectCredits(project), [project])
  const stale = !!pending && pending.source !== project
  const findings = pending?.findings.filter(finding => finding.severity !== 'info') ?? []
  const showing = [...findings].sort((a,b) => Number(b.severity === 'error') - Number(a.severity === 'error')).slice(0,8)
  const validReview = review && sameReviewVersion(review.project,project) ? review.report : undefined
  const reviewSummary = validReview?.findings.reduce((counts, finding) => {
    if (finding.severity === 'error') counts.errors++
    if (finding.severity === 'warning') counts.warnings++
    return counts
  }, { errors:0, warnings:0 })

  useEffect(() => () => {
    const operation = controller.current
    controller.current = null
    operation?.abort()
  }, [])
  useEffect(() => { if (!active) controller.current?.abort() }, [active])

  async function prepare(all?: boolean) {
    if (controller.current) return
    const operation = new AbortController()
    controller.current = operation
    setPending(undefined)
    setStatus('')
    setError('')
    setProgress('Salvando alterações…')
    try {
      try { await flush() } catch { throw Error('Não foi possível salvar o projeto. Tente salvar novamente ou faça um backup.') }
      operation.signal.throwIfAborted()
      const source = getCurrent()
      if (!source || source.id !== project.id) return
      let report = review && sameReviewVersion(review.project,source) ? review.report : undefined
      if (!report) {
        setProgress('Revisando o carrossel…')
        report = await auditProject({ project: source, signal: operation.signal,
          progress: (done,total) => { if (!operation.signal.aborted) setProgress('Revisando slides · ' + done + ' de ' + total) } })
        operation.signal.throwIfAborted()
        const latest = getCurrent()
        if (!latest || !sameReviewVersion(latest,source)) throw Error('O projeto mudou durante a revisão. Reanalise a versão atual.')
        onReport(report,source)
      }
      if (all === undefined) return
      const covered = report.findings.filter(finding => all || finding.slideId === source.slides[current]?.id)
      const blocked = covered.find(finding => ['IMAGE_MISSING','IMAGE_CORRUPT'].includes(finding.ruleId) && finding.severity === 'error' && finding.confidence === 'measured')
      if (blocked) throw Error('Slide ' + blocked.slideNumber + ' · ' + blocked.message + '. Substitua a imagem antes de exportar.')
      const withCaption = includeCaption && source.caption === undefined ? { ...source, caption } : source
      const result = await exportProject(withCaption, all ? undefined : current, {
        signal: operation.signal, progress: setProgress, includeCaption, reviewedFindings: covered,
      })
      operation.signal.throwIfAborted()
      if (getCurrent() !== source) throw Error('O projeto mudou. Gere a exportação novamente para incluir as últimas alterações.')
      if (result.warnings.length) setPending({ ...result, source })
      else {
        download(result.blob, result.name)
        setStatus('Arquivo enviado para download.')
      }
    } catch (cause) {
      if (controller.current !== operation) return
      if (operation.signal.aborted) setStatus(all === undefined ? 'Revisão cancelada.' : 'Exportação cancelada.')
      else setError(cause instanceof Error ? cause.message : 'Não foi possível exportar.')
    } finally {
      if (controller.current === operation) {
        controller.current = null
        setProgress('')
      }
    }
  }

  const reviewOnOpen = useEffectEvent(() => { if (active) void prepare() })
  useEffect(() => {
    const task = window.setTimeout(reviewOnOpen,0)
    return () => window.clearTimeout(task)
  }, [])

  function confirmExport() {
    if (!pending || getCurrent() !== pending.source) return
    download(pending.blob, pending.name)
    setPending(undefined)
    setStatus('Arquivo enviado para download.')
  }

  async function copy(value: string, kind: 'Legenda' | 'Créditos') {
    try {
      await navigator.clipboard.writeText(value)
      setStatus(kind === 'Legenda' ? 'Legenda copiada.' : 'Créditos copiados.')
    } catch { setStatus('Não foi possível copiar. Selecione o texto e use Ctrl+C.') }
  }
  const creditFile = (value: string) => download(new Blob([value], { type:'text/plain;charset=utf-8' }), 'creditos.txt')

  return <section className="studio-export" id="studio-export" aria-label="Central de exportação">
    <header><div><h3>Finalizar projeto</h3><p className="muted">{formatNames[project.format]} · {dimensions[project.format].join(' × ')} px por arte</p></div>
      <button onClick={close}>Fechar exportação</button></header>
    <div className="studio-export-review">
      <p>{reviewSummary ? <><strong>Revisão atual</strong> · {reviewSummary.errors} erros · {reviewSummary.warnings} avisos</> :
        review ? 'A revisão está desatualizada.' : 'Revisão do carrossel pendente.'}</p>
      {!validReview && !progress && <button onClick={() => void prepare()}>Revisar carrossel</button>}
      {validReview?.findings.some(finding => finding.severity !== 'info') && <details>
        <summary>Ocorrências do carrossel</summary><ul>{validReview.findings.filter(finding => finding.severity !== 'info').map(finding =>
          <li key={finding.id}><button onClick={() => { locate(finding); close() }}>Slide {finding.slideNumber} · {finding.message}</button></li>)}</ul>
      </details>}
    </div>
    <div className="studio-actions">
      <button className="export-primary" disabled={!!progress} onClick={() => void prepare(false)}>Exportar PNG</button>
      <button disabled={!!progress} onClick={() => void prepare(true)}>Exportar ZIP</button>
      <span className="muted">PNG do slide {current + 1} · ZIP com {project.slides.length} {project.slides.length === 1 ? 'slide' : 'slides'}</span>
    </div>
    {progress && <div className="studio-actions"><p role="status">{progress}</p>
      <button onClick={() => { controller.current?.abort(); setProgress('Cancelando operação…') }}>Cancelar operação</button></div>}
    {status && <p role="status">{status}</p>}
    {error && <p role="alert" className="audit-error">{error}</p>}
    {pending && <div className="export-warnings">
      <div role="alert"><h4>Revise antes de exportar</h4>
        <p>{findings.length} {findings.length === 1 ? 'ocorrência nesta exportação' : 'ocorrências nesta exportação'}.</p>
        {stale ? <p>O projeto mudou. Gere outra exportação para revisar a versão atual.</p> :
          <ul>{showing.map(finding => <li key={finding.id}>Slide {finding.slideNumber} · {finding.message}</li>)}</ul>}
      </div>
      {!stale && <details><summary>Localizar ocorrências</summary><ul>{findings.map(finding =>
        <li key={finding.id}><button onClick={() => { locate(finding); close() }}>Slide {finding.slideNumber} · {finding.message}</button></li>)}</ul></details>}
      <div className="studio-actions">
        <button disabled={stale} onClick={confirmExport}>Exportar com avisos</button>
        {pending.credits && pending.name.endsWith('.png') && <button onClick={() => creditFile(pending.credits)}>Exportar créditos desta arte</button>}
        <button onClick={close}>Voltar para corrigir</button>
      </div>
    </div>}
    <div className="studio-export-copy">
      <div><label>Legenda<textarea rows={3} maxLength={8000} value={caption} onChange={event => changeCaption(event.target.value)}
        placeholder="Escreva uma legenda para este projeto" /></label>
        <div className="studio-actions"><button disabled={!caption.trim()} onClick={() => void copy(caption,'Legenda')}>Copiar legenda</button>
        <button disabled={!caption.trim()} onClick={() => download(new Blob([caption], { type:'text/plain;charset=utf-8' }), 'legenda.txt')}>Baixar legenda</button></div></div>
      <details><summary>Créditos das imagens</summary>{credits ? <>
        <label>Texto de atribuição<textarea readOnly rows={4} value={credits} /></label>
        <div className="studio-actions">
          <button onClick={() => void copy(credits,'Créditos')}>Copiar créditos</button>
          <button onClick={() => creditFile(credits)}>Exportar créditos</button>
        </div>
        <p className="muted">O ZIP inclui um arquivo único com os créditos. Para PNG, baixe o texto de atribuição separadamente.</p>
      </> : <p className="muted">Nenhuma imagem deste projeto tem créditos registrados.</p>}</details>
    </div>
    <details><summary>Configurações adicionais</summary>
      <label className="studio-export-check"><input type="checkbox" checked={includeCaption} disabled={!!progress || !caption.trim()}
        onChange={event => setIncludeCaption(event.target.checked)} /> Incluir legenda como TXT no ZIP</label>
      <p className="muted">As imagens usam a resolução original e são numeradas na ordem dos slides.</p>
    </details>
  </section>
}
