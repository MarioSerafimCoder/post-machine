import { useEffect, useRef, useState } from 'react'
import { templateRole, templateRoles, type AuthorTemplate, type TemplateMetadata, type TemplateSummary } from './authorTemplate'
import { download, renderScene } from './export'
import { loadFonts } from './fonts'
import { emptySlide, newProject, dimensions, formatNames, type Format, type Project } from './model'
import { backupAuthorTemplate, listAuthorTemplates, loadAuthorTemplate, readAuthorTemplateBackup, saveAuthorTemplate, updateAuthorTemplate } from './storage'
import editorialSlides from './dossieEditorial.json'
import { createEditorial02 } from './editorial02'
import { createEditorial03 } from './editorial03'
import { transaction } from './database'
import { StudioDialog } from './StudioDialog'
import { CollectionGallery } from './CollectionGallery'
import type { Collection } from './collections'
import { AdaptLayoutDialog } from './AdaptLayoutDialog'

const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)

async function templateThumbnail(design: Project) {
  await loadFonts(design.brand)
  const [width, height] = dimensions[design.format]
  return (await renderScene(design.slides[0].scene, width, height, { scale: .24 })).blob
}

async function installTemplate(key: string, familyId: string, create: () => Project, description: string) {
  const install = async () => {
    const installed = await transaction(['settings'], 'readonly', tx => {
      const request = tx.objectStore('settings').get(key)
      return () => request.result === true
    })
    if (installed) return
    const existing = await listAuthorTemplates()
    if (!existing.some(item => item.familyId === familyId)) {
      const design = create()
      await saveAuthorTemplate({ schemaVersion: 1, name: design.name,
        description,
        category: 'Editorial', brandMode: 'linked', familyId }, design, await templateThumbnail(design))
    }
    await transaction(['settings'], 'readwrite', tx => {
      tx.objectStore('settings').put(true, key)
      return () => undefined
    })
  }
  return navigator.locks ? navigator.locks.request(`post-machine-${key}`, install) : install()
}

async function installEditorialTemplates() {
  await installTemplate('editorial-template-v1', 'fe849b0a-8a9c-4f7b-b52b-ec8d56c230c5', () => {
    const design = newProject('portrait')
    design.name = 'Editorial 01'
    design.brand = { ...design.brand, margin: 45, primary: '#080718', secondary: '#FF4000', background: '#F5F5F5' }
    design.slides = editorialSlides.map(({ role, background, objects }) => ({
      ...emptySlide(), role, layout: 'editorial', scene: { background, objects: structuredClone(objects) },
    }))
    return design
  }, 'Carrossel com seis composições e quadros de imagem editáveis.')
  await installTemplate('editorial-02-template-v1', '398b286f-4c67-4f5b-a0e6-75864f5d0396', createEditorial02,
    'Cinco composições: capa fotográfica, editorial escuro, comparação em laranja, editorial claro e lista. Fotografias substituíveis.')
  await installTemplate('editorial-03-template-v1', '165371df-2330-4a2f-bfe4-7dacb3a14b79', createEditorial03,
    'Sete composições: capa com degradê, apresentação, dupla de fotos, matriz de análise, relato fotográfico, coluna lateral e ciclo de cinco etapas.')
}

function Thumb({ item }: { item: TemplateSummary }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(item.thumbnail)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [item.thumbnail])
  return <div className="collection-thumb"><img ref={image} alt={`Miniatura de ${item.name}`} loading="lazy" /></div>
}

export function SaveTemplate({ project, previous, close, saved }: {
  project: Project; previous?: TemplateSummary; close: () => void; saved: (item: TemplateSummary) => void
}) {
  const [name, setName] = useState(previous?.name ?? project.name)
  const [description, setDescription] = useState(previous?.description ?? '')
  const [category, setCategory] = useState(previous?.category ?? 'Editorial')
  const [brandMode, setBrandMode] = useState<TemplateMetadata['brandMode']>(previous?.brandMode ?? 'linked')
  const [thumbnail, setThumbnail] = useState<Blob>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [familyId] = useState(() => previous?.familyId ?? crypto.randomUUID())
  const metadata: TemplateMetadata = { schemaVersion: 1, familyId, name, description, category, brandMode }
  const scene = project.slides[0].scene
  const roles = [...new Set(scene.objects.map(templateRole).filter(role => role !== undefined && role !== 'decoration' && role !== 'fixed'))]
  useEffect(() => {
    let alive = true
    void templateThumbnail(project).then(blob => { if (alive) setThumbnail(blob) }, cause => { if (alive) setError(message(cause)) })
    return () => { alive = false }
  }, [project])
  async function save() {
    if (!thumbnail || busy) return
    setError('')
    setBusy(true)
    try {
      const item = await saveAuthorTemplate(metadata, project, thumbnail, previous)
      if (item) saved(item)
    } catch (cause) { setError(message(cause)) }
    finally { setBusy(false) }
  }
  return <StudioDialog title={previous ? 'Atualizar template' : 'Salvar como template'} close={() => { if (!busy) close() }}>
    <form className="template-form" onSubmit={event => { event.preventDefault(); void save() }}>
      {thumbnail ? <Thumb item={{ ...metadata, id: project.id, format: project.format, thumbnail, revision: '', favorite: false }} /> : <p role="status">Gerando miniatura da composição…</p>}
      <p>{formatNames[project.format]} · {dimensions[project.format].join(' × ')}</p>
      <label>Nome do template<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
      <label>Descrição opcional<textarea maxLength={500} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <label>Finalidade editorial<input required maxLength={80} value={category} onChange={event => setCategory(event.target.value)} /></label>
      <label>Identidade visual<select value={brandMode} onChange={event => setBrandMode(event.target.value === 'replaceable' ? 'replaceable' : 'linked')}>
        <option value="linked">Manter a identidade do template</option>
        <option value="replaceable">Aplicar Minha marca ao reutilizar</option>
      </select></label>
      <p>Campos editáveis na fabricação: {roles.length ? roles.map(role => templateRoles[role]).join(', ') : 'nenhum'}. As outras camadas ficam como na composição.</p>
      {error && <p role="alert">{error}</p>}
      <button className="button button-dark" disabled={busy || !thumbnail || !name.trim() || !category.trim()}>{busy ? 'Salvando…' : 'Salvar template'}</button>
    </form>
  </StudioDialog>
}

export function AuthorTemplates({ format, selected, use, edit, collectionGallery }: {
  format: Format; selected?: string; use: (template: AuthorTemplate) => void | Promise<void>;
  edit: (template: AuthorTemplate) => Promise<void>
  collectionGallery?: { setFormat: (format: Format) => void; use: (style: Collection) => void }
}) {
  const [items, setItems] = useState<TemplateSummary[]>()
  const [formatFilter, setFormatFilter] = useState<string>('')
  const [category, setCategory] = useState('')
  const [preview, setPreview] = useState<TemplateSummary>()
  const [adapt, setAdapt] = useState<AuthorTemplate>()
  const [rename, setRename] = useState<TemplateSummary>()
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  useEffect(() => {
    let alive = true
    void installEditorialTemplates().then(() => listAuthorTemplates()).then(value => { if (alive) setItems(value) }, cause => { if (alive) setError(message(cause)) })
    return () => { alive = false }
  }, [])
  const categories = [...new Set(items?.map(item => item.category))]
  const visible = items?.filter(item => (!formatFilter || item.format === formatFilter) && (!category || item.category === category))
  async function run(action: () => Promise<void>, success?: string) {
    if (busy) return
    setBusy(true); setError(''); setStatus('')
    try {
      await action()
      if (success) setStatus(success)
      setItems(await listAuthorTemplates())
    } catch (cause) {
      setError(message(cause))
      const latest = await listAuthorTemplates().catch(() => undefined)
      if (latest) setItems(latest)
    } finally { setBusy(false) }
  }
  const selectTemplate = (item: TemplateSummary) => run(async () => { await use(await loadAuthorTemplate(item.id)); setPreview(undefined) })
  const templateCards = visible?.map(item => <article key={item.id} data-selected={selected === item.id}>
      <Thumb item={item} />
      <div className="collection-card-copy">
        <h4>{item.name}</h4>
        <p>{formatNames[item.format]} · {item.category}</p>
        {item.description && <p>{item.description}</p>}
        <div className="collection-actions">
          <button className="button button-outline" aria-label={`Visualizar ${item.name}`} disabled={busy} onClick={() => setPreview(item)}>Visualizar</button>
          <button className="button button-dark" aria-pressed={selected === item.id} disabled={busy} onClick={() => void selectTemplate(item)}>
            {selected === item.id ? 'Selecionado' : 'Usar template'}
          </button>
            <button className="button button-delete-template" aria-label="Excluir template" title="Excluir template" disabled={busy} onClick={() => {
              if (window.confirm(`Excluir o template “${item.name}”?`)) void run(() => updateAuthorTemplate(item, null), 'Template excluído.')
            }}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg></button>
        </div>
        <details className="author-template-actions"><summary>Gerenciar template</summary>
          <div className="collection-actions">
            <button className="button button-outline" disabled={busy} onClick={() => void run(async () => edit(await loadAuthorTemplate(item.id)))}>Editar no Studio</button>
            <button className="button button-outline" disabled={busy} onClick={() => void run(async () => {
              setAdapt(await loadAuthorTemplate(item.id))
            })}>Adaptar formato</button>
            <button className="button button-outline" onClick={() => { setNewName(item.name); setRename(item) }} disabled={busy}>Renomear</button>
            <button className="button button-outline" disabled={busy} onClick={() => void run(async () => {
              const original = await loadAuthorTemplate(item.id)
              await saveAuthorTemplate({ ...original, name: `${original.name.slice(0, 90)} (cópia)`, familyId: crypto.randomUUID() }, original.design, original.thumbnail)
            }, 'Template duplicado.')}>Duplicar</button>
            <button className="button button-outline" aria-pressed={item.favorite} disabled={busy} onClick={() => void run(() => updateAuthorTemplate(item, { favorite: !item.favorite }), item.favorite ? 'Favorito removido.' : 'Template marcado como favorito.')}>Favorito</button>
            <button className="button button-outline" disabled={busy} onClick={() => void run(async () => {
              download(await backupAuthorTemplate(item.id), `template-${item.id}.zip`)
            }, 'Backup preparado.')}>Exportar backup</button>

          </div>
        </details>
      </div>
    </article>)
  return <section className={collectionGallery ? "author-templates unified-template-library" : "author-templates"} aria-label="Meus templates">
    <header><div><h3>{collectionGallery ? "Templates" : "Meus templates"}</h3>{!collectionGallery && <p className="muted">Composições salvas no Studio neste navegador.</p>}</div>
      <label className="button button-outline author-import">Importar backup de template<input className="sr-only" type="file" accept=".zip" disabled={busy} onChange={event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) void run(async () => {
          const { design, metadata } = await readAuthorTemplateBackup(file)
          await saveAuthorTemplate(metadata, design, await templateThumbnail(design))
        }, 'Template importado como cópia.')
      }} /></label>
    </header>
    {error && <p className="express-warning" role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
    {busy && <p role="status">Processando template…</p>}
    {!items && !error && <p role="status">Carregando templates…</p>}
    {items?.length === 0 && <p className="muted">Use “Salvar como template” nas ações de um projeto para adicionar uma composição.</p>}
    {!!items?.length && <div className="collection-actions">
      <label>Filtrar por formato<select value={formatFilter} onChange={event => setFormatFilter(event.target.value)}>
        <option value="">Todos os formatos</option>
        {Object.entries(formatNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Filtrar por finalidade<select value={category} onChange={event => setCategory(event.target.value)}>
        <option value="">Todas as finalidades</option>
        {categories.map(value => <option key={value}>{value}</option>)}
      </select></label>
    </div>}
    {items?.length && !visible?.length ? <p>Nenhum template corresponde aos filtros.</p> : null}
    {collectionGallery ? <CollectionGallery format={format} setFormat={collectionGallery.setFormat} use={collectionGallery.use}>{templateCards}</CollectionGallery> :
      <div className="collection-grid author-template-grid">{templateCards}</div>}
    {preview && <StudioDialog title={preview.name} close={() => setPreview(undefined)}>
      <Thumb item={preview} />
      <p>{formatNames[preview.format]} · {preview.category}</p>
      {preview.description && <p>{preview.description}</p>}
      {error && <p role="alert">{error}</p>}
      <button className="button button-dark" disabled={busy} onClick={() => void selectTemplate(preview)}>Usar template{preview.format !== format ? ` em ${formatNames[preview.format]}` : ''}</button>
    </StudioDialog>}
    {rename && <StudioDialog title="Renomear template" close={() => { if (!busy) setRename(undefined) }}>
      <form className="template-form" onSubmit={event => {
        event.preventDefault()
        void run(async () => { await updateAuthorTemplate(rename, { name: newName }); setRename(undefined) }, 'Template renomeado.')
      }}>
        <label>Novo nome<input required maxLength={100} value={newName} onChange={event => setNewName(event.target.value)} /></label>
        {error && <p role="alert">{error}</p>}
        <button className="button button-dark" disabled={busy || !newName.trim()}>Salvar nome</button>
      </form>
    </StudioDialog>}
    {adapt && <AdaptLayoutDialog source={adapt.design} variants={items?.filter(item => item.familyId === adapt.familyId && item.id !== adapt.id)}
      close={() => setAdapt(undefined)} confirmLabel="Salvar como variante" confirm={async (design, variant) => {
        if (variant) await use(variant)
        else {
          await saveAuthorTemplate({ ...adapt, name: design.name }, design, await templateThumbnail(design))
          setItems(await listAuthorTemplates())
          setStatus('Variante salva em Meus templates.')
        }
        setAdapt(undefined)
      }} />}
  </section>
}
