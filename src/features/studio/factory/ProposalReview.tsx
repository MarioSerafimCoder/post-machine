import { useEffect, useState } from 'react'
import { compositionNames } from '../collections'
import { renderScene } from '../export'
import { dimensions, type Project, type Scene } from '../model'
import { divideBody, type Treatment } from './planning'
import type { Fabrication, Proposal } from './fabricate'
import { requiresReview } from './evaluate'
import './review.css'

const labels: Record<Treatment,[string,string]> = {
  balanced:['Equilibrada','Distribuição editorial e leitura confortável.'],
  photo:['Fotográfica','Mais espaço para as imagens disponíveis.'],
  expressive:['Expressiva','Título em escala maior e acentos mais marcados.'],
}
const fields: Record<string,string> = { title:'Título', body:'Texto', subtitle:'Subtítulo', cta:'Chamada', brand:'Marca' }
const blobCache = new WeakMap<Scene,Map<number,Blob>>()
let previewQueue: Promise<unknown> = Promise.resolve()

function Preview({ project, index, scale, label }: { project: Project; index: number; scale: number; label: string }) {
  const [src,setSrc] = useState('')
  const [error,setError] = useState('')
  const scene = project.slides[index].scene
  const format = project.format
  useEffect(() => {
    const abort = new AbortController()
    let url = ''
    const [width,height] = dimensions[format]
    const task = previewQueue.then(async () => {
      abort.signal.throwIfAborted()
      const cached = blobCache.get(scene)?.get(scale)
      if (cached) return cached
      const { blob } = await renderScene(scene,width,height,{scale,signal:abort.signal})
      if (!abort.signal.aborted) {
        const variants = blobCache.get(scene) ?? new Map<number,Blob>()
        variants.set(scale,blob)
        blobCache.set(scene,variants)
      }
      return blob
    })
    previewQueue = task.catch(() => undefined)
    void task.then(blob => {
      if (!abort.signal.aborted) { url=URL.createObjectURL(blob); setSrc(url) }
    }, cause => {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
    })
    return () => { abort.abort(); if (url) URL.revokeObjectURL(url) }
  },[format,scale,scene])
  return src ? <img alt={label} src={src} /> :
    <p role={error ? 'alert' : undefined} className="muted">{error || 'Renderizando prévia…'}</p>
}

export function ProposalReview({ result, selected, slideIndex, show, open, replace, edit, divide, canDivide, busy }: {
  result: Fabrication; selected: number; slideIndex: number; busy: boolean
  show: (version: number,slide?: number) => void; open: (proposal: Proposal) => void
  replace: (composition: number) => void;
  edit: (step: 'Conteúdo' | 'Imagens') => void; divide: () => void; canDivide: boolean
}) {
  const proposal = result.proposals[selected]
  const slide = result.slides[slideIndex]
  const details = proposal.details[slideIndex]
  return <section className="factory-review" aria-label="Propostas de fabricação">
    <div className="factory-options">{result.proposals.map((version,index) => {
      const [name,description] = labels[version.treatment]
      const isTypographic = version.treatment === 'photo' && !result.slides.some(item => item.picture)
      const affected = version.details.filter(detail => detail.issues.some(requiresReview)).length
      return <article key={version.treatment} data-active={index === selected}>
        <div className="factory-thumb"><Preview key={version.details[0].composition}
          project={version.project} index={0} scale={.18} label={`Capa ${name}`} /></div>
        <div className="factory-card-copy"><h3>{name}</h3><p>{isTypographic ? 'Alternativa tipográfica sem imagens.' : description}</p>
          <small>{version.project.slides.length} {version.project.slides.length === 1 ? 'slide' : 'slides'} · {affected ? `${affected} para revisar` : 'Sem avisos de encaixe ou recorte'}</small>
          <button className="button button-outline" aria-pressed={index === selected} disabled={busy}
            aria-label={`Visualizar ${name}`} onClick={() => show(index)}>Visualizar</button>
        </div>
      </article>
    })}</div>
    <section className="factory-detail" id="express-proposal-preview" tabIndex={-1} aria-label={`Prévia ${labels[proposal.treatment][0]}`}>
      <header><div><h3>{labels[proposal.treatment][0]} · {result.collection}</h3>
        <p className="muted">Slide {slideIndex+1} de {result.slides.length}</p></div>
        <button className="button button-dark" disabled={busy} onClick={() => open(proposal)}>Usar esta versão</button></header>
      <div className="factory-body">
        <div className="express-preview"><Preview key={`${selected}:${slideIndex}:${details.composition}`} project={proposal.project}
          index={slideIndex} scale={.40} label={`Prévia do slide ${slideIndex+1}`} /></div>
        <div className="factory-notes">
          <nav className="collection-actions" aria-label="Slides da proposta">{result.slides.map((item,index) =>
            <button key={index} className="button button-outline" aria-label={`Prévia do slide ${index+1}`} aria-pressed={index === slideIndex}
              title={item.content.title} onClick={() => show(selected,index)}>
              {String(index+1).padStart(2,'0')}{proposal.details[index].issues.some(requiresReview) && ' •'}
            </button>)}</nav>
          <label>Composição do slide<select value={details.composition} disabled={busy} onChange={event => replace(Number(event.target.value))}>
            {compositionNames.map((name,index) => <option key={name} value={index}>{name}</option>)}
          </select></label>
          <strong>{slide.content.title || 'Sem título'}</strong>
          {slide.content.subtitle && <p>{slide.content.subtitle}</p>}
          <p className="factory-copy">{slide.content.body || 'Sem corpo de texto'}</p>
          {slide.content.cta && <p>Chamada: {slide.content.cta}</p>}
          <small>{slide.picture ? `${slide.picture.name}${slide.picture.origin === 'automatic' ? ' · pela ordem dos arquivos' : ''}` : 'Área de imagem editável'}</small>
          {!!details.issues.length && <ul className="express-warnings">{details.issues.map((issue,index) =>
            <li key={index}>{issue.field && `${fields[issue.field] ?? issue.field}: `}{issue.message}</li>)}</ul>}
          <div className="collection-actions">
            <button className="button button-outline" disabled={busy} onClick={() => edit('Conteúdo')}>Ajustar texto</button>
            <button className="button button-outline" disabled={busy} onClick={() => edit('Imagens')}>Ajustar imagem</button>
            {canDivide && details.issues.some(issue => issue.kind === 'text' && issue.field === 'body') &&
              !!divideBody(slide.content.body) && <button className="button button-outline" disabled={busy} onClick={divide}>Dividir texto em dois slides</button>}
          </div>
        </div>
      </div>
    </section>
  </section>
}
