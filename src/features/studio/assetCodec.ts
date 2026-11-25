import { validateProject } from './validation'
import type { Project } from './model'

const dataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob) })
export const assetRef = /^asset:([a-f0-9]{64})$/
type StoredProject = ReturnType<typeof validateProject>
type RewriteAsset = (source: string, replace: (value: string) => void) => void
export type EncodedAsset = Awaited<ReturnType<typeof encodeAsset>>
export function mapAssetFields<T>(value: T, rewrite: RewriteAsset, fields?: readonly string[]): T {
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

export function mapProjectAssets(project: Project, rewrite: RewriteAsset): Project {
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

export async function pack(project: Project, knownAssets?: ReadonlyMap<string, EncodedAsset>) {
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

export async function hydrate(stored: StoredProject, read: (id: string) => Promise<Blob | undefined>, knownAssets?: Map<string, EncodedAsset>): Promise<Project> {
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
