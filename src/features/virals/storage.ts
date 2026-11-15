import { duplicates, librarySchema, referenceSchema, type Reference } from './contract'

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, list: Reference[]) => T) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('post-machine-virals', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('references', { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(Error('Feche outras abas do Post Machine e tente novamente.'))
  })
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('references', mode)
      const store = tx.objectStore('references')
      const request = store.getAll()
      let result: T, failure: unknown
      request.onsuccess = () => {
        try { result = action(store, librarySchema.parse({ schemaVersion: 1, references: request.result }).references) }
        catch (cause) { failure = cause; tx.abort() }
      }
      tx.oncomplete = () => resolve(result)
      tx.onabort = () => reject(failure || tx.error || Error('A biblioteca não pôde ser salva.'))
    })
  } finally { db.close() }
}

export const listReferences = () => transact('readonly', (_store, list) => list)
export const writeReference = (input: Reference) => transact('readwrite', (store, list) => {
  const value = referenceSchema.parse(input)
  if (list.some(item => item.id !== value.id && duplicates(value, item))) throw Error('Já existe uma referência para esse conteúdo.')
  if (list.length >= 2000 && !list.some(item => item.id === value.id)) throw Error('O limite de 2.000 referências foi atingido.')
  store.put(value)
  return [...list.filter(item => item.id !== value.id), value]
})
export const removeReference = (id: string) => transact('readwrite', (store, list) => {
  store.delete(id)
  return list.filter(item => item.id !== id)
})
export const restoreReferences = (raw: unknown) => {
  const { references } = librarySchema.parse(raw)
  return transact('readwrite', (store, list) => {
    const next = [...list]
    for (const item of references) {
      if (next.some(saved => duplicates(saved, item))) continue
      if (next.length >= 2000) throw Error('A restauração excede o limite da biblioteca.')
      const value = next.some(saved => saved.id === item.id) ? { ...item, id: crypto.randomUUID() } : item
      store.add(value)
      next.push(value)
    }
    return { list: next, added: next.length - list.length }
  })
}
