export const projectsChangedEvent = 'post-machine:projects-changed'

function open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => {
  const request = indexedDB.open('post-machine-studio', 6)
  request.onupgradeneeded = event => {
    for (const name of ['projects', 'assets', 'settings', 'recovery', 'projectLibrary', 'expressDrafts', 'expressPhotos', 'authorTemplates']) {
      if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name)
    }
    if (event.oldVersion < 3) request.transaction!.objectStore('projects').createIndex('updatedAt', 'updatedAt')
  }
  request.onsuccess = () => {
    const db = request.result
    db.onversionchange = () => db.close()
    resolve(db)
  }
  request.onerror = () => reject(request.error)
  request.onblocked = () => reject(Error('Feche outras abas do Post Machine para atualizar o armazenamento.'))
}) }
export function abortTransaction(transaction: IDBTransaction) {
  try { transaction.abort() }
  catch (cause) {
    if (!(cause instanceof DOMException && cause.name === 'InvalidStateError')) throw cause
  }
}
export async function transaction<T>(stores: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction) => () => T): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode)
      tx.onabort = () => reject(tx.error ?? Error('Falha no armazenamento.'))
      try {
        const result = action(tx)
        tx.oncomplete = () => { try { resolve(result()) } catch (cause) { reject(cause) } }
      } catch (cause) {
        reject(cause)
        abortTransaction(tx)
      }
    })
  } finally { db.close() }
}

export function latestProject() {
  return transaction(['projects'], 'readonly', tx => {
    let latest: { id: string; name: string; updatedAt: string } | undefined
    const request = tx.objectStore('projects').index('updatedAt').openCursor(null, 'prev')
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      const { id, name, updatedAt } = (cursor.value ?? {}) as Record<string, unknown>
      if (id === cursor.primaryKey && typeof id === 'string' && typeof name === 'string' &&
          typeof updatedAt === 'string' && Number.isFinite(Date.parse(updatedAt))) {
        latest = { id, name, updatedAt }
        return
      }
      cursor.continue()
    }
    return () => latest
  })
}
