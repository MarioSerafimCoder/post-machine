import type { Draft } from '../campaigns/contract'
import { abortTransaction, transaction } from './database'
import type { CollectionSlide } from './collections'
import type { Format } from './model'

export type ExpressSlide = CollectionSlide & { key: string; imageId?: string | null }
export type ExpressPhoto = { id: string; name: string; bytes: number; object: Record<string, unknown>; file: Blob }
type DraftFields = {
  text: string; slides: ExpressSlide[]; linked?: Draft; name: string; caption?: string
  styleId: string; format: Format; step: string; origin: 'local' | 'openverse' | 'library' | 'url'
}
export type ExpressDraft = DraftFields & { photos: ExpressPhoto[] }
type StoredDraft = DraftFields & { revision: string; photoIds: string[] }
const stores = ['expressDrafts', 'expressPhotos']
const photoKey = (slot: string, id: string) => [slot, id]

export function openExpressDraft(slot: string) {
  let revision: string | undefined
  let photos: ExpressPhoto[] = []
  return {
    async load() {
      const entry = await loadExpressDraft(slot)
      revision = entry?.revision
      photos = entry?.draft.photos ?? []
      return entry?.draft
    },
    hasSaved: () => revision !== undefined,
    async save(draft: ExpressDraft) {
      revision = await storeExpressDraft(slot, draft, revision, photos)
      photos = draft.photos
    },
    async clear() {
      revision = await storeExpressDraft(slot, undefined, revision, photos)
      photos = []
    },
  }
}

function readDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function loadExpressDraft(slot: string) {
  const stored = await transaction(stores, 'readonly', tx => {
    const request = tx.objectStore('expressDrafts').get(slot)
    const assets: IDBRequest[] = []
    request.onsuccess = () => {
      const draft = request.result as StoredDraft | undefined
      for (const id of draft?.photoIds ?? []) assets.push(tx.objectStore('expressPhotos').get(photoKey(slot, id)))
    }
    return () => ({ draft: request.result as StoredDraft | undefined, photos: assets.map(asset => asset.result as ExpressPhoto | undefined) })
  })
  if (!stored.draft) return undefined
  const { revision, photoIds, ...fields } = stored.draft
  const photos = await Promise.all(stored.photos.map(async (photo, index) => {
    if (!photo || photo.id !== photoIds[index]) throw Error('Uma imagem do rascunho está indisponível.')
    return { ...photo, object: { ...photo.object, src: await readDataUrl(photo.file) } }
  }))
  return { revision, draft: { ...fields, photos } }
}

export async function storeExpressDraft(slot: string, draft: ExpressDraft | undefined,
  expected: string | undefined, previousPhotos: readonly ExpressPhoto[]) {
  const revision = draft && crypto.randomUUID()
  const written = await transaction(stores, 'readwrite', tx => {
    const drafts = tx.objectStore('expressDrafts')
    const assets = tx.objectStore('expressPhotos')
    const request = drafts.get(slot)
    let updated = false
    request.onsuccess = () => {
      const before = request.result as StoredDraft | undefined
      if (before?.revision !== expected) return
      try {
        const photoIds = new Set(draft?.photos.map(photo => photo.id))
        for (const id of before?.photoIds ?? []) if (!photoIds.has(id)) assets.delete(photoKey(slot, id))
        if (draft) {
          const { photos, ...fields } = draft
          const previous = new Map(previousPhotos.map(photo => [photo.id, photo]))
          for (const photo of photos) {
            if (previous.get(photo.id) === photo) continue
            const object = { ...photo.object }
            delete object.src
            assets.put({ ...photo, object }, photoKey(slot, photo.id))
          }
          drafts.put({ ...fields, revision, photoIds: [...photoIds] }, slot)
        } else drafts.delete(slot)
        updated = true
      } catch { abortTransaction(tx) }
    }
    return () => updated
  })
  if (!written) throw Error('Outra aba alterou este rascunho. Abra a preparação novamente para recuperar a última versão.')
  return revision
}

export function reconcileExpressSlides(values: CollectionSlide[], previous: ExpressSlide[], newKey: () => string): ExpressSlide[] {
  const signature = (slide: CollectionSlide) => JSON.stringify([slide.role ?? '', slide.title.trim(), slide.body.trim(), slide.imageBrief?.trim() ?? ''])
  const matches = new Map<string, ExpressSlide[]>()
  for (const slide of previous) {
    const id = signature(slide)
    matches.set(id, [...matches.get(id) ?? [], slide])
  }
  const counts = new Map<string, number>()
  for (const slide of values) {
    const id = signature(slide)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return values.map(slide => {
    const id = signature(slide)
    const candidates = matches.get(id)
    const match = candidates?.length === 1 && counts.get(id) === 1 ? candidates[0] : undefined
    return { ...slide, key: match?.key ?? newKey(), imageId: match?.imageId, framing: match?.framing ?? slide.framing }
  })
}
