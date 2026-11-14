import { backupSchema, type Backup, type Draft, type Preferences } from './contract'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('post-machine-campaigns', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('campaigns', { keyPath: 'id' })
      request.result.createObjectStore('settings')
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
      schemaVersion: 1, campaigns: campaigns.result,
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
