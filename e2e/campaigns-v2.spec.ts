import { test, expect } from '@playwright/test'
import { newDraft, defaultPreferences } from '../src/features/campaigns/contract'

test('campanha independente preserva edições rápidas após navegação e recarga', async ({ page }) => {
  await page.goto('/#/radar')
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).click()
  await page.getByLabel('Título do briefing').fill('Ideia independente')
  await page.getByLabel('Público-alvo').fill('Designers e artistas')
  await page.getByLabel('Orientações adicionais').fill('Texto final após edições rápidas')
  await page.getByRole('navigation').getByRole('link', { name: 'Studio' }).click()
  await page.getByRole('navigation').getByRole('link', { name: 'Radar' }).click()
  await expect(page.getByText('Salvo neste navegador.')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Pautas e prompts', exact: true }).click()
  await page.getByRole('button', { name: /Ideia independente/ }).click()
  await expect(page.getByLabel('Público-alvo')).toHaveValue('Designers e artistas')
  await expect(page.getByLabel('Orientações adicionais')).toHaveValue('Texto final após edições rápidas')
  await expect(page.getByRole('region', { name: 'Notícia de origem' })).toHaveCount(0)
})

test('migra IndexedDB v1 e restaura backup v1 sem substituir campanhas', async ({ page }) => {
  const item = newDraft(null, defaultPreferences)
  const legacy = { ...item, schemaVersion: 1, article: {
    id: '0'.repeat(32), title: 'Legado preservado', source: 'Fixture', category: 'Design', feedId: 'fixture',
    url: 'https://example.com/artigo', canonicalUrl: 'https://example.com/artigo', collectedAt: item.createdAt, publishedAt: null,
  } }
  await page.goto('/')
  await page.evaluate(async draft => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('post-machine-campaigns')
      req.onsuccess = () => resolve(); req.onerror = () => reject(req.error)
    })
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('post-machine-campaigns', 1)
      req.onupgradeneeded = () => { req.result.createObjectStore('campaigns', { keyPath: 'id' }); req.result.createObjectStore('settings') }
      req.onsuccess = () => {
        const tx = req.result.transaction('campaigns', 'readwrite'); tx.objectStore('campaigns').put(draft)
        tx.oncomplete = () => { req.result.close(); resolve() }; tx.onabort = () => reject(tx.error)
      }
    })
  }, legacy)
  await page.goto('/#/radar'); await page.reload()
  await page.getByRole('button', { name: 'Pautas e prompts' }).click()
  await page.getByRole('button', { name: /Legado preservado/ }).click()
  await expect(page.getByLabel('Título do briefing')).toHaveValue('Legado preservado')
  await page.getByLabel('Restaurar backup JSON').setInputFiles({ name: 'v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, campaigns: [legacy], preferences: defaultPreferences })) })
  await expect(page.getByRole('button', { name: /Legado preservado/ })).toHaveCount(2)
})
