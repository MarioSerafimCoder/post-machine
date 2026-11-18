import { useEffect, useRef, useState } from 'react'
import type { Page } from '../../lib/navigation'
import { explainRule } from './knowledge'
import { recordEditorialFeedback, resetEditorialMemory, setAssistantMode, useEditorialMemory } from './feedback'
import { useAssistantSignals, type Signal } from './signals'
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
const signalKey = (item: Signal) => JSON.stringify([item.scope, item.insight.id])

export function RuleDetails({ insight }: { insight: Insight }) {
  const trace = insight.ruleId && explainRule(insight.ruleId)
  return <>
    <p>{insight.detail}</p>
    {insight.alternative && <p><strong>Alternativa.</strong> {insight.alternative}</p>}
    {trace && <div className="editorial-trace">
      <p><strong>{trace.rule.id} · {trace.rule.name}</strong> · Biblioteca {trace.version}</p>
      {trace.evidence.map(item => <p key={item.claim}>{item.claim} {evidenceScope[item.external_validity]}</p>)}
      {trace.sources.length > 0 && <ul>{trace.sources.map(source => <li key={source.id}>
        {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}
        <small>{source.id} · {verificationNames[source.verification]} · {source.verified_at}</small>
      </li>)}</ul>}
      {trace.rule.id === 'PLT-001' && <p>Confira os requisitos no canal antes de publicar. O catálogo informa a data de referência.</p>}
    </div>}
  </>
}

export default function Assistant({ page }: { page: Page | 'not-found' }) {
  const signals = useAssistantSignals(page)
  const memory = useEditorialMemory()
  const candidate = signals.find(item => !memory.history.some(entry => entry.scope === item.scope && entry.id === item.insight.id && entry.outcome === 'dismissed'))
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState<string>()
  const launcher = useRef<HTMLButtonElement>(null)
  const dock = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousScroll = useRef(0)
  const candidateKey = candidate && signalKey(candidate)
  const proactive = memory.mode === 'proactive' && Boolean(candidateKey)
  const showBalloon = proactive && page !== 'studio' && !open && shown === candidateKey
  useEffect(() => {
    if (open || !proactive || !candidateKey || page === 'studio' || seen.has(candidateKey)) return
    const timer = window.setTimeout(() => {
      seen.add(candidateKey)
      if (seen.size > 80) seen.delete(seen.values().next().value!)
      lastBalloonAt = Date.now()
      setShown(candidateKey)
    }, Math.max(850, 12_000 - (Date.now() - lastBalloonAt)))
    return () => window.clearTimeout(timer)
  }, [candidateKey, open, page, proactive])
  useEffect(() => {
    if (!open) return
    heading.current?.focus()
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !dock.current?.contains(event.target)) {
        setShown(undefined)
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  function close() {
    if (candidateKey) seen.add(candidateKey)
    setShown(undefined)
    setOpen(false)
    if (page === 'studio' && open) window.scrollTo({ top: previousScroll.current, behavior: 'instant' })
    launcher.current?.focus({ preventScroll: true })
  }
  function dismiss(item: Signal) {
    recordEditorialFeedback({ scope: item.scope, id: item.insight.id, ruleId: item.insight.ruleId, preference: item.preference, outcome: 'dismissed' })
    close()
  }
  const current = candidate ?? signals[0]
  const items = current ? [current, ...signals.filter(item => item !== current)].slice(0, 4) : []
  return <aside ref={dock} className="editorial-dock" data-in-flow={page === 'studio' && open || undefined} aria-label="Assistente Editorial" onKeyDown={event => {
    if (event.key === 'Escape' && (open || showBalloon)) { event.stopPropagation(); close() }
  }}>
    {open && <section className="editorial-popover" id="editorial-assistant-panel" aria-labelledby="editorial-assistant-heading">
      <header><h2 id="editorial-assistant-heading" ref={heading} tabIndex={-1}>Assistente Editorial</h2>
        <button onClick={close}>Fechar</button></header>
      {items.length === 0 && <p>Abra uma pauta, uma análise de título ou uma revisão para receber orientações.</p>}
      {items.map((item, index) => <article key={signalKey(item)} className="editorial-insight">
        <h3>{item.insight.title}</h3>
        <small>{assessments[item.insight.assessment]}</small>
        <details open={index === 0 || undefined}><summary>Explicação e referências</summary><RuleDetails insight={item.insight} /></details>
        <div className="editorial-buttons">
          {item.insight.actions?.map(action => <button key={action.label} onClick={() => { setOpen(false); setShown(undefined); action.run() }}>{action.label}</button>)}
          <button onClick={() => dismiss(item)}>Dispensar insight</button>
        </div>
      </article>)}
      <label>Notificações<select value={memory.mode} onChange={event => setAssistantMode(event.target.value as typeof memory.mode)}>
        <option value="proactive">Proativas</option><option value="manual">Somente ao abrir</option><option value="muted">Silenciadas</option>
      </select></label>
      <details><summary>Histórico e preferências</summary>
        {memory.history.length ? <ul>{memory.history.slice(-6).reverse().map(entry => <li key={JSON.stringify([entry.scope, entry.id])}>
          {explainRule(entry.ruleId ?? '')?.rule.name ?? 'Insight contextual'} · {entry.outcome === 'accepted' ? 'Aceito' : 'Dispensado'} · {new Date(entry.at).toLocaleDateString('pt-BR')}
        </li>)}</ul> : <p>Sem decisões registradas neste navegador.</p>}
        <button disabled={!memory.history.length} onClick={() => { if (window.confirm('Limpar o histórico e as preferências editoriais deste navegador?')) resetEditorialMemory() }}>Redefinir memória editorial</button>
      </details>
    </section>}
    {showBalloon && candidate && <section className="editorial-popover editorial-balloon" aria-label="Insight editorial">
      <p role="status">{candidate.insight.title}</p>
      <div className="editorial-buttons">
        <button onClick={() => setOpen(true)}>Ver detalhes</button>
        <button onClick={() => dismiss(candidate)}>Dispensar</button>
        <button onClick={() => { setAssistantMode('muted'); close() }}>Silenciar</button>
      </div>
    </section>}
    <button className="editorial-launcher" ref={launcher} aria-label="Assistente Editorial" aria-expanded={open}
      aria-controls={open ? 'editorial-assistant-panel' : undefined} onClick={() => {
        if (open) close()
        else { previousScroll.current = window.scrollY; setOpen(true) }
      }}>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet="/assistant/avatar.png" />
        <img src="/assistant/avatar.gif" alt="" width="420" height="415" decoding="async" />
      </picture>
      {memory.mode !== 'muted' && candidate && <span className="editorial-indicator" aria-hidden="true" />}
    </button>
  </aside>
}
