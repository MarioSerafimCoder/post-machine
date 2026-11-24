import type { Opportunity } from '../radar/contract'
import { ResponsePreview } from './ResponsePreview'
import { HeadlinePanel } from '../headlines/HeadlinePanel'
import { campaignHeadlineContext } from '../headlines/context'
import { SaveQueue } from '../../lib/saveQueue'
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { BriefingIntelligence } from '../intelligence/BriefingIntelligence'
import { briefingInstructions, recommend, reviewEditorial } from '../intelligence/decision'
import { campaignScope, preferenceFor, useEditorialMemory } from '../intelligence/feedback'
import { normalize, type Article } from '../radar/contract'
import {
  applyBriefingFormat, approaches, backupSchema, createPrompt, defaultPreferences, draftFromReference, formats, importContent,
  markdownExample, maxBackup, maxImport, maxSlides, newDraft, objectives, roles, tones,
  type Backup, type Briefing, type Content, type DesignMode, type Draft, type Slide,
} from './contract'
import { CampaignConflict, deleteCampaign, putCampaign, putPreferences, readCampaign, readCampaigns, restoreCampaigns } from './storage'
import './campaigns.css'
import type { Reference } from '../virals/contract'
import { identifyUrl, platforms as referencePlatforms } from '../virals/urls'

const platforms = {
  ChatGPT: 'https://chatgpt.com/',
  Claude: 'https://claude.ai/new',
  Gemini: 'https://gemini.google.com/',
}
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })
// An ISO calendar date has no time zone: render its original day without shifting it.
const publicationDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? dateOnly.format(new Date(value + 'T00:00:00.000Z')) : date.format(new Date(value))
const replyKey = (id: string) => 'post-machine:awaiting-reply:' + id
function finishReply(id: string) {
  try { localStorage.removeItem(replyKey(id)) } catch { /* O armazenamento de preferências pode estar desativado. */ }
}
const blankSlide: Slide = { order: 1, role: 'content', title: '', body: '', imageBrief: '', layoutType: 'editorial' }

export type CampaignRequest = { article: Article | null; reference?: Reference; opportunity?: Opportunity } | { campaignId: string }
export function Campaigns({ request, active, onBack, onDesign }: {
  request: CampaignRequest | null
  active: boolean
  onBack: (references: boolean) => void
  onDesign: (draft: Draft, mode?: DesignMode) => void
}) {
  const [backup, setBackup] = useState<Backup>()
  const [selected, setSelected] = useState<string | undefined>(() => window.history.state?.campaignId)
  useEffect(() => {
    if (active) window.history.replaceState({ ...window.history.state, campaignId: selected }, '')
  }, [active, selected])
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(0)
  const [dirty, setDirty] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [deleteId, setDeleteId] = useState<string>()
  const [restoring, setRestoring] = useState(false)
  const handledRequest = useRef<typeof request>(null)
  const transferPending = useRef(false)
  const responseInput = useRef<{ id: string; raw: string } | undefined>(undefined)
  const [responsePendingId, setResponsePendingId] = useState<string>()
  const [editorRevision, setEditorRevision] = useState(0)
  const clearPendingResponse = useCallback(() => {
    responseInput.current = undefined
    setResponsePendingId(undefined)
  }, [])
  const trackResponse = useCallback((id: string, raw: string) => {
    responseInput.current = { id, raw }
    const pending = raw.trim() ? id : undefined
    setResponsePendingId(current => current === pending ? current : pending)
    setError(current => current ? '' : current)
  }, [])
  const heading = useRef<HTMLHeadingElement>(null)
  const draft = backup?.campaigns.find(item => item.id === selected)
  const [persisted] = useState(() => new Map<string, Draft>())
  const [queue] = useState(() => new SaveQueue<Draft>(async item => {
    await putCampaign(item, persisted.get(item.id))
    persisted.set(item.id, item)
  }, (id, state, failure) => {
    setDirty(current => state === 'saved' ? current.filter(value => value !== id) : current.includes(id) ? current : [...current, id])
    if (state === 'error') setError(failure instanceof CampaignConflict
      ? 'A campanha mudou em outra aba. Exporte um backup para guardar suas alterações e restaure-o após recarregar.'
      : 'Falha ao salvar. Tente novamente com Salvar campanha. Suas alterações continuam nesta tela.')
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
    try {
      await queue.flushAll()
      clearPendingResponse()
      setSelected(id)
      setDeleteId(undefined)
    } catch { /* Keep the unsaved document open. */ }
  }
  async function create() {
    if (!backup) return
    try { await queue.flushAll() } catch { return }
    const item = newDraft(null, backup.preferences)
    persist(item, true)
    clearPendingResponse()
    setSelected(item.id)
    setCreating(false)
  }

  useEffect(() => {
    let live = true
    void readCampaigns().then(result => {
      if (!live) return
      result.campaigns.forEach(item => persisted.set(item.id, item))
      setBackup(result)
    }, () => { if (live) setLoadError(true) })
    return () => { live = false }
  }, [persisted])

  const persist = useCallback((value: Draft, explicit = false) => {
    const item = { ...value, updatedAt: new Date().toISOString() }
    setBackup(current => current && { ...current, campaigns: [item, ...current.campaigns.filter(entry => entry.id !== item.id)] })
    setStatus('')
    setError('')
    queue.schedule(item.id, item)
    if (explicit) void queue.flush(item.id).then(() => setStatus('Campanha salva.'), () => undefined)
    return item
  }, [queue])

  async function saveAndContinue(item: Draft, destination: 'studio' | 'express' | 'save' = 'studio') {
    if (transferPending.current) return
    transferPending.current = true
    setSaving(count => count + 1)
    setError('')
    try {
      const raw = responseInput.current?.id === item.id ? responseInput.current.raw.trim() : ''
      const content = raw ? importContent(raw, item) : item.content && (destination === 'save' ? item.content : applyBriefingFormat(item.content, item.briefing))
      if (raw && item.content && !window.confirm('A resposta colada substituirá o conteúdo revisado desta campanha. Continuar?')) return
      const saved = persist({ ...item, content })
      await queue.flushAll()
      if (raw) {
        finishReply(item.id)
        clearPendingResponse()
        setEditorRevision(current => current + 1)
      }
      setStatus('Campanha salva.')
      if (destination !== 'save' && saved.content) onDesign(saved, destination === 'express' ? 'express' : undefined)
    } catch (failure) {
      if (failure instanceof CampaignConflict) {
        setError('A campanha mudou em outra aba. Exporte um backup antes de recarregar; o Studio não foi aberto.')
      } else {
        setError(failure instanceof Error
          ? `Não foi possível continuar: ${failure.message}`
          : 'Não foi possível salvar e abrir o Studio. Revise a resposta e tente novamente.')
      }
      window.requestAnimationFrame(() => document.getElementById('campaign-import-heading')?.scrollIntoView({ block: 'nearest' }))
    } finally {
      transferPending.current = false
      setSaving(count => count - 1)
    }
  }

  useEffect(() => {
    if (!request || handledRequest.current === request || (!backup && !loadError)) return
    const timer = window.setTimeout(() => {
      handledRequest.current = request
      if ('campaignId' in request) {
        void queue.flushAll().then(() => readCampaign(request.campaignId)).then(item => {
          if (handledRequest.current !== request) return
          if (!item) { setError('O briefing vinculado não está neste navegador.'); return }
          persisted.set(item.id, item)
          setBackup(current => ({
            schemaVersion: 2, preferences: current?.preferences ?? defaultPreferences,
            campaigns: [item, ...(current?.campaigns ?? []).filter(entry => entry.id !== item.id)],
          }))
          clearPendingResponse()
          setSelected(item.id)
          setError('')
        }, () => setError('Não foi possível abrir o briefing.'))
        return
      }
      const preferences = backup?.preferences ?? defaultPreferences
      const item = request.reference ? draftFromReference(request.reference, preferences) : newDraft(request.article, preferences, request.opportunity)
      if (!backup) setBackup({ schemaVersion: 2, campaigns: [], preferences })
      clearPendingResponse()
      setSelected(item.id)
      persist(item)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [request, backup, loadError, persist, clearPendingResponse, persisted, queue])


  async function remove(item: Draft) {
    setSaving(count => count + 1)
    setError('')
    try {
      await queue.flush(item.id)
      await deleteCampaign(persisted.get(item.id) ?? item)
      finishReply(item.id)
      persisted.delete(item.id)
      setBackup(current => current && { ...current, campaigns: current.campaigns.filter(entry => entry.id !== item.id) })
      setSelected(current => current === item.id ? undefined : current)
      clearPendingResponse()
      setDeleteId(undefined)
      setDirty(current => current.filter(id => id !== item.id))
      setStatus('Campanha excluída.')
    } catch (failure) { setError(failure instanceof CampaignConflict ? 'A campanha mudou em outra aba. Recarregue antes de excluir.' : 'Não foi possível excluir a campanha.') }
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
    clearPendingResponse()
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
      setError(file.size > maxBackup && failure instanceof Error ? failure.message : 'O arquivo não é um backup válido do Post Machine.')
      setRestoring(false)
      return
    }
    try {
      await restoreCampaigns(data)
      const restored = await readCampaigns()
      persisted.clear()
      restored.campaigns.forEach(item => persisted.set(item.id, item))
      setBackup(restored)
      clearPendingResponse()
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
      <button className="button button-outline" onClick={() => void queue.flushAll().then(() => onBack(Boolean(draft?.creativeOrigin)), () => undefined)}>{draft?.creativeOrigin ? 'Voltar às referências' : 'Voltar às notícias'}</button>
    </header>
    {loadError && <p className="info-strip" role="alert">Não foi possível carregar as campanhas locais.</p>}
    {!backup && !loadError && <p role="status">Carregando campanhas.</p>}
    <p className="campaign-status" role="status">{saving || (dirty.length > 0 && !error) ? 'Salvando…' : status}</p>
    {error && <p className="info-strip" role="alert">{error}</p>}
    <fieldset className="campaign-workspace" disabled={restoring}>
      <legend className="sr-only">Campanhas locais</legend>
      <div className="campaign-actions"><button className="button button-dark" disabled={!backup} onClick={() => setCreating(value => !value)}>Nova campanha</button>
      {creating && <><button className="button button-outline" onClick={() => void create()}>Começar do zero</button><button className="button button-outline" onClick={() => void create().then(() => document.getElementById('campaign-import-heading')?.scrollIntoView())}>Importar conteúdo</button><button className="button button-outline" onClick={() => onBack(false)}>Usar notícia do Radar</button></>}</div>
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
        <Editor key={`${draft.id}:${editorRevision}`} draft={draft} active={active} update={persist}
          onPreferences={briefing => void savePreferences(briefing)}
          onRawChange={raw => trackResponse(draft.id, raw)} externalError={error} />
        <div className="campaign-actions">
          <button className="button button-dark" disabled={saving > 0} onClick={() => void saveAndContinue(draft)}>
            {draft.content || responsePendingId === draft.id ? 'Salvar e abrir no Studio' : 'Salvar campanha'}
          </button>
          {draft.content && responsePendingId !== draft.id && <button className="button button-outline" disabled={saving > 0}
            onClick={() => void saveAndContinue(draft, 'save')}>Salvar sem abrir</button>}
          {draft.content && <button className="button button-outline" disabled={saving > 0}
            onClick={() => void saveAndContinue(draft, 'express')}>Explorar designs da campanha</button>}
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

function Editor({ draft, active, update, onPreferences, onRawChange, externalError }: {
  draft: Draft
  active: boolean
  update: (draft: Draft) => void
  onPreferences: (briefing: Briefing) => void
  onRawChange: (raw: string) => void
  externalError: string
}) {
  const [platform, setPlatform] = useState<keyof typeof platforms>('ChatGPT')
  const [raw, setRaw] = useState('')
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [replacing, setReplacing] = useState(false)
  const reply = useRef<HTMLTextAreaElement>(null)
  const returnKey = replyKey(draft.id)
  const [awaiting, setAwaiting] = useState(() => {
    try { return localStorage.getItem(returnKey) === '1' } catch { return false }
  })
  const entryStage = useRef(awaiting ? 'reply' : draft.content ? 'review' : 'briefing')
  useEffect(() => {
    if (!active) return
    if (entryStage.current === 'reply') reply.current?.focus()
    else document.getElementById(entryStage.current === 'review' ? 'campaign-review-heading' : 'campaign-briefing-heading')?.focus()
  }, [active])
  useEffect(() => {
    if (!active || !awaiting) return
    function returnToReply() {
      if (document.visibilityState === 'visible') reply.current?.focus()
    }
    document.addEventListener('visibilitychange', returnToReply)
    return () => document.removeEventListener('visibilitychange', returnToReply)
  }, [active, awaiting])
  function rememberReply(value: boolean) {
    entryStage.current = value ? 'reply' : 'review'
    setAwaiting(value)
    try {
      if (value) localStorage.setItem(returnKey, '1')
      else localStorage.removeItem(returnKey)
    } catch { /* A etapa continua disponível nesta sessão. */ }
  }
  const { article, briefing } = draft
  const deferred = useDeferredValue(draft)
  const { history } = useEditorialMemory()
  const recommendations = useMemo(() => active ? recommend(deferred, preference => preferenceFor(history, campaignScope(deferred), preference)) : [], [active, deferred, history])
  const findings = useMemo(() => active ? reviewEditorial(deferred) : [], [active, deferred])
  const editBriefing = (changes: Partial<Briefing>) => update({ ...draft, briefing: { ...briefing, ...changes } })
  const editContent = (content: Content) => update({ ...draft, content })
  const changeRaw = (value: string) => {
    setRaw(value)
    setError('')
    setReplacing(false)
    onRawChange(value)
  }

  function generate() {
    update({ ...draft, prompt: createPrompt(draft, briefingInstructions(draft, recommend(draft))), promptBriefing: briefing })
    setCopyStatus('')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.prompt)
      rememberReply(true)
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
      changeRaw(value)
    } catch { setError('Escolha um arquivo .json ou .md legível com até 250 mil caracteres.') }
  }

  function importResponse() {
    try {
      const content = importContent(raw, draft)
      editContent(content)
      rememberReply(false)
      changeRaw('')
      setCopyStatus('')
      window.requestAnimationFrame(() => document.getElementById('campaign-review-heading')?.focus())
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível importar o conteúdo.') }
  }

  return <>
    {draft.creativeOrigin && <section className="campaign-panel" aria-label="Referência criativa de origem">
      <h3>Referência criativa de origem</h3>
      <a href={draft.creativeOrigin.url} target="_blank" rel="noreferrer">{draft.creativeOrigin.title}</a>
      <p>{referencePlatforms[identifyUrl(draft.creativeOrigin.url).platform]}{draft.creativeOrigin.author && ` · ${draft.creativeOrigin.author}`} · Cadastro manual</p>
      {draft.creativeOrigin.description && <p>{draft.creativeOrigin.description}</p>}
    </section>}
    {article && <section className="campaign-panel" aria-labelledby="campaign-source-heading">
      <h3 id="campaign-source-heading" tabIndex={-1}>Notícia de origem</h3>
      <a href={article.url} target="_blank" rel="noreferrer">{article.title}</a>
      <p className="muted">{[article.source, article.category, article.language === 'pt' ? 'Português' : article.language === 'en' ? 'Inglês' : article.language,
        article.publishedAt && date.format(new Date(article.publishedAt))].filter(Boolean).join(' · ')}</p>
      {article.summary && <p>{article.summary}</p>}
    </section>}
    <section className="campaign-panel" aria-labelledby="campaign-briefing-heading">
      <h3 id="campaign-briefing-heading" tabIndex={-1}>Briefing editorial</h3>
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
    <BriefingIntelligence draft={draft} recommendations={recommendations} findings={findings} active={active}
      current={deferred === draft} edit={editBriefing} />
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
      {awaiting && <button className="button button-dark" onClick={() => reply.current?.focus()}>Colar resposta desta campanha</button>}
    </section>}
    <section className="campaign-panel" aria-labelledby="campaign-import-heading">
      <h3 id="campaign-import-heading">Importar resposta</h3>
      <label>Conteúdo em JSON ou Markdown<textarea ref={reply} rows={6} value={raw} maxLength={maxImport}
        onChange={event => changeRaw(event.target.value)} /></label>
      <p className="muted">Cole a resposta do GPT. Depois de validar, você pode salvar e seguir diretamente para o Studio.</p>
      <ResponsePreview raw={raw} draft={draft} hideError={Boolean(error || externalError)} />
      <details className="campaign-example"><summary>Ver sintaxe Markdown</summary>
        <p className="muted">Use os nomes dos campos do modelo. Repita a seção Fonte para cada referência e numere os slides a partir de 1. Use carousel, post ou story no formato e cover, content ou cta na função. Datas aceitam AAAA-MM-DD, ISO 8601 com fuso ou null.</p>
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
    {draft.content && <Review draft={draft} active={active} content={draft.content} update={editContent} />}
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

function Review({ draft, active, content, update }: { draft: Draft; active: boolean; content: Content; update: (content: Content) => void }) {
  const [headlineIndex, setHeadlineIndex] = useState<number>()
  const { campaign, slides } = content
  const setSlides = (items: Slide[]) => update({ ...content, slides: items.map((item, index) => ({ ...item, order: index + 1 })) })
  const move = (index: number, direction: number) => {
    setHeadlineIndex(undefined)
    const next = [...slides]
    const [slide] = next.splice(index, 1)
    next.splice(index + direction, 0, slide)
    setSlides(next)
  }
  const slideField = (index: number, changes: Partial<Slide>) => setSlides(slides.map((item, position) => position === index ? { ...item, ...changes } : item))
  const limit = campaign.format === 'carousel' ? maxSlides : 1

  return <section className="campaign-panel" aria-labelledby="campaign-review-heading">
    <h3 id="campaign-review-heading" tabIndex={-1}>Revisão editorial</h3>
    <p className="muted">{formats[campaign.format]} · {slides.length} {slides.length === 1 ? 'peça' : 'peças'}. A arte pode ser criada no Studio.</p>
    <div className="campaign-fields">
      {([['title', 'Nome da campanha'], ['objective', 'Objetivo da campanha'], ['audience', 'Público da campanha'], ['tone', 'Tom da campanha']] as const)
        .map(([key, label]) => <label key={key}>{label}<input value={campaign[key]} maxLength={500} onChange={event => update({ ...content, campaign: { ...campaign, [key]: event.target.value } })} /></label>)}
      {([['caption', 'Legenda'], ['cta', 'Chamada para ação']] as const)
        .map(([key, label]) => <label className="campaign-wide" key={key}>{label}<textarea rows={3} value={campaign[key]} maxLength={8000}
          onChange={event => update({ ...content, campaign: { ...campaign, [key]: event.target.value } })} /></label>)}
    </div>
    <h4>Referências</h4>
    <ul className="campaign-sources">{content.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
      {source.publishedAt && <time dateTime={source.publishedAt}> · {publicationDate(source.publishedAt)}</time>}</li>)}</ul>
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
        <button type="button" className="button button-outline" aria-expanded={headlineIndex === index} onClick={() => setHeadlineIndex(value => value === index ? undefined : index)}>Melhorar headline</button>
        {headlineIndex === index && <HeadlinePanel title={slide.title} stored={slide.headlines} context={{ ...campaignHeadlineContext(draft), selectedSlide: index + 1 }}
          assistant={active ? { area: 'radar', scope: campaignScope(draft), id: `${draft.id}:${slide.order}` } : undefined}
          save={(headlines, text) => slideField(index, { headlines, title: text ?? slide.title })} />}
        <div className="campaign-actions">
          <button className="button button-outline" disabled={index === 0} onClick={() => move(index, -1)}>Mover para cima</button>
          <button className="button button-outline" disabled={index === slides.length - 1} onClick={() => move(index, 1)}>Mover para baixo</button>
          <button className="button button-outline" disabled={slides.length >= limit}
            onClick={() => { setHeadlineIndex(undefined); setSlides([...slides.slice(0, index + 1), slide, ...slides.slice(index + 1)]) }}>Duplicar peça</button>
          <button className="button button-outline" disabled={slides.length === 1} onClick={() => { setHeadlineIndex(undefined); setSlides(slides.filter((_, position) => position !== index)) }}>Excluir peça</button>
        </div>
      </fieldset>
    </li>)}</ol>
    {campaign.format === 'carousel' && <button className="button button-outline" disabled={slides.length >= limit} onClick={() => setSlides([...slides, blankSlide])}>Adicionar peça</button>}
  </section>
}
