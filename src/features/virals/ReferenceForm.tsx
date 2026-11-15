import { useState } from 'react'
import { formats, type FormatId } from './catalog'
import { analysisFields, contentTypes, referenceSchema, type AnalysisField, type Reference } from './contract'
import { identifyUrl, platforms } from './urls'

export function ReferenceForm({ initial, save, close, busy }: { initial: Reference; save: (value: Reference) => void; close: () => void; busy: boolean }) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const field = (key: keyof Pick<Reference, 'title' | 'url' | 'author' | 'publication' | 'niche' | 'description'>, value: string) => setForm(previous => ({ ...previous, [key]: value }))
  function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      const identity = identifyUrl(form.url)
      const result = referenceSchema.safeParse({ ...form, url: identity.url })
      if (!result.success) throw Error(result.error.issues.map(issue => issue.message).join(' · '))
      setError('')
      save(result.data)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  let platform
  try { platform = platforms[identifyUrl(form.url).platform] } catch { /* The form is still being filled. */ }
  return <form className="viral-card" onSubmit={submit} aria-label="Formulário de referência">
    <h3>{initial.title ? 'Editar referência' : 'Nova referência'}</h3>
    <p className="muted">Cadastro manual{platform && ` · ${platform} identificada pelo link`}</p>
    <div className="viral-fields">
      <label>Título da referência<input required maxLength={180} value={form.title} onChange={event => field('title', event.target.value)} /></label>
      <label>URL original<input required type="text" inputMode="url" maxLength={2048} value={form.url} onChange={event => field('url', event.target.value)} /></label>
      <label>Autor ou canal<input maxLength={180} value={form.author} onChange={event => field('author', event.target.value)} /></label>
      <label>Data de publicação<input type="date" value={form.publication} onChange={event => field('publication', event.target.value)} /></label>
      <label>Formato editorial<select value={form.format} onChange={event => setForm({ ...form, format: event.target.value as FormatId })}>{formats.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Tipo de conteúdo<select value={form.type} onChange={event => setForm({ ...form, type: event.target.value as Reference['type'] })}>{contentTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Nicho<input maxLength={180} value={form.niche} onChange={event => field('niche', event.target.value)} /></label>
      <label>Descrição<textarea rows={2} maxLength={1600} value={form.description} onChange={event => field('description', event.target.value)} /></label>
    </div>
    <fieldset className="viral-fields"><legend>Análise editorial manual</legend>
      {Object.entries(analysisFields).map(([key, label]) => <label key={key}>{label}<textarea rows={2} maxLength={1600} value={form.analysis[key as AnalysisField]} onChange={event => {
        const value = event.target.value
        setForm(previous => ({ ...previous, analysis: { ...previous.analysis, [key]: value } }))
      }} /></label>)}
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className="viral-controls"><button className="button button-dark" disabled={busy}>Salvar referência</button><button type="button" onClick={close}>Cancelar</button></div>
  </form>
}
