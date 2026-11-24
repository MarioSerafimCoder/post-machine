export const projectsChangedEvent = 'post-machine:projects-changed'

function open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => {
  const request = indexedDB.open('post-machine-studio', 7)
  let blocked = false
  request.onupgradeneeded = event => {
    for (const name of ['projects', 'assets', 'settings', 'recovery', 'projectLibrary', 'expressDrafts', 'expressPhotos', 'authorTemplates']) {
      if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name)
    }
    if (event.oldVersion < 3) request.transaction!.objectStore('projects').createIndex('updatedAt', 'updatedAt')
    if (event.oldVersion < 7) request.result.createObjectStore('visualMemory').createIndex('scope', 'scope')
  }
  request.onsuccess = () => {
    const db = request.result
    if (blocked) { db.close(); return }
    db.onversionchange = () => db.close()
    resolve(db)
  }
  request.onerror = () => reject(request.error)
  request.onblocked = () => {
    blocked = true
    reject(Error('Feche outras abas do Post Machine para atualizar o armazenamento.'))
  }
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

export function recentProjects() {
  return transaction(['projects'], 'readonly', tx => {
    const latest: { id: string; name: string; updatedAt: string; slideCount: number }[] = []
    const request = tx.objectStore('projects').index('updatedAt').openCursor(null, 'prev')
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      const { id, name, updatedAt, slides } = (cursor.value ?? {}) as Record<string, unknown>
      if (id === cursor.primaryKey && typeof id === 'string' && typeof name === 'string' &&
          typeof updatedAt === 'string' && Number.isFinite(Date.parse(updatedAt))) {
        latest.push({ id, name, updatedAt, slideCount: Array.isArray(slides) ? slides.length : 0 })
      }
      if (latest.length < 3) cursor.continue()
    }
    return () => latest
  })
}

export function hasIndependentPreparation() {
  return transaction(['expressDrafts'], 'readonly', tx => {
    const request = tx.objectStore('expressDrafts').getKey('independent')
    return () => request.result !== undefined
  })
}
