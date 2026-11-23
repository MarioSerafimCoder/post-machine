import { useEffect, useState } from 'react'
import { auditProject } from '../audit/engine'
import type { AuditReport } from '../audit/contract'
import { adaptLayout } from './adaptLayout'
import { copyTemplateDesign, type AuthorTemplate, type TemplateSummary } from './authorTemplate'
import { ScenePreview } from './factory/ProposalReview'
import { dimensions, formatNames, type Format, type Project } from './model'
import { loadAuthorTemplate } from './storage'
import { StudioDialog } from './StudioDialog'

type Comparison = Awaited<ReturnType<typeof adaptLayout>> & { report: AuditReport; variant?: AuthorTemplate }

export function AdaptLayoutDialog({ source, firstSlide = 0, variants, close, confirm, confirmLabel = 'Salvar cópia e editar no Studio' }: {
  source: Project; firstSlide?: number; variants?: TemplateSummary[]; close: () => void; confirmLabel?: string
  confirm: (project: Project, variant?: AuthorTemplate) => Promise<void>
}) {
  const [format, setFormat] = useState<Format>(source.format === 'square' ? 'portrait' : 'square')
  const [index, setIndex] = useState(firstSlide)
  const [comparison, setComparison] = useState<Comparison>()
  const [progress, setProgress] = useState({ stage: 'Adaptando', done: 0, total: source.slides.length })
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const alternate = variants?.find(item => item.format === format)?.id
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function compare() {
      const variant = alternate ? await loadAuthorTemplate(alternate) : undefined
      const result = variant ? { project: copyTemplateDesign(variant), conservative: [] }
        : await adaptLayout(source, format, signal, done => setProgress({ stage: 'Adaptando', done, total: source.slides.length }))
      signal.throwIfAborted()
      setProgress({ stage: 'Auditando', done: 0, total: result.project.slides.length })
      const report = await auditProject({ project: result.project, signal,
        progress: (done, total) => { if (!signal.aborted) setProgress({ stage: 'Auditando', done, total }) },
      })
      if (!signal.aborted) setComparison({ ...result, report, variant })
    }
    void compare().catch(cause => {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
    })
    return () => controller.abort()
  }, [source, format, alternate])
  const current = comparison?.report.findings.filter(finding => finding.slideNumber === index + 1)
  return <StudioDialog title="Adaptar formato" close={() => { if (!saving) close() }}>
    <div className="adaptation-controls">
      <label>Formato de destino<select value={format} disabled={saving} onChange={event => {
        const destination = event.target.value as Format
        if (destination === format) return
        setComparison(undefined); setError(''); setSaveError('')
        setProgress({ stage: 'Adaptando', done: 0, total: source.slides.length })
        setFormat(destination)
      }}>
        {Object.entries(formatNames).filter(([value]) => value !== source.format).map(([value, name]) =>
          <option key={value} value={value}>{name} · {dimensions[value as Format].join(' × ')}</option>)}
      </select></label>
      {source.slides.length > 1 && <label>Slide para comparar<select value={index} onChange={event => setIndex(Number(event.target.value))}>
        {source.slides.map((slide, position) => <option key={slide.id} value={position}>Slide {position + 1}</option>)}
      </select></label>}
    </div>
    {error && <p className="express-warning" role="alert">{error}</p>}
    {!comparison && !error && <div className="adaptation-controls">
      <progress aria-label="Progresso da adaptação" value={progress.done} max={progress.total} />
      <p role="status">{progress.stage} {progress.done} de {progress.total} slides…</p>
    </div>}
    <div className="adaptation-comparison">
      <figure><figcaption>Original · {formatNames[source.format]}</figcaption>
        <ScenePreview key={index} project={source} index={index} scale={.28} label={`Original, slide ${index + 1}`} />
      </figure>
      <figure><figcaption>{comparison?.variant ? 'Variante autoral' : 'Adaptado'} · {formatNames[format]}</figcaption>
        {comparison && <ScenePreview key={`${comparison.project.id}:${index}`} project={comparison.project} index={index}
          scale={.28} label={`Adaptado, slide ${index + 1}`} />}
      </figure>
    </div>
    {comparison && <section className="adaptation-findings" aria-label="Auditoria da adaptação">
      <h3>Auditoria da adaptação</h3>
      <p>{comparison.report.findings.length} ocorrência(s) em {comparison.report.totalSlides} slide(s). {comparison.variant
        ? 'A biblioteca já contém uma variante da mesma família.'
        : 'Ajustes manuais ficam disponíveis na cópia do Studio.'}</p>
      {comparison.conservative.includes(index + 1) && <p>Camadas sem função identificada foram reposicionadas pela geometria. Revise o alinhamento e as sobreposições.</p>}
      {!!current?.length && <ul className="express-warnings">{current.map(finding => (
        <li key={finding.id}><strong>{finding.message}</strong> · {finding.suggestion}</li>
      ))}</ul>}
    </section>}
    {saveError && <p role="alert">{saveError}</p>}
    <button className="button button-dark" disabled={!comparison || saving} onClick={() => {
      if (!comparison || saving) return
      setSaving(true); setSaveError('')
      void confirm(comparison.project, comparison.variant).catch(cause => {
        setSaveError(cause instanceof Error ? cause.message : String(cause))
      }).finally(() => setSaving(false))
    }}>{saving ? 'Salvando…' : comparison?.variant ? 'Usar variante existente' : confirmLabel}</button>
  </StudioDialog>
}
