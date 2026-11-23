import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Page } from '../../lib/navigation'
import { explainRule } from './knowledge'
import { recordEditorialFeedback, useEditorialMemory } from './feedback'
import { AssistantPreferences } from './AssistantPreferences'
import { signalIdentity, signalVersion, useAssistantSignals, useStudioAnchor, visibleSignals, type Signal } from './signals'
import { assessments, type Insight } from './types'
import './assistant.css'

const verificationNames = {
  reference_recovered_from_pdf: 'Recuperada do relatório',
  official_snippet_only: 'Trecho oficial recuperado',
  official_page_checked: 'Página oficial conferida na data indicada',
}
const evidenceScope: Record<string, string> = {
  context_specific: 'Resultado dependente do contexto estudado.',
  online_news_headlines: 'Aplicabilidade restrita às manchetes de notícias online estudadas.',
  education_not_identical_to_social_feed: 'Evidência educacional. A aplicação a feeds exige avaliação própria.',
}
const seen = new Set<string>()
let lastBalloonAt = 0
function scheduleBalloon(key: string, show: (key: string) => void) {
  const showWhenIdle = () => {
    seen.add(key)
    if (seen.size > 80) seen.delete(seen.values().next().value!)
    lastBalloonAt = Date.now()
    show(key)
  }
  let timer: number
  const schedule = (idle: number) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(showWhenIdle, Math.max(idle, 12_000 - (Date.now() - lastBalloonAt)))
  }
  const deferEditing = () => schedule(2_000)
  schedule(1_200)
  document.addEventListener('input', deferEditing)
  return () => {
    window.clearTimeout(timer)
    document.removeEventListener('input', deferEditing)
  }
}

export function RuleDetails({ insight }: { insight: Insight }) {
  const trace = insight.ruleId && explainRule(insight.ruleId)
  return <>
    <p>{insight.detail}</p>
    {insight.alternative && <p><strong>Alternativa.</strong> {insight.alternative}</p>}
    {trace && <details className="editorial-trace"><summary>Referências da orientação</summary>
      <p><strong>{trace.rule.id} · {trace.rule.name}</strong> · Biblioteca {trace.version}</p>
      {trace.evidence.map(item => <p key={item.claim}>{item.claim} {evidenceScope[item.external_validity]}</p>)}
      {trace.sources.length > 0 && <ul>{trace.sources.map(source => <li key={source.id}>
        {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}
        <small>{source.id} · {verificationNames[source.verification]} · {source.verified_at}</small>
      </li>)}</ul>}
      {trace.rule.id === 'PLT-001' && <p>Confira os requisitos no canal antes de publicar. O catálogo informa a data de referência.</p>}
    </details>}
  </>
}

export default function Assistant({ page }: { page: Page | 'not-found' }) {
  const signals = useAssistantSignals()
  const anchor = useStudioAnchor()
  const workspace = page === 'studio' ? anchor : null
  const memory = useEditorialMemory()
  const items = visibleSignals(signals, page, memory.history).slice(0, 4)
  const candidate = items.find(item => item.insight.actions?.length)
  const [previousPage, setPreviousPage] = useState(page)
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState<string>()
  const launcher = useRef<HTMLButtonElement>(null)
  const dock = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  if (previousPage !== page) {
    setPreviousPage(page)
    setOpen(false)
    setShown(undefined)
  }
  const candidateKey = candidate && signalVersion(candidate)
  const proactive = memory.mode === 'proactive' && Boolean(candidateKey)
  const showBalloon = proactive && !open && shown === candidateKey
  useEffect(() => {
    if (open || !proactive || !candidateKey || seen.has(candidateKey)) return
    return scheduleBalloon(candidateKey, setShown)
  }, [candidateKey, open, page, proactive])
  useEffect(() => {
    if (!open) return
    heading.current?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !dock.current?.contains(event.target)) {
        setShown(undefined)
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, workspace])

  function hideBalloon() {
    setShown(undefined)
  }
  function close() {
    hideBalloon()
    setOpen(false)
    launcher.current?.focus({ preventScroll: true })
  }
  function dismiss(item: Signal) {
    recordEditorialFeedback({ scope: item.scope, id: item.insight.id, version: signalVersion(item), ruleId: item.insight.ruleId, preference: item.preference, outcome: 'dismissed' })
    close()
  }
  const assistant = <aside ref={dock} className="editorial-dock" data-workspace={workspace ? 'studio' : undefined} aria-label="Assistente Editorial" onKeyDown={event => {
    if (event.key === 'Escape' && (open || showBalloon)) { event.stopPropagation(); close() }
  }}>
    {open && <section className="editorial-popover" id="editorial-assistant-panel" aria-labelledby="editorial-assistant-heading">
      <header><h2 id="editorial-assistant-heading" ref={heading} tabIndex={-1}>Assistente Editorial</h2>
        <button onClick={close}>Fechar</button></header>
      {items.length === 0 && <p>Abra uma pauta, uma análise de título ou uma revisão para receber orientações.</p>}
      {items.slice(0, 1).map(item => <article key={signalIdentity(item)} className="editorial-insight">
        <h3>{item.insight.title}</h3>
        {item.insight.assessment !== 'insufficient_data' && <small>{assessments[item.insight.assessment]}</small>}
        <RuleDetails insight={item.insight} />
        <div className="editorial-buttons">
          {item.insight.actions?.map((action, index) => <button className={index === 0 ? 'editorial-main-action' : undefined} key={action.label} onClick={() => { setOpen(false); setShown(undefined); action.run() }}>{action.label}</button>)}
          <button onClick={() => dismiss(item)}>Dispensar insight</button>
        </div>
      </article>)}
      {items.length > 1 && <details><summary>Outras recomendações</summary>
        {items.slice(1).map(item => <article key={signalIdentity(item)} className="editorial-insight">
          <h3>{item.insight.title}</h3>
          {item.insight.assessment !== 'insufficient_data' && <small>{assessments[item.insight.assessment]}</small>}
          <RuleDetails insight={item.insight} />
          <div className="editorial-buttons">{item.insight.actions?.map(action => <button key={action.label} onClick={() => { setOpen(false); setShown(undefined); action.run() }}>{action.label}</button>)}
            <button onClick={() => dismiss(item)}>Dispensar insight</button></div>
        </article>)}
      </details>}
      <AssistantPreferences />
    </section>}
    {showBalloon && candidate && <section className="editorial-balloon" aria-label="Insight editorial">
      <button aria-label={`Ocultar mensagem: ${candidate.insight.title}`} onClick={() => { hideBalloon(); launcher.current?.focus({ preventScroll: true }) }}>
        <span role="status">{candidate.insight.title}</span>
      </button>
    </section>}
    <button className="editorial-launcher" ref={launcher} aria-label="Assistente Editorial" aria-expanded={open}
      aria-controls={open ? 'editorial-assistant-panel' : undefined} onClick={() => {
        if (open) close()
        else { hideBalloon(); setOpen(true) }
      }}>
      <img src="/assistant/avatar.png" alt="" width="420" height="415" decoding="async" />
    </button>
  </aside>
  return workspace ? createPortal(assistant, workspace) : assistant
}
