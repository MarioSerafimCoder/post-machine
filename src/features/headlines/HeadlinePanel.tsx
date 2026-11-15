import { useState } from 'react'
import { analyzeHeadline, characterCount } from './analysis'
import { approaches, approachNames, importSuggestions, newSession, type HeadlineContext, type HeadlineSession, type Suggestion } from './contract'
import { buildHeadlinePrompt, ruleSuggestions } from './suggest'
import './headlines.css'

const providers = { ChatGPT: 'https://chatgpt.com/', Claude: 'https://claude.ai/', Gemini: 'https://gemini.google.com/' }
export type HeadlineFit = { width: number; height: number; fits: boolean; detail: string }

type Props = {
  title: string
  context: HeadlineContext
  stored?: HeadlineSession
  save: (session: HeadlineSession, text?: string) => void
  measure?: (text: string) => HeadlineFit
}

export function HeadlinePanel({ title, context, stored, save, measure }: Props) {
  const session = stored ?? newSession(title)
  const [raw, setRaw] = useState('')
  const [manual, setManual] = useState<string>()
  const [showPrompt, setShowPrompt] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const diagnosis = analyzeHeadline(title, session, context)
  const fit = measure?.(title)
  const update = (changes: Partial<HeadlineSession>) => save({ ...session, ...changes })

  function showSuggestions(suggestions: Suggestion[]) {
    const previous = session.suggestions.filter(item => session.favorites.includes(item.id))
    const combined = new Map(previous.map(item => [item.id, item]))
    for (const item of suggestions) {
      const match = [...combined.values()].find(existing => existing.text === item.text)
      if (match) continue
      const id = combined.has(item.id) ? crypto.randomUUID() : item.id
      combined.set(id, { ...item, id })
    }
    const selected = [...combined.values()].slice(0, 21)
    update({ suggestions: selected, favorites: session.favorites.filter(id => selected.some(item => item.id === id)) })
  }

  function fromRules() {
    const suggestions = ruleSuggestions(title, context, session)
    setError('')
    setMessage(suggestions.length ? 'Propostas geradas com base no seu texto.' : 'Inclua um fato, recorte ou trecho do conteúdo nas instruções, ou escolha outra abordagem.')
    if (suggestions.length) showSuggestions(suggestions)
  }

  function importResponse() {
    try {
      showSuggestions(importSuggestions(raw))
      setRaw('')
      setError('')
      setMessage('Sugestões importadas. Revise as afirmações antes de aplicar.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Texto copiado.')
    } catch { setMessage('Selecione o texto e copie pelo teclado.') }
  }

  function apply(text: string, suggestionId?: string) {
    if (!text.trim() || text.length > 500 || text === title) return
    const result = measure?.(text)
    save({ ...session, applications: [...session.applications.slice(-19), { at: new Date().toISOString(), previous: title, applied: text, suggestionId }] }, text)
    setManual(undefined)
    setMessage(result && !result.fits ? `Título aplicado. ${result.detail}` : 'Título aplicado.')
  }

  return <section className="headline-panel" aria-label="Agente de Headlines">
    <header>
      <h4>Agente de Headlines</h4>
      <p><strong>Título atual</strong> {title || 'Sem título'}</p>
      {session.original !== title && <p className="muted">Original {session.original || 'sem título'}</p>}
    </header>
    <div className="headline-diagnosis">
      <p><strong>Medido</strong> · {diagnosis.characters} caracteres · {diagnosis.words} palavras</p>
      {fit && <p>{fit.width} × {fit.height} px na arte · {fit.detail}</p>}
      {diagnosis.measured.map(item => <p key={item}>{item}</p>)}
      {diagnosis.heuristic.length > 0 && <ul aria-label="Sugestões de revisão">{diagnosis.heuristic.map(item => <li key={item}>{item}</li>)}</ul>}
      <p className="muted">Criatividade, impacto e confirmação dos fatos dependem da sua revisão editorial.</p>
    </div>
    <fieldset className="headline-modes"><legend>Abordagens</legend>
      {approaches.map(approach => <label key={approach}><input type="checkbox" checked={session.approaches.includes(approach)} onChange={event => {
        const selected = event.target.checked ? [...session.approaches, approach] : session.approaches.filter(item => item !== approach)
        if (selected.length) update({ approaches: selected })
      }} /> {approachNames[approach]}</label>)}
    </fieldset>
    <div className="headline-limits">
      <label>Máximo de caracteres<input type="number" min={0} max={500} value={session.maxChars} onChange={event => update({ maxChars: Math.max(0, Math.min(500, Math.trunc(Number(event.target.value)))) })} /></label>
      <label>Máximo de palavras<input type="number" min={0} max={100} value={session.maxWords} onChange={event => update({ maxWords: Math.max(0, Math.min(100, Math.trunc(Number(event.target.value)))) })} /></label>
      <small>Use 0 para desativar um limite.</small>
    </div>
    <label>Instruções para a headline<textarea rows={3} maxLength={3000} value={session.notes} onChange={event => update({ notes: event.target.value })} placeholder="Inclua o fato ou recorte que quer destacar." /></label>
    <div className="headline-actions">
      <button type="button" className="button button-dark" onClick={fromRules}>Gerar propostas por regras</button>
      <button type="button" className="button button-outline" aria-expanded={showPrompt} onClick={() => setShowPrompt(value => !value)}>Gerar sugestões com IA</button>
      <button type="button" className="button button-outline" onClick={() => setManual(title)}>Editar headline manualmente</button>
    </div>
    {manual !== undefined && <div className="headline-diagnosis">
      <label>Editar alternativa<textarea rows={2} maxLength={500} value={manual} onChange={event => setManual(event.target.value)} /></label>
      <button type="button" disabled={!manual.trim() || manual === title || manual.length > 500} onClick={() => apply(manual)}>Aplicar edição</button>
      <button type="button" onClick={() => setManual(undefined)}>Cancelar edição</button>
    </div>}
    {showPrompt && <div className="headline-diagnosis">
      <p>Revise e copie o prompt. Cole na ferramenta de sua escolha e importe o JSON que ela gerar.</p>
      <label>Prompt de headlines<textarea readOnly rows={6} value={buildHeadlinePrompt(title, context, session)} /></label>
      <div className="headline-actions">
        <button type="button" onClick={() => void copy(buildHeadlinePrompt(title, context, session))}>Copiar prompt de headlines</button>
        {Object.entries(providers).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer">Abrir {name}</a>)}
      </div>
    </div>}
    <details open={showPrompt || undefined}><summary>Importar sugestões em JSON</summary>
      <label>Resposta de headlines<textarea rows={4} maxLength={50_000} value={raw} onChange={event => setRaw(event.target.value)} /></label>
      <button type="button" disabled={!raw.trim()} onClick={importResponse}>Importar sugestões</button>
    </details>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {!!session.suggestions.length && <div className="headline-cards" aria-label="Comparação de headlines">
      {[...session.suggestions].sort((a, b) => Number(session.favorites.includes(b.id)) - Number(session.favorites.includes(a.id))).map(item => {
        const proposed = measure?.(item.text)
        return <article className="headline-card" key={item.id}>
          <span className="badge">{approachNames[item.approach]} · {item.source === 'rules' ? 'Por regras' : 'IA externa'}</span>
          <strong>{item.text}</strong>
          <small>{characterCount(item.text)} caracteres{proposed && ` · ${proposed.detail}`}</small>
          <p>{item.rationale}</p>
          <div className="headline-actions">
            <button type="button" disabled={item.text === title} onClick={() => apply(item.text, item.id)}>Aplicar</button>
            <button type="button" onClick={() => void copy(item.text)}>Copiar</button>
            <button type="button" aria-pressed={session.favorites.includes(item.id)} onClick={() => update({
              favorites: session.favorites.includes(item.id) ? session.favorites.filter(id => id !== item.id) : [...session.favorites, item.id],
            })}>Favorita</button>
          </div>
        </article>
      })}
    </div>}
    {!!session.applications.length && <details><summary>Histórico de títulos</summary><ul>{session.applications.map((item, index) => <li key={index}>{item.applied}</li>)}</ul></details>}
  </section>
}
