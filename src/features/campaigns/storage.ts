import { backupSchema, draftSchema, type Backup, type Draft, type Preferences } from './contract'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('post-machine-campaigns', 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('campaigns')) db.createObjectStore('campaigns', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings')
      const cursor = request.transaction!.objectStore('campaigns').openCursor()
      cursor.onsuccess = () => {
        const item = cursor.result
        if (!item) return
        const migrated = draftSchema.safeParse(item.value)
        if (!migrated.success) { request.transaction!.abort(); return }
        item.update(migrated.data)
        item.continue()
      }
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function transact<T>(mode: IDBTransactionMode, operation: (transaction: IDBTransaction) => () => T) {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(['campaigns', 'settings'], mode)
      transaction.onabort = () => reject(transaction.error)
      const result = operation(transaction)
      transaction.oncomplete = () => {
        try { resolve(result()) } catch (error) { reject(error) }
      }
    })
  } finally { db.close() }
}

export function readCampaigns() {
  return transact('readonly', transaction => {
    const campaigns = transaction.objectStore('campaigns').getAll()
    const preferences = transaction.objectStore('settings').get('preferences')
    return () => backupSchema.parse({
      schemaVersion: 2, campaigns: campaigns.result,
      preferences: preferences.result ?? { audience: '', tone: 'Profissional' },
    })
  })
}

export function putCampaign(draft: Draft) {
  return transact('readwrite', transaction => {
    transaction.objectStore('campaigns').put(draft)
    return () => undefined
  })
}

export function readCampaign(id: string) {
  return transact('readonly', transaction => {
    const request = transaction.objectStore('campaigns').get(id)
    return () => request.result ? draftSchema.parse(request.result) : undefined
  })
}

export function deleteCampaign(id: string) {
  return transact('readwrite', transaction => {
    transaction.objectStore('campaigns').delete(id)
    return () => undefined
  })
}

export function putPreferences(preferences: Preferences) {
  return transact('readwrite', transaction => {
    transaction.objectStore('settings').put(preferences, 'preferences')
    return () => undefined
  })
}

export function restoreCampaigns(backup: Backup) {
  return transact('readwrite', transaction => {
    const store = transaction.objectStore('campaigns')
    for (const campaign of backup.campaigns) {
      const request = store.getKey(campaign.id)
      request.onsuccess = () => {
        const copy = request.result === undefined ? campaign : { ...campaign, id: crypto.randomUUID() }
        store.add(copy)
      }
    }
    transaction.objectStore('settings').put(backup.preferences, 'preferences')
    return () => undefined
  })
}
