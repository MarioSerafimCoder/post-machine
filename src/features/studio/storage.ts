import JSZip from 'jszip'
import { validateProject } from './validation'
import { brandSchema, type Brand, type Project } from './model'
import { imageCreditSchema, type ImageCredit } from '../images/contract'
import { imageObjects } from '../images/credits'

function open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => {
  const request = indexedDB.open('post-machine-studio', 2)
  request.onupgradeneeded = () => { for (const name of ['projects', 'assets', 'settings', 'recovery']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name) }
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
}) }
async function transaction<T>(stores: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction) => () => T): Promise<T> {
  const db = await open()
  try { return await new Promise<T>((resolve, reject) => { const tx = db.transaction(stores, mode); tx.onabort = () => reject(tx.error ?? Error('Falha no armazenamento.')); const result = action(tx); tx.oncomplete = () => { try { resolve(result()) } catch (e) { reject(e) } } }) } finally { db.close() }
}
const dataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob) })
async function pack(project: Project) {
  const assets = new Map<string, Blob>()
  async function walk(value: unknown): Promise<unknown> {
    if (typeof value === 'string' && /^data:(image\/(png|jpeg|webp)|font\/woff2);base64,/.test(value)) {
      const [header, encoded] = value.split(','); const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0)); const blob = new Blob([bytes], { type: header.slice(5, header.indexOf(';')) })
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('')
      assets.set(hash, blob); return `asset:${hash}`
    }
    if (Array.isArray(value)) return Promise.all(value.map(walk))
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k, v]) => [k, k === 'imageCredit' ? v : await walk(v)])))
    return value
  }
  return { project: validateProject(await walk(validateProject(project))), assets }
}
async function hydrate(project: unknown, read: (id: string) => Promise<Blob | undefined>): Promise<Project> {
  const cache = new Map<string, string>()
  async function walk(value: unknown): Promise<unknown> {
    if (typeof value === 'string' && /^asset:[a-f0-9]{64}$/.test(value)) {
      if (!cache.has(value)) { const blob = await read(value.slice(6)); if (!blob) throw Error('Imagem ausente. Restaure um backup completo.'); cache.set(value, await dataUrl(blob)) }
      return cache.get(value)
    }
    if (Array.isArray(value)) return Promise.all(value.map(walk))
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k,v]) => [k, k === 'imageCredit' ? v : await walk(v)])))
    return value
  }
  return validateProject(await walk(validateProject(project)))
}
export function withStudioStorage<T>(action: () => Promise<T>): Promise<T> {
  return navigator.locks?.request('post-machine-studio-storage', action) ?? action()
}
export function saveProject(project: Project, expected?: Project) {
  return withStudioStorage(() => writeProject(project, expected))
}
async function writeProject(project: Project, expected?: Project) {
  const packed = await pack(project)
  const baseline = expected && JSON.stringify((await pack(expected)).project)
  const written = await transaction(['projects', 'assets', 'settings', 'recovery'], 'readwrite', tx => {
    let written = false
    const old = tx.objectStore('projects').get(project.id)
    old.onsuccess = () => {
      try {
        if (expected && (expected.id !== project.id || JSON.stringify(old.result && validateProject(old.result)) !== baseline)) return
        if (old.result && JSON.stringify(old.result) !== JSON.stringify(packed.project)) tx.objectStore('recovery').put(old.result, project.id)
        packed.assets.forEach((blob, id) => tx.objectStore('assets').put(blob, id))
        tx.objectStore('settings').put(packed.project.brand, 'brand')
        tx.objectStore('projects').put(packed.project, project.id)
        written = true
      } catch { tx.abort() }
    }
    return () => written
  })
  if (!written) throw Error('O projeto foi atualizado em outro lugar. Reabra o projeto antes de editar.')
}
export async function listProjects(): Promise<Project[]> { return transaction(['projects'], 'readonly', tx => { const req = tx.objectStore('projects').getAll(); return () => req.result.map(validateProject).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)) }) }
export function loadProject(id: string): Promise<Project> {
  return withStudioStorage(() => loadStoredProject(id, 'projects'))
}
async function loadStoredProject(id: string, store: 'projects' | 'recovery'): Promise<Project> {
  const value = await transaction([store], 'readonly', tx => { const req = tx.objectStore(store).get(id); return () => req.result as unknown })
  if (!value) throw Error(store === 'recovery' ? 'Ainda não existe versão anterior salva.' : 'Projeto não encontrado.')
  return hydrate(value, key => transaction(['assets'], 'readonly', tx => { const req = tx.objectStore('assets').get(key); return () => req.result as Blob | undefined }))
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
export function removeProject(id: string) {
  return withStudioStorage(() => transaction(['projects', 'recovery'], 'readwrite', tx => {
    tx.objectStore('projects').delete(id)
    tx.objectStore('recovery').delete(id)
    return () => undefined
  }))
}

export function inspectStorage(clean = false) {
  const inspect = () => withStudioStorage(() => transaction(['projects', 'recovery', 'settings', 'assets'], clean ? 'readwrite' : 'readonly', tx => {
    const projects = tx.objectStore('projects').getAll()
    const recovery = tx.objectStore('recovery').getAll()
    const settings = tx.objectStore('settings').get('brand')
    const assets = tx.objectStore('assets')
    const keys = assets.getAllKeys()
    const values = assets.getAll()
    let report: { projects: number; assets: number; bytes: number; orphans: number; recoverableBytes: number }
    let failure: unknown
    values.onsuccess = () => {
      try {
        const roots = [...projects.result, ...recovery.result]
        roots.forEach(validateProject)
        if (settings.result !== undefined) brandSchema.parse(settings.result)
        const references = new Set<string>()
        function visit(value: unknown) {
          if (typeof value === 'string' && /^asset:[a-f0-9]{64}$/.test(value)) references.add(value.slice(6))
          if (value && typeof value === 'object') Object.entries(value).forEach(([key, entry]) => { if (key !== 'imageCredit') visit(entry) })
        }
        roots.forEach(visit)
        visit(settings.result)
        const files = new Map(keys.result.map((key, index) => {
          const blob = values.result[index]
          if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key) || !(blob instanceof Blob) || !blob.size) throw Error('Arquivo do armazenamento inválido.')
          return [key, blob]
        }))
        if ([...references].some(key => !files.has(key))) throw Error('Existem referências a arquivos ausentes.')
        let bytes = 0, orphans = 0, recoverableBytes = 0
        for (const [key, blob] of files) {
          bytes += blob.size
          if (references.has(key)) continue
          orphans++
          recoverableBytes += blob.size
          if (clean) assets.delete(key)
        }
        report = { projects: projects.result.length, assets: files.size, bytes, orphans, recoverableBytes }
      } catch (error) { failure = error; if (clean) tx.abort() }
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
export async function backupProject(project: Project): Promise<Blob> {
  const packed = await pack(project); const zip = new JSZip()
  zip.file('project.json', JSON.stringify(packed.project))
  for (const [id, blob] of packed.assets) zip.file(`assets/${id}`, await blob.arrayBuffer())
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
export async function restoreProject(file: File): Promise<Project> {
  if (file.size > 150_000_000) throw Error('Backup excede 150 MB.')
  const zip = await JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: true })
  if (Object.keys(zip.files).length > 500) throw Error('Backup excede o limite de arquivos.')
  const json = await zip.file('project.json')?.async('string')
  if (!json || json.length > 20_000_000) throw Error('Projeto ausente ou excede 20 MB.')
  let total = json.length
  const project = await hydrate(JSON.parse(json), async id => {
    const data = await zip.file(`assets/${id}`)?.async('uint8array'); if (!data) return undefined
    total += data.byteLength; if (data.byteLength > 20_000_000 || total > 150_000_000) throw Error('Imagens do backup excedem o limite.')
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(data).buffer))].map(n => n.toString(16).padStart(2,'0')).join('')
    if (hash !== id) throw Error('Imagem corrompida no backup.')
    const font = String.fromCharCode(...data.slice(0,4)) === 'wOF2'
    const png = data[0] === 137 && data[1] === 80; const jpeg = data[0] === 255 && data[1] === 216
    return new Blob([data as BlobPart], { type: font ? 'font/woff2' : png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp' })
  })
  project.id = crypto.randomUUID(); project.name = `${project.name.slice(0, 85)} (restaurado)`; project.updatedAt = new Date().toISOString()
  await saveProject(project); return project
}

export function loadRecovery(id: string): Promise<Project> {
  return withStudioStorage(() => loadStoredProject(id, 'recovery'))
}
