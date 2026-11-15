import JSZip from 'jszip'
import { validateProject } from './validation'
import { brandSchema, type Brand, type Project } from './model'

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
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await walk(v)])))
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
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k,v]) => [k, await walk(v)])))
    return value
  }
  return validateProject(await walk(validateProject(project)))
}
export async function saveProject(project: Project) {
  const packed = await pack(project)
  await transaction(['projects', 'assets', 'settings', 'recovery'], 'readwrite', tx => {
    packed.assets.forEach((blob, id) => tx.objectStore('assets').put(blob, id))
    const old = tx.objectStore('projects').get(project.id)
    old.onsuccess = () => { try { if (old.result && JSON.stringify(old.result) !== JSON.stringify(packed.project)) tx.objectStore('recovery').put(old.result, project.id); tx.objectStore('projects').put(packed.project, project.id) } catch { tx.abort() } }
    tx.objectStore('settings').put(project.brand, 'brand')
    return () => undefined
  })
}
export async function listProjects(): Promise<Project[]> { return transaction(['projects'], 'readonly', tx => { const req = tx.objectStore('projects').getAll(); return () => req.result.map(validateProject).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)) }) }
export async function loadProject(id: string): Promise<Project> {
  const value = await transaction(['projects'], 'readonly', tx => { const req = tx.objectStore('projects').get(id); return () => req.result as unknown })
  return hydrate(value, key => transaction(['assets'], 'readonly', tx => { const req = tx.objectStore('assets').get(key); return () => req.result as Blob | undefined }))
}
export async function readBrand(): Promise<Brand | undefined> { return transaction(['settings'], 'readonly', tx => { const req = tx.objectStore('settings').get('brand'); return () => req.result ? brandSchema.parse(req.result) : undefined }) }
export async function removeProject(id: string) { return transaction(['projects'], 'readwrite', tx => { tx.objectStore('projects').delete(id); return () => undefined }) }
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

export async function loadRecovery(id: string): Promise<Project> {
  const value = await transaction(['recovery'], 'readonly', tx => { const req = tx.objectStore('recovery').get(id); return () => req.result as unknown })
  if (!value) throw Error('Ainda não existe versão anterior salva.')
  return hydrate(value, key => transaction(['assets'], 'readonly', tx => { const req = tx.objectStore('assets').get(key); return () => req.result as Blob | undefined }))
}
