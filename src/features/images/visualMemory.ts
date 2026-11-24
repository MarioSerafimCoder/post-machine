import { transaction } from '../studio/database'
import type { DocumentaryAsset } from './documentaryContract'
import type { ImageCredit } from './contract'

export type RememberedVisual = { asset: Omit<DocumentaryAsset, 'ticket'>; credit: ImageCredit; blob: Blob }
type Entry = RememberedVisual & { scope: string; seen: number }
export const visualStore = 'visualMemory'
const maxSize = 30_000_000
const maxAge = 24 * 60 * 60_000

export function readVisualMemory(scope: string) {
  return transaction([visualStore], 'readonly', tx => {
    const request = tx.objectStore(visualStore).index('scope').getAll(scope, 24)
    return () => (request.result as Entry[]).filter(item => Date.now() - item.seen < maxAge)
  })
}

export function rememberVisual(scope: string, candidate: DocumentaryAsset, credit: ImageCredit, blob: Blob) {
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
      let size = blob.size
      let count = 1
      for (const old of entries) {
        if (old.scope === scope && old.credit.sourceId === credit.sourceId) continue
        if (seen - old.seen >= maxAge || size + old.blob.size > maxSize || count >= 32) store.delete([old.scope, old.credit.sourceId])
        else { size += old.blob.size; count++ }
      }
      store.put({ scope, seen, asset, credit, blob } satisfies Entry, identity)
    }
    return () => undefined
  })
}
