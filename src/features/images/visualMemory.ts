import { transaction } from '../studio/database'
import type { DocumentaryAsset } from './documentaryContract'
import type { ImageCredit } from './contract'
import type { VisualMatch } from './automaticSearch'

export type RememberedVisual = { asset: Omit<DocumentaryAsset, 'ticket'>; credit: ImageCredit; blob: Blob; approved?: boolean; match?: VisualMatch }
type Entry = RememberedVisual & { scope: string; seen: number }
export const visualStore = 'visualMemory'
const maxSize = 30_000_000
const maxAge = 24 * 60 * 60_000

export function readVisualMemory(scope: string) {
  return transaction([visualStore], 'readonly', tx => {
    const request = tx.objectStore(visualStore).index('scope').getAll(scope)
    return () => (request.result as Entry[]).filter(item => Date.now() - item.seen < maxAge)
      .sort((a, b) => Number(!!b.approved) - Number(!!a.approved) || b.seen - a.seen).slice(0, 24)
  })
}

export function clearVisualMemory() {
  return transaction([visualStore], 'readwrite', tx => {
    tx.objectStore(visualStore).clear()
    return () => undefined
  })
}

export function rememberVisual(scope: string, candidate: DocumentaryAsset, credit: ImageCredit, blob: Blob,
  match?: VisualMatch, approved = false) {
  if (blob.size > 5_000_000 || candidate.provider === 'brave') return Promise.resolve()
  const asset = { ...candidate }
  delete (asset as Partial<DocumentaryAsset>).ticket
  return transaction([visualStore], 'readwrite', tx => {
    const store = tx.objectStore(visualStore)
    const seen = Date.now()
    const request = store.getAll()
    request.onsuccess = () => {
      const identity = [scope, credit.sourceId]
      const entries = (request.result as Entry[]).sort((a, b) => b.seen - a.seen)
      const prior = entries.find(old => seen - old.seen < maxAge && old.scope === scope && old.credit.sourceId === credit.sourceId)
      if (prior?.approved && !approved) return
      let size = blob.size
      let count = 1
      for (const old of entries) {
        if (old.scope === scope && old.credit.sourceId === credit.sourceId) continue
        if (seen - old.seen >= maxAge || size + old.blob.size > maxSize || count >= 32) store.delete([old.scope, old.credit.sourceId])
        else { size += old.blob.size; count++ }
      }
      store.put({ scope, seen, asset, credit, blob, match: match ?? prior?.match, approved: approved || prior?.approved } satisfies Entry, identity)
    }
    return () => undefined
  })
}
