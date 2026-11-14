import { SaveQueue } from '../../lib/saveQueue'
import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { normalize, type Article } from '../radar/contract'
import {
  approaches, backupSchema, createPrompt, defaultPreferences, formats, importContent,
  markdownExample, maxBackup, maxImport, maxSlides, newDraft, objectives, roles, tones,
  type Backup, type Briefing, type Content, type Draft, type Slide,
} from './contract'
import { deleteCampaign, putCampaign, putPreferences, readCampaigns, restoreCampaigns } from './storage'
import './campaigns.css'

const platforms = {
  ChatGPT: 'https://chatgpt.com/',
  Claude: 'https://claude.ai/new',
  Gemini: 'https://gemini.google.com/',
}
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const blankSlide: Slide = { order: 1, role: 'content', title: '', body: '', imageBrief: '', layoutType: 'editorial' }

export function Campaigns({ request, active, onBack }: {
  request: { article: Article | null } | null
  active: boolean
  onBack: () => void
}) {
  const [backup, setBackup] = useState<Backup>()
  const [selected, setSelected] = useState<string>()
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(0)
  const [dirty, setDirty] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [deleteId, setDeleteId] = useState<string>()
  const [restoring, setRestoring] = useState(false)
  const handledRequest = useRef<typeof request>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const draft = backup?.campaigns.find(item => item.id === selected)
  const [queue] = useState(() => new SaveQueue<Draft>(putCampaign, (id, state) => {
    setDirty(current => state === 'saved' ? current.filter(value => value !== id) : current.includes(id) ? current : [...current, id])
    if (state === 'error') setError('Falha ao salvar. Tente novamente com Salvar campanha. Suas alterações continuam nesta tela.')
    if (state === 'saved') setStatus('Salvo neste navegador.')
  }))
  const [creating, setCreating] = useState(false)
  useEffect(() => {
    const flush = () => { void queue.flushAll().catch(() => undefined) }
    const leave = (event: BeforeUnloadEvent) => { if (queue.hasPending) { flush(); event.preventDefault() } }
    window.addEventListener('hashchange', flush)
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('beforeunload', leave)
    return () => { flush(); window.removeEventListener('hashchange', flush); document.removeEventListener('visibilitychange', flush); window.removeEventListener('beforeunload', leave) }
  }, [queue])
  useEffect(() => { if (!active) void queue.flushAll().catch(() => undefined) }, [active, queue])
  async function select(id: string) {
    try { await queue.flushAll(); setSelected(id); setDeleteId(undefined) } catch { /* Keep the unsaved document open. */ }
  }
  async function create() {
    if (!backup) return
    try { await queue.flushAll() } catch { return }
    const item = newDraft(null, backup.preferences)
    persist(item, true)
    setSelected(item.id)
    setCreating(false)
  }

  useEffect(() => {
    let live = true
    void readCampaigns().then(result => { if (live) setBackup(result) }, () => { if (live) setLoadError(true) })
    return () => { live = false }
  }, [])

  const persist = useCallback((value: Draft, explicit = false) => {
    const item = { ...value, updatedAt: new Date().toISOString() }
    setBackup(current => current && { ...current, campaigns: [item, ...current.campaigns.filter(entry => entry.id !== item.id)] })
    setStatus('')
    setError('')
    queue.schedule(item.id, item)
    if (explicit) void queue.flush(item.id).then(() => setStatus('Campanha salva.'), () => undefined)
  }, [queue])

  useEffect(() => {
    if (!request || handledRequest.current === request || (!backup && !loadError)) return
    const timer = window.setTimeout(() => {
      handledRequest.current = request
      const preferences = backup?.preferences ?? defaultPreferences
      const item = newDraft(request.article, preferences)
      if (!backup) setBackup({ schemaVersion: 2, campaigns: [], preferences })
      setSelected(item.id)
      persist(item)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [request, backup, loadError, persist])

  useEffect(() => {
    if (active && selected) heading.current?.focus()
  }, [active, selected])

  async function remove(item: Draft) {
    setSaving(count => count + 1)
    setError('')
    try {
      await queue.flush(item.id)
      await deleteCampaign(item.id)
      setBackup(current => current && { ...current, campaigns: current.campaigns.filter(entry => entry.id !== item.id) })
      setSelected(current => current === item.id ? undefined : current)
      setDeleteId(undefined)
      setDirty(current => current.filter(id => id !== item.id))
      setStatus('Campanha excluída.')
    } catch { setError('Não foi possível excluir a campanha.') }
    finally { setSaving(count => count - 1) }
  }

  async function savePreferences(briefing: Briefing) {
    setError('')
    const preferences = { audience: briefing.audience, tone: briefing.tone }
    try {
      await queue.flushAll()
      await putPreferences(preferences)
      setBackup(current => current && { ...current, preferences })
      setStatus('Preferências salvas para as próximas pautas.')
    } catch { setError('Não foi possível salvar as preferências.') }
  }

  function duplicate(item: Draft) {
    const now = new Date().toISOString()
    const content = item.content && { ...item.content, campaign: {
      ...item.content.campaign, title: `${item.content.campaign.title.slice(0, 492)} (cópia)`,
    } }
    const copy = { ...item, id: crypto.randomUUID(), createdAt: now, content }
    setSelected(copy.id)
    persist(copy, true)
  }

  function exportBackup() {
    if (!backup) return
    setError('')
    const data = JSON.stringify(backup, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    if (blob.size > maxBackup) { setError('O backup excede 50 MB. Reduza o número de campanhas e tente novamente.'); return }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'post-machine-campanhas.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setStatus('')
    setRestoring(true)
    let data: Backup
    try {
      if (file.size > maxBackup) throw Error('O backup excede 50 MB.')
      data = backupSchema.parse(JSON.parse(await file.text()))
    } catch (failure) {
      setError(file.size > maxBackup && failure instanceof Error ? failure.message : 'O arquivo não é um backup válido da Direto.')
      setRestoring(false)
      return
    }
    try {
      await restoreCampaigns(data)
      setBackup(await readCampaigns())
      setLoadError(false)
      setStatus('Backup restaurado. Campanhas com o mesmo ID foram adicionadas como cópias.')
    } catch { setError('Não foi possível concluir a restauração.') }
    finally { setRestoring(false) }
  }

  const title = (item: Draft) => item.content?.campaign.title.trim() || item.title || 'Nova campanha'
  const matches = backup?.campaigns.filter(item => normalize(`${title(item)} ${item.article?.title ?? ''} ${item.article?.source ?? ''}`).includes(normalize(query.trim())))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return <section className="campaigns" aria-label="Pautas e prompts" aria-busy={restoring || undefined}>
    <header className="campaign-header">
      <div><h2 ref={heading} tabIndex={-1}>{draft ? 'Editar campanha' : 'Pautas e campanhas'}</h2>
        <p className="muted">As campanhas ficam neste navegador. Exporte um backup para guardá-las em outro lugar.</p></div>
      <button className="button button-outline" onClick={() => void queue.flushAll().then(onBack, () => undefined)}>Voltar às notícias</button>
    </header>
    {loadError && <p className="info-strip" role="alert">Não foi possível carregar as campanhas locais.</p>}
    {!backup && !loadError && <p role="status">Carregando campanhas.</p>}
    <p className="campaign-status" role="status">{saving || (dirty.length > 0 && !error) ? 'Salvando…' : status}</p>
    {error && <p className="info-strip" role="alert">{error}</p>}
    <fieldset className="campaign-workspace" disabled={restoring}>
      <legend className="sr-only">Campanhas locais</legend>
      <div className="campaign-actions"><button className="button button-dark" disabled={!backup} onClick={() => setCreating(value => !value)}>Nova campanha</button>
      {creating && <><button className="button button-outline" onClick={() => void create()}>Começar do zero</button><button className="button button-outline" onClick={() => void create().then(() => document.getElementById('campaign-import-heading')?.scrollIntoView())}>Importar conteúdo</button><button className="button button-outline" onClick={onBack}>Usar notícia do Radar</button></>}</div>
      <aside className="campaign-library" aria-label="Campanhas salvas">
        <label>Buscar campanhas<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <ul>{matches?.map(item => <li key={item.id}>
          <button className="campaign-library-item" aria-pressed={item.id === selected} onClick={() => void select(item.id)}>
            <strong>{title(item)}</strong><span>{dirty.includes(item.id) ? 'Salvamento pendente' : item.content ? 'Campanha' : 'Pauta'} · {date.format(new Date(item.updatedAt))}</span>
          </button>
        </li>)}</ul>
        {matches?.length === 0 && <p className="muted">{query ? 'Nenhuma campanha encontrada.' : 'Crie uma campanha do zero ou use uma notícia do Radar.'}</p>}
        <div className="campaign-backup">
          <button className="button button-outline" disabled={!backup} onClick={exportBackup}>Exportar backup</button>
          <label className="campaign-file-label">Restaurar backup JSON<input type="file" accept=".json,application/json" disabled={saving > 0 || dirty.length > 0} onChange={event => void restore(event)} /></label>
          <p className="muted">A restauração adiciona campanhas e aplica as preferências do backup.</p>
        </div>
      </aside>
      {draft && <div className="campaign-editor">
        <Editor key={draft.id} draft={draft} update={persist} onPreferences={briefing => void savePreferences(briefing)} />
        <div className="campaign-actions">
          <button className="button button-dark" onClick={() => persist(draft, true)}>Salvar campanha</button>
          <button className="button button-outline" onClick={() => duplicate(draft)}>Duplicar campanha</button>
          <button className="button button-outline" onClick={() => setDeleteId(draft.id)}>Excluir campanha</button>
        </div>
        {deleteId === draft.id && <div className="campaign-actions" role="group" aria-label="Confirmar exclusão">
          <p>Excluir esta campanha deste navegador?</p>
          <button className="button button-dark" disabled={saving > 0} onClick={() => void remove(draft)}>Confirmar exclusão</button>
          <button className="button button-outline" onClick={() => setDeleteId(undefined)}>Cancelar</button>
        </div>}
      </div>}
    </fieldset>
  </section>
}

function Editor({ draft, update, onPreferences }: {
  draft: Draft
  update: (draft: Draft) => void
  onPreferences: (briefing: Briefing) => void
}) {
  const [platform, setPlatform] = useState<keyof typeof platforms>('ChatGPT')
  const [raw, setRaw] = useState('')
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [replacing, setReplacing] = useState(false)
  const { article, briefing } = draft
  const editBriefing = (changes: Partial<Briefing>) => update({ ...draft, briefing: { ...briefing, ...changes } })
  const editContent = (content: Content) => update({ ...draft, content })

  function generate() {
    update({ ...draft, prompt: createPrompt(draft), promptBriefing: briefing })
    setCopyStatus('')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.prompt)
      setCopyStatus('Prompt copiado.')
    } catch { setCopyStatus('Selecione o texto do prompt e copie pelo teclado.') }
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setReplacing(false)
    try {
      if (!/\.(json|md)$/i.test(file.name) || file.size > maxImport * 4) throw Error()
      const value = await file.text()
      if (value.length > maxImport) throw Error()
      setRaw(value)
    } catch { setError('Escolha um arquivo .json ou .md legível com até 250 mil caracteres.') }
  }

  function importResponse() {
    try {
      const content = importContent(raw, draft)
      editContent(content)
      setRaw('')
      setError('')
      setReplacing(false)
      setCopyStatus('')
      window.requestAnimationFrame(() => document.getElementById('campaign-review-heading')?.focus())
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível importar o conteúdo.') }
  }

  return <>
    {article && <section className="campaign-panel" aria-labelledby="campaign-source-heading">
      <h3 id="campaign-source-heading">Notícia de origem</h3>
      <a href={article.url} target="_blank" rel="noreferrer">{article.title}</a>
      <p className="muted">{[article.source, article.category, article.language === 'pt' ? 'Português' : article.language === 'en' ? 'Inglês' : article.language,
        article.publishedAt && date.format(new Date(article.publishedAt))].filter(Boolean).join(' · ')}</p>
      {article.summary && <p>{article.summary}</p>}
    </section>}
    <section className="campaign-panel" aria-labelledby="campaign-briefing-heading">
      <h3 id="campaign-briefing-heading">Briefing editorial</h3>
      <label>Título do briefing<input value={draft.title} maxLength={500} onChange={event => update({ ...draft, title: event.target.value })} /></label>
      <div className="campaign-fields">
        <Select label="Objetivo" value={briefing.objective} options={choices(objectives)} change={objective => editBriefing({ objective })} />
        <label>Público-alvo<input value={briefing.audience} maxLength={500} onChange={event => editBriefing({ audience: event.target.value })} /></label>
        <Select label="Tom de comunicação" value={briefing.tone} options={choices(tones)} change={tone => editBriefing({ tone })} />
        <Select label="Formato" value={briefing.format} options={formats} change={format => editBriefing({ format })} />
        {briefing.format === 'carousel' && <Select label="Quantidade de slides" value={String(briefing.slideCount)}
          options={choices(Array.from({ length: maxSlides - 1 }, (_, index) => String(index + 2)))}
          change={count => editBriefing({ slideCount: Number(count) })} />}
        <Select label="Abordagem editorial" value={briefing.approach} options={choices(approaches)} change={approach => editBriefing({ approach })} />
        <label className="campaign-wide">Orientações adicionais<textarea rows={3} value={briefing.notes} maxLength={8000} onChange={event => editBriefing({ notes: event.target.value })} /></label>
      </div>
      <div className="campaign-actions">
        <button className="button button-dark" onClick={generate}>{draft.promptBriefing ? 'Regenerar prompt para IA' : 'Gerar prompt para IA'}</button>
        <button className="button button-outline" onClick={() => onPreferences(briefing)}>Salvar público e tom como padrão</button>
      </div>
    </section>
    {draft.promptBriefing && <section className="campaign-panel" aria-labelledby="campaign-prompt-heading">
      <h3 id="campaign-prompt-heading">Produzir com IA</h3>
      <p className="muted">Copie o prompt e cole na ferramenta escolhida. A resposta volta pelo importador abaixo.</p>
      {JSON.stringify(draft.promptBriefing) !== JSON.stringify(briefing) && <p className="info-strip">O briefing mudou. Regenerar o prompt substitui o texto atual.</p>}
      <label>Prompt editorial<textarea rows={12} value={draft.prompt} maxLength={maxImport} onChange={event => {
        setCopyStatus('')
        update({ ...draft, prompt: event.target.value })
      }} /></label>
      <div className="campaign-actions campaign-production">
        <button className="button button-dark" disabled={!draft.prompt.trim()} onClick={() => void copy()}>Copiar prompt</button>
        <Select label="Ferramenta de IA" value={platform} options={choices(['ChatGPT', 'Claude', 'Gemini'] as const)} change={setPlatform} />
        <a className="button button-outline" href={platforms[platform]} target="_blank" rel="noreferrer">Abrir {platform} ↗</a>
      </div>
      <p className="campaign-status" role="status">{copyStatus}</p>
    </section>}
    <section className="campaign-panel" aria-labelledby="campaign-import-heading">
      <h3 id="campaign-import-heading">Importar resposta</h3>
      <label>Conteúdo em JSON ou Markdown<textarea rows={6} value={raw} maxLength={maxImport} onChange={event => { setRaw(event.target.value); setReplacing(false) }} /></label>
      <details className="campaign-example"><summary>Ver sintaxe Markdown</summary>
        <p className="muted">Use os nomes dos campos do modelo. Repita a seção Fonte para cada referência e numere os slides a partir de 1. Use carousel, post ou story no formato e cover, content ou cta na função. Datas usam ISO 8601 ou null.</p>
        <pre>{markdownExample}</pre>
      </details>
      <div className="campaign-actions">
        <button className="button button-dark" disabled={!raw.trim()} onClick={() => {
          if (draft.content) setReplacing(true)
          else importResponse()
        }}>Importar conteúdo</button>
        <label className="campaign-file-label">Carregar arquivo<input type="file" accept=".json,.md,application/json,text/markdown" onChange={event => void readFile(event)} /></label>
      </div>
      {replacing && <div className="campaign-actions" role="group" aria-label="Confirmar substituição">
        <p>A nova importação substitui a revisão atual.</p>
        <button className="button button-dark" onClick={importResponse}>Substituir conteúdo</button>
        <button className="button button-outline" onClick={() => setReplacing(false)}>Cancelar</button>
      </div>}
      {error && <p role="alert" className="info-strip">{error}</p>}
    </section>
    {draft.content && <Review content={draft.content} update={editContent} />}
  </>
}

function choices<T extends string>(values: readonly T[]): Record<T, string> {
  const options = {} as Record<T, string>
  for (const value of values) options[value] = value
  return options
}

function Select<T extends string>({ label, value, options, change }: {
  label: string; value: T; options: Record<T, string>; change: (value: T) => void
}) {
  const id = useId()
  return <label htmlFor={id}><span id={id + '-label'}>{label}</span><select id={id} aria-labelledby={id + '-label'} value={value} onChange={event => change(event.target.value as T)}>
    {Object.keys(options).map(key => <option key={key} value={key}>{options[key as T]}</option>)}
  </select></label>
}

function Review({ content, update }: { content: Content; update: (content: Content) => void }) {
  const { campaign, slides } = content
  const setSlides = (items: Slide[]) => update({ ...content, slides: items.map((item, index) => ({ ...item, order: index + 1 })) })
  const move = (index: number, direction: number) => {
    const next = [...slides]
    const [slide] = next.splice(index, 1)
    next.splice(index + direction, 0, slide)
    setSlides(next)
  }
  const slideField = (index: number, changes: Partial<Slide>) => setSlides(slides.map((item, position) => position === index ? { ...item, ...changes } : item))
  const limit = campaign.format === 'carousel' ? maxSlides : 1

  return <section className="campaign-panel" aria-labelledby="campaign-review-heading">
    <h3 id="campaign-review-heading" tabIndex={-1}>Revisão editorial</h3>
    <p className="muted">{formats[campaign.format]} · {slides.length} {slides.length === 1 ? 'peça' : 'peças'}. A criação visual será feita no Studio em uma próxima etapa.</p>
    <div className="campaign-fields">
      {([['title', 'Nome da campanha'], ['objective', 'Objetivo da campanha'], ['audience', 'Público da campanha'], ['tone', 'Tom da campanha']] as const)
        .map(([key, label]) => <label key={key}>{label}<input value={campaign[key]} maxLength={500} onChange={event => update({ ...content, campaign: { ...campaign, [key]: event.target.value } })} /></label>)}
      {([['caption', 'Legenda'], ['cta', 'Chamada para ação']] as const)
        .map(([key, label]) => <label className="campaign-wide" key={key}>{label}<textarea rows={3} value={campaign[key]} maxLength={8000}
          onChange={event => update({ ...content, campaign: { ...campaign, [key]: event.target.value } })} /></label>)}
    </div>
    <h4>Referências</h4>
    <ul className="campaign-sources">{content.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
      {source.publishedAt && <time dateTime={source.publishedAt}> · {date.format(new Date(source.publishedAt))}</time>}</li>)}</ul>
    <ol className="campaign-slides">{slides.map((slide, index) => <li key={slide.order}>
      <fieldset className="campaign-slide">
        <legend>Peça {slide.order} · {roles[slide.role]}</legend>
        <div className="campaign-fields">
          <Select label="Função" value={slide.role} options={roles} change={role => slideField(index, { role })} />
          <label>Layout previsto<input maxLength={500} value={slide.layoutType} onChange={event => slideField(index, { layoutType: event.target.value })} /></label>
          <label className="campaign-wide">Título<input maxLength={500} value={slide.title} onChange={event => slideField(index, { title: event.target.value })} /></label>
          <label className="campaign-wide">Corpo<textarea rows={3} maxLength={8000} value={slide.body} onChange={event => slideField(index, { body: event.target.value })} /></label>
          <label className="campaign-wide">Sugestão de imagem<textarea rows={2} maxLength={8000} value={slide.imageBrief} onChange={event => slideField(index, { imageBrief: event.target.value })} /></label>
        </div>
        <div className="campaign-actions">
          <button className="button button-outline" disabled={index === 0} onClick={() => move(index, -1)}>Mover para cima</button>
          <button className="button button-outline" disabled={index === slides.length - 1} onClick={() => move(index, 1)}>Mover para baixo</button>
          <button className="button button-outline" disabled={slides.length >= limit}
            onClick={() => setSlides([...slides.slice(0, index + 1), slide, ...slides.slice(index + 1)])}>Duplicar peça</button>
          <button className="button button-outline" disabled={slides.length === 1} onClick={() => setSlides(slides.filter((_, position) => position !== index))}>Excluir peça</button>
        </div>
      </fieldset>
    </li>)}</ol>
    {campaign.format === 'carousel' && <button className="button button-outline" disabled={slides.length >= limit} onClick={() => setSlides([...slides, blankSlide])}>Adicionar peça</button>}
  </section>
}
