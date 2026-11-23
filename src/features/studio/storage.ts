import JSZip from 'jszip'
import { validateProject } from './validation'
import { newProjectIdentity, brandSchema, type Brand, type Project } from './model'
import { imageCreditSchema, type ImageCredit } from '../images/contract'
import { imageObjects } from '../images/credits'

import { abortTransaction, projectsChangedEvent, transaction } from './database'
import { templateMetadataSchema, type AuthorTemplate, type TemplateMetadata, type TemplateSummary } from './authorTemplate'

const dataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob) })
const assetRef = /^asset:([a-f0-9]{64})$/
type StoredProject = ReturnType<typeof validateProject>
type RewriteAsset = (source: string, replace: (value: string) => void) => void
type EncodedAsset = Awaited<ReturnType<typeof encodeAsset>>
const revisions = new WeakMap<Project, { baseline: string; assets: Map<string, EncodedAsset> }>()

function mapAssetFields<T>(value: T, rewrite: RewriteAsset, fields?: readonly string[]): T {
  if (value === null || typeof value !== 'object') return value
  const copy = (Array.isArray(value) ? [...value] : { ...value }) as Record<string, unknown>
  for (const [key, child] of Object.entries(value)) {
    if (key === 'imageCredit' || (fields && key === 'headlines')) continue
    if (typeof child === 'string') {
      if (!fields || fields.includes(key)) rewrite(child, next => { copy[key] = next })
    } else if (child && typeof child === 'object') {
      copy[key] = mapAssetFields(child, rewrite, fields)
    }
  }
  return copy as T
}

function mapProjectAssets(project: Project, rewrite: RewriteAsset): Project {
  return {
    ...project,
    brand: mapAssetFields(project.brand, rewrite, ['logo', 'source']),
    slides: project.slides.map(slide => ({ ...slide, scene: mapAssetFields(slide.scene, rewrite, ['src']) })),
  }
}

async function encodeAsset(source: string) {
  const [header, encoded] = source.split(',')
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  const id = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('')
  return { id, blob: new Blob([bytes], { type: header.slice(5, header.indexOf(';')) }) }
}

async function pack(project: Project, knownAssets?: ReadonlyMap<string, EncodedAsset>) {
  const assets = new Map<string, Blob>()
  const bySource = new Map<string, EncodedAsset>()
  const encoding = new Map<string, Promise<EncodedAsset>>()
  const pending: Promise<void>[] = []
  const packed = mapProjectAssets(validateProject(project), (source, replace) => {
    if (!/^data:(image\/(png|jpeg|webp)|font\/woff2);base64,/.test(source)) return
    let encoded = encoding.get(source)
    if (!encoded) {
      const known = knownAssets?.get(source)
      encoded = known ? Promise.resolve(known) : encodeAsset(source)
      encoding.set(source, encoded)
    }
    pending.push(encoded.then(asset => {
      bySource.set(source, asset)
      assets.set(asset.id, asset.blob)
      replace(`asset:${asset.id}`)
    }))
  })
  await Promise.all(pending)
  return { project: validateProject({ ...packed, assetEncoding: 'media-v1' }), assets, bySource }
}

async function hydrate(stored: StoredProject, read: (id: string) => Promise<Blob | undefined>, knownAssets?: Map<string, EncodedAsset>): Promise<Project> {
  const { assetEncoding, ...project } = stored
  const cache = new Map<string, Promise<string | undefined>>()
  const pending: Promise<void>[] = []
  function rewrite(required: boolean): RewriteAsset {
    return (source, replace) => {
      const id = assetRef.exec(source)?.[1]
      if (!id) return
      let loaded = cache.get(id)
      if (!loaded) {
        loaded = read(id).then(async blob => {
          if (!blob) return undefined
          const source = await dataUrl(blob)
          if (required) knownAssets?.set(source, { id, blob })
          return source
        })
        cache.set(id, loaded)
      }
      pending.push(loaded.then(value => {
        if (value) replace(value)
        else if (required) throw Error('Arquivo ausente. Restaure um backup completo.')
      }))
    }
  }
  const hydrated = mapProjectAssets(project, rewrite(true))
  await Promise.all(pending)
  if (assetEncoding) return validateProject(hydrated)

  // Some v1 documents also stored literal data URLs as assets outside media fields.
  pending.length = 0
  const legacy = mapAssetFields(hydrated, rewrite(false))
  await Promise.all(pending)
  return validateProject(legacy)
}
export function withStudioStorage<T>(action: () => Promise<T>): Promise<T> {
  return navigator.locks?.request('post-machine-studio-storage', action) ?? action()
}
export function saveProject(project: Project, expected?: Project) {
  return withStudioStorage(() => writeProject(project, expected))
}
export function saveLibraryProject(project: Project, expected?: Project) {
  return withStudioStorage(() => writeProject(project, expected, false))
}
export class ProjectConflict extends Error {}
async function writeProject(project: Project, expected?: Project, rememberBrand = true) {
  const previous = expected && revisions.get(expected)
  const packed = await pack(project, previous?.assets)
  const serialized = JSON.stringify(packed.project)
  const baseline = expected && (previous?.baseline ?? JSON.stringify((await pack(expected, packed.bySource)).project))
  const written = await transaction(['projects', 'projectLibrary', 'assets', 'settings', 'recovery'], 'readwrite', tx => {
    let written = false
    const old = tx.objectStore('projects').get(project.id)
    old.onsuccess = () => {
      try {
        if (expected && (expected.id !== project.id || JSON.stringify(old.result && validateProject(old.result)) !== baseline)) return
        if (old.result && JSON.stringify(old.result) !== serialized) tx.objectStore('recovery').put(old.result, project.id)
        const assets = tx.objectStore('assets')
        packed.assets.forEach((blob, id) => {
          const lookup = assets.getKey(id)
          lookup.onsuccess = () => {
            if (lookup.result === undefined) {
              try { assets.put(blob, id) }
              catch { abortTransaction(tx) }
            }
          }
        })
        if (rememberBrand) tx.objectStore('settings').put(packed.project.brand, 'brand')
        tx.objectStore('projects').put(packed.project, project.id)
        tx.objectStore('projectLibrary').put(summarizeProject(packed.project), project.id)
        written = true
      } catch { abortTransaction(tx) }
    }
    return () => written
  })
  if (!written) throw new ProjectConflict('O projeto foi atualizado em outro lugar. Reabra o projeto antes de editar.')
  revisions.set(project, { baseline: serialized, assets: packed.bySource })
  window.dispatchEvent(new Event(projectsChangedEvent))
}
export type ProjectSummary = Pick<Project, 'id' | 'name' | 'format' | 'updatedAt' | 'createdAt'> & { slideCount: number; revision: string }
type LibraryEntry = ProjectSummary | { id: string; name: string; damaged: true }

function summarizeProject(project: Project): ProjectSummary {
  const { id, name, format, updatedAt, createdAt } = project
  return { id, name, format, updatedAt, createdAt, slideCount: project.slides.length, revision: crypto.randomUUID() }
}

export async function listProjects() {
  const cached = await transaction(['projects', 'projectLibrary'], 'readonly', tx => {
    const count = tx.objectStore('projects').count()
    const entries = tx.objectStore('projectLibrary').getAll()
    return () => count.result === entries.result.length ? entries.result as LibraryEntry[] : undefined
  })
  const entries = cached ?? await rebuildProjectLibrary()
  const projects = entries.filter(entry => 'revision' in entry).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const damaged = entries.filter(entry => 'damaged' in entry)
  return { projects, damaged }
}

function rebuildProjectLibrary() {
  return transaction(['projects', 'projectLibrary'], 'readwrite', tx => {
    const library = tx.objectStore('projectLibrary')
    library.clear()
    const request = tx.objectStore('projects').openCursor()
    const entries: LibraryEntry[] = []
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      let entry: LibraryEntry
      try {
        const project = validateProject(cursor.value)
        if (project.id !== cursor.primaryKey) throw Error('Identificador inconsistente.')
        entry = summarizeProject(project)
      } catch {
        const name: unknown = cursor.value?.name
        entry = { id: String(cursor.primaryKey), name: typeof name === 'string' ? name.slice(0, 100) : '', damaged: true }
      }
      library.put(entry, cursor.primaryKey)
      entries.push(entry)
      cursor.continue()
    }
    return () => entries
  })
}
export function loadProject(id: string): Promise<Project> {
  return withStudioStorage(() => loadStoredProject(id, 'projects'))
}
async function loadStoredProject(id: string, store: 'projects' | 'recovery'): Promise<Project> {
  const value = await transaction([store], 'readonly', tx => { const req = tx.objectStore(store).get(id); return () => req.result as unknown })
  if (!value) throw Error(store === 'recovery' ? 'Ainda não existe versão anterior salva.' : 'Projeto não encontrado.')
  const stored = validateProject(value)
  const assets = new Map<string, EncodedAsset>()
  const project = await hydrate(stored, key => transaction(['assets'], 'readonly', tx => { const req = tx.objectStore('assets').get(key); return () => req.result as Blob | undefined }), stored.assetEncoding ? assets : undefined)
  revisions.set(project, { baseline: JSON.stringify(stored), assets })
  return project
}
export async function readBrand(): Promise<Brand | undefined> {
  return withStudioStorage(async () => {
    const value = await transaction(['settings'], 'readonly', tx => {
      const req = tx.objectStore('settings').get('brand')
      return () => req.result ? brandSchema.parse(req.result) : undefined
    })
    return value && {
      ...value,
      logo: value.logo && await resolveBrandAsset(value.logo),
      fonts: await Promise.all(value.fonts.map(async font => ({ ...font, source: await resolveBrandAsset(font.source) }))),
    }
  })
}
async function resolveBrandAsset(source: string) {
  if (!source.startsWith('asset:')) return source
  const blob = await transaction(['assets'], 'readonly', tx => {
    const req = tx.objectStore('assets').get(source.slice(6))
    return () => req.result as Blob | undefined
  })
  if (!blob) throw Error('Arquivo da marca ausente.')
  return dataUrl(blob)
}
export function removeProject(expected: ProjectSummary) {
  return withStudioStorage(() => transaction(['projects', 'projectLibrary', 'recovery'], 'readwrite', tx => {
    const projects = tx.objectStore('projects')
    const library = tx.objectStore('projectLibrary')
    const latest = library.get(expected.id)
    let removed = false
    latest.onsuccess = () => {
      try {
        if (latest.result?.revision !== expected.revision) return
        projects.delete(expected.id)
        library.delete(expected.id)
        tx.objectStore('recovery').delete(expected.id)
        removed = true
      } catch { abortTransaction(tx) }
    }
    return () => removed
  }))
}

export function inspectStorage(clean = false) {
  const inspect = () => withStudioStorage(() => transaction(['projects', 'recovery', 'settings', 'assets', 'authorTemplates'], clean ? 'readwrite' : 'readonly', tx => {
    const projects = tx.objectStore('projects').getAll()
    const recovery = tx.objectStore('recovery').getAll()
    const settings = tx.objectStore('settings').get('brand')
    const templates = tx.objectStore('authorTemplates').getAll()
    const assets = tx.objectStore('assets')
    const keys = assets.getAllKeys()
    const values = assets.getAll()
    let report: { projects: number; assets: number; bytes: number; orphans: number; recoverableBytes: number }
    let failure: unknown
    values.onsuccess = () => {
      try {
        const roots = [...projects.result, ...recovery.result, ...templates.result.map(item => item.design)].map(validateProject)
        const brand = settings.result === undefined ? undefined : brandSchema.parse(settings.result)
        const files = new Map(keys.result.map((key, index) => {
          const blob = values.result[index]
          if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key) || !(blob instanceof Blob) || !blob.size) throw Error('Arquivo do armazenamento inválido.')
          return [key, blob]
        }))
        const references = new Set<string>()
        const visit = (source: string) => {
          const id = assetRef.exec(source)?.[1]
          if (!id) return
          if (!files.has(id)) throw Error('Existem referências a arquivos ausentes.')
          references.add(id)
        }
        if (brand) mapAssetFields(brand, visit, ['logo', 'source'])
        for (const project of roots) {
          mapProjectAssets(project, visit)
          if (!project.assetEncoding) mapAssetFields(project, source => {
            const id = assetRef.exec(source)?.[1]
            if (id && files.has(id)) references.add(id)
          })
        }
        let bytes = 0, orphans = 0, recoverableBytes = 0
        for (const [key, blob] of files) {
          bytes += blob.size
          if (references.has(key)) continue
          orphans++
          recoverableBytes += blob.size
          if (clean) assets.delete(key)
        }
        report = { projects: projects.result.length, assets: files.size, bytes, orphans, recoverableBytes }
      } catch (error) { failure = error; if (clean) abortTransaction(tx) }
    }
    return () => { if (failure) throw failure; return report }
  }))
  return clean && navigator.locks ? navigator.locks.request('post-machine-studio-drafts', { ifAvailable: true }, lock => {
    if (!lock) throw Error('Há alterações pendentes no Studio. Salve antes de limpar.')
    return inspect()
  }) : inspect()
}

export type UsedImage = { id: string; asset: string; credit?: ImageCredit }
export function listUsedImages() {
  return transaction(['projects', 'recovery'], 'readonly', tx => {
    const current = tx.objectStore('projects').getAll()
    const recovery = tx.objectStore('recovery').getAll()
    return () => {
      const history = new Map<string, UsedImage>()
      const projects = [...current.result, ...recovery.result].map(validateProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      for (const project of projects) for (const slide of project.slides) {
        const objects = slide.scene.contentImage ? [...slide.scene.objects, slide.scene.contentImage] : slide.scene.objects
        for (const image of imageObjects(objects)) {
          if (typeof image.src !== 'string' || !/^asset:[a-f0-9]{64}$/.test(image.src)) continue
          const asset = image.src.slice(6)
          const parsed = imageCreditSchema.safeParse(image.imageCredit)
          const credit = parsed.success ? parsed.data : undefined
          const id = `${asset}:${credit?.sourceId ?? ''}`
          if (!history.has(id)) history.set(id, { id, asset, credit })
        }
      }
      return [...history.values()]
    }
  })
}

export async function readImageAsset(asset: string) {
  const blob = await transaction(['assets'], 'readonly', tx => {
    const request = tx.objectStore('assets').get(asset)
    return () => request.result as Blob | undefined
  })
  if (!blob) throw Error('Arquivo indisponível no armazenamento local.')
  return blob
}
const backupLimits = { total: 150_000_000, entry: 20_000_000, entries: 500 }
export class BackupLimitError extends Error {
  constructor() { super('Este projeto excede o limite de restauração do ZIP. Reduza o tamanho do projeto e tente novamente.') }
}

export async function backupProject(project: Project): Promise<Blob> {
  return backupDesign(project)
}

async function backupDesign(project: Project, metadata?: TemplateMetadata): Promise<Blob> {
  const packed = await pack(project)
  const manifest = new TextEncoder().encode(JSON.stringify(metadata ? { metadata, design: packed.project } : packed.project))
  let total = manifest.byteLength
  if (total > backupLimits.entry || packed.assets.size + 1 > backupLimits.entries) throw new BackupLimitError()
  for (const blob of packed.assets.values()) {
    total += blob.size
    if (blob.size > backupLimits.entry || total > backupLimits.total) throw new BackupLimitError()
  }
  const zip = new JSZip().file(metadata ? 'template.json' : 'project.json', manifest)
  for (const [id, blob] of packed.assets) zip.file(`assets/${id}`, await blob.arrayBuffer(), { createFolders: false })
  const archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  if (archive.size > backupLimits.total) throw new BackupLimitError()
  return archive
}

function readZipEntry(file: JSZip.JSZipObject, maxBytes: number, account: (size: number) => boolean) {
  // JSZip documents internalStream, but omits it on ZipObject in its bundled types.
  const entry = file as JSZip.JSZipObject & { internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array> }
  return new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    const stream = entry.internalStream('uint8array')
    const chunks: Uint8Array[] = []
    let bytes = 0
    stream.on('data', chunk => {
      bytes += chunk.byteLength
      if (bytes > maxBytes || !account(chunk.byteLength)) {
        stream.pause()
        reject(Error('O conteúdo descompactado do backup excede o limite.'))
        return
      }
      chunks.push(chunk)
    }).on('error', () => reject(Error('Um arquivo do backup está corrompido.'))).on('end', () => {
      const result = new Uint8Array(bytes)
      let offset = 0
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
      resolve(result)
    }).resume()
  })
}

async function readDesignBackup(file: File, template: boolean) {
  if (file.size > backupLimits.total) throw Error('Backup excede 150 MB.')
  const zip = await JSZip.loadAsync(await file.arrayBuffer()).catch(() => { throw Error('O arquivo não é um backup ZIP válido.') })
  if (Object.keys(zip.files).length > backupLimits.entries) throw Error('Backup excede o limite de arquivos.')
  const manifest = zip.file(template ? 'template.json' : 'project.json')
  if (!manifest) throw Error(template ? 'O backup não contém um template autoral.' : 'O backup não contém o documento do projeto.')
  let total = 0
  const account = (size: number) => (total += size) <= backupLimits.total
  const json = await readZipEntry(manifest, backupLimits.entry, account)
  let document: StoredProject
  let metadata: TemplateMetadata | undefined
  try {
    const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json))
    metadata = template ? templateMetadataSchema.parse(raw.metadata) : undefined
    document = validateProject(template ? raw.design : raw)
  }
  catch { throw Error('O documento do backup está corrompido ou usa uma versão incompatível.') }
  const project = await hydrate(document, async id => {
    const asset = zip.file(`assets/${id}`)
    if (!asset) return undefined
    const data = await readZipEntry(asset, backupLimits.entry, account)
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(n => n.toString(16).padStart(2,'0')).join('')
    if (hash !== id) throw Error('Imagem ou fonte corrompida no backup.')
    const font = String.fromCharCode(...data.slice(0,4)) === 'wOF2'
    const png = data[0] === 137 && data[1] === 80; const jpeg = data[0] === 255 && data[1] === 216
    return new Blob([data as BlobPart], { type: font ? 'font/woff2' : png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp' })
  })
  return { project, metadata }
}

export async function restoreProject(file: File): Promise<Project> {
  const { project } = await readDesignBackup(file, false)
  const restored = { ...project, ...newProjectIdentity(), name: `${project.name.slice(0, 85)} (restaurado)` }
  await saveProject(restored); return restored
}

export function loadRecovery(id: string): Promise<Project> {
  return withStudioStorage(() => loadStoredProject(id, 'recovery'))
}

type StoredTemplate = TemplateSummary & { design: StoredProject }
const templateStore = 'authorTemplates'

export async function listAuthorTemplates(): Promise<TemplateSummary[]> {
  return transaction([templateStore], 'readonly', tx => {
    const request = tx.objectStore(templateStore).getAll()
    return () => (request.result as StoredTemplate[]).map(item => ({
      ...templateMetadataSchema.parse(item), id: item.id, format: item.format, favorite: item.favorite,
      thumbnail: item.thumbnail, revision: item.revision,
    }))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'pt-BR'))
  })
}

export async function loadAuthorTemplate(id: string): Promise<AuthorTemplate> {
  const { stored, assets } = await transaction([templateStore, 'assets'], 'readonly', tx => {
    const request = tx.objectStore(templateStore).get(id)
    const reads = new Map<string, IDBRequest<Blob | undefined>>()
    let stored: StoredTemplate | undefined
    let failure: unknown
    request.onsuccess = () => {
      if (!request.result) return
      try {
        const design = validateProject(request.result.design)
        stored = { ...request.result, design }
        mapProjectAssets(design, source => {
          const assetId = assetRef.exec(source)?.[1]
          if (assetId && !reads.has(assetId)) reads.set(assetId, tx.objectStore('assets').get(assetId))
        })
      } catch (cause) { failure = cause }
    }
    return () => {
      if (failure) throw failure
      return { stored, assets: new Map([...reads].map(([key, value]) => [key, value.result])) }
    }
  })
  if (!stored) throw Error('Este template não está mais disponível na biblioteca.')
  const design = await hydrate(stored.design, async assetId => assets.get(assetId))
  return { ...stored, ...templateMetadataSchema.parse(stored), design }
}

async function writeTemplate(id: string, expected: string | undefined, update: (previous: StoredTemplate | undefined) => StoredTemplate | undefined, assets?: Map<string, Blob>) {
  return withStudioStorage(async () => {
    let written = false
    const result = await transaction([templateStore, 'assets'], 'readwrite', tx => {
      const store = tx.objectStore(templateStore)
      const request = store.get(id)
      let next: StoredTemplate | undefined
      request.onsuccess = () => {
        const previous = request.result as StoredTemplate | undefined
        if (previous?.revision !== expected) return
        try {
          next = update(previous)
          if (next) {
            assets?.forEach((blob, hash) => tx.objectStore('assets').put(blob, hash))
            store.put(next, id)
          } else store.delete(id)
          written = true
        } catch { abortTransaction(tx) }
      }
      return () => next
    })
    if (!written) throw Error('Este template mudou em outra aba. Atualize a biblioteca antes de editar.')
    return result
  })
}

export async function saveAuthorTemplate(metadata: TemplateMetadata, design: Project, thumbnail: Blob, previous?: TemplateSummary) {
  const fields = templateMetadataSchema.parse(metadata)
  if (design.slides.length !== 1 || !design.slides[0].scene.objects.length) throw Error('Selecione uma composição de um slide com elementos.')
  if (thumbnail.type !== 'image/png' || thumbnail.size === 0 || thumbnail.size > 2_000_000) throw Error('Miniatura inválida.')
  const id = previous?.id ?? crypto.randomUUID()
  const packed = await pack({ ...design, id, name: fields.name, campaignId: null, campaignUpdatedAt: null, caption: undefined })
  return writeTemplate(id, previous?.revision, current => ({
    ...fields, id, format: design.format, favorite: current?.favorite ?? false, thumbnail,
    revision: crypto.randomUUID(), design: packed.project,
  }), packed.assets)
}

export async function updateAuthorTemplate(template: TemplateSummary, change: { name?: string; favorite?: boolean } | null) {
  const metadata = change ? templateMetadataSchema.parse({ ...template, name: change.name ?? template.name }) : undefined
  await writeTemplate(template.id, template.revision, previous => previous && change && metadata ? {
    ...previous, ...metadata, favorite: change.favorite ?? previous.favorite, revision: crypto.randomUUID(),
  } : undefined)
}

export async function backupAuthorTemplate(id: string) {
  const template = await loadAuthorTemplate(id)
  return backupDesign(template.design, templateMetadataSchema.parse(template))
}

export async function readAuthorTemplateBackup(file: File) {
  const { project, metadata } = await readDesignBackup(file, true)
  return { design: project, metadata: templateMetadataSchema.parse(metadata) }
}
