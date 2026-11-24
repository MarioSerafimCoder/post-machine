import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { emptySlide, newProject } from '../src/features/studio/model'

test('migra o acervo, isola registro inválido e retoma a edição mais recente sem regravar mídia', async ({ page }) => {
  const original = { ...newProject(), name: 'Primeiro projeto', updatedAt: '2020-01-01T00:00:00.000Z', assetEncoding: 'media-v1' }
  const recent = { ...newProject(), name: 'Segundo projeto', updatedAt: '2021-01-01T00:00:00.000Z' }
  const damaged = { ...newProject(), name: 'Registro inválido', slides: [], updatedAt: '2020-01-01T00:00:00.000Z' }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jYioAAAAASUVORK5CYII=', 'base64')
  const asset = createHash('sha256').update(png).digest('hex')
  original.slides.push({ ...emptySlide(), scene: { background: '#ffffff', objects: [{ type: 'Image', src: 'asset:' + asset }] } })
  await page.goto('/#/radar')
  await page.evaluate(async ({ projects, asset, bytes }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('post-machine-studio', 2)
      request.onupgradeneeded = () => {
        for (const name of ['projects', 'assets', 'settings', 'recovery']) request.result.createObjectStore(name)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const tx = db.transaction(['projects', 'assets'], 'readwrite')
      for (const project of projects) tx.objectStore('projects').put(project, project.id)
      tx.objectStore('assets').put(new Blob([new Uint8Array(bytes)], { type: 'image/png' }), asset)
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
    } finally { db.close() }
  }, { projects: [original, recent, damaged], asset, bytes: [...png] })
  await page.getByRole('link', { name: 'Início', exact: true }).click()
  const resume = page.getByRole('region', { name: 'Continue produzindo' })
  await expect(resume).toContainText(recent.name)
  if (await page.getByRole('dialog', { name: 'Finalizar projeto', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar exportação', exact: true }).click()
  await page.getByRole('link', { name: 'Auditoria', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Projetos com dados inválidos' })).toContainText(damaged.name)
  await expect(page.getByRole('button', { name: 'Revisar projeto: Primeiro projeto' })).toBeVisible()
  if (await page.getByRole('dialog', { name: 'Finalizar projeto', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar exportação', exact: true }).click()
  await page.getByRole('link', { name: 'Studio', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Projetos com dados inválidos' })).toContainText(damaged.name)
  await page.getByRole('button', { name: 'Abrir Primeiro projeto', exact: true }).click()
  const add = page.getByRole('button', { name: 'Adicionar slide', exact: true })
  await expect(add).toBeEnabled()
  await page.evaluate(() => {
    const counts = { digest: 0, assetWrites: 0 }
    Object.assign(window, { storageCounts: counts })
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    crypto.subtle.digest = (...args) => { counts.digest++; return digest(...args) }
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'assets') counts.assetWrites++
      return put.apply(this, args)
    }
  })
  await add.click()
  await page.getByRole('link', { name: 'Início', exact: true }).click()
  await expect(resume).toContainText(original.name)
  expect(await page.evaluate(() => Reflect.get(window, 'storageCounts'))).toEqual({ digest: 0, assetWrites: 0 })
})

test('limpeza preserva imagens compartilhadas, marca e checkpoints', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', cause => errors.push(cause.message))
  await page.goto('/#/studio')
  await page.getByText('＋ Novo projeto', { exact: true }).waitFor()
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 100
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'))
    const ids = ['a', 'b', 'c', 'd'].map(letter => letter.repeat(64))
    const brand = { name: '', handle: '', primary: '#163f35', secondary: '#d8ed91', background: '#f7f5ec', headingFont: 'Inter', bodyFont: 'Inter', margin: 80, logo: null, fonts: [] }
    const project = (name: string, asset: string) => ({ schemaVersion: 1, id: crypto.randomUUID(), name, format: 'portrait', brand, campaignId: null, campaignUpdatedAt: null, updatedAt: new Date().toISOString(), slides: [{ id: crypto.randomUUID(), layout: 'blank', role: 'content', imageBrief: '', scene: { background: '#ffffff', objects: asset ? [{ type: 'Image', src: 'asset:' + asset, width: 100, height: 100, left: 200, top: 200 }] : [] } }] })
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('post-machine-studio')
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error)
    })
    try {
      const tx = db.transaction(['projects', 'assets', 'settings', 'recovery'], 'readwrite')
      const one = project('Projeto A', ids[0]), two = project('Projeto B', ids[0])
      tx.objectStore('projects').put(one, one.id); tx.objectStore('projects').put(two, two.id)
      tx.objectStore('recovery').put({ ...project('Checkpoint', ids[1]), id: two.id }, two.id)
      tx.objectStore('settings').put({ ...brand, logo: 'asset:' + ids[2] }, 'brand')
      ids.forEach(id => tx.objectStore('assets').put(blob, id))
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
    } finally { db.close() }
  })
  await page.reload()
  page.on('dialog', dialog => dialog.accept())
  await page.getByText('•••', { exact: true }).and(page.getByLabel('Ações de Projeto A', { exact: true })).click()
  await page.getByRole('button', { name: 'Excluir Projeto A' }).click()
  await expect(page.getByRole('button', { name: 'Excluir Projeto A' })).toHaveCount(0)
  await page.getByText('Configurações de armazenamento').click()
  await page.getByRole('button', { name: 'Verificar armazenamento' }).click()
  await expect(page.getByText(/1 arquivos sem referência/)).toBeVisible()
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.delete
    const restore = () => { IDBObjectStore.prototype.delete = original }
    IDBObjectStore.prototype.delete = function (key) {
      if (this.name === 'assets') { restore(); this.transaction.abort() }
      return original.call(this, key)
    }
  })
  await page.getByRole('button', { name: 'Limpar arquivos órfãos' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Não foi possível' })).toBeVisible()
  await page.getByRole('button', { name: 'Verificar armazenamento' }).click()
  await expect(page.getByText(/1 arquivos sem referência/)).toBeVisible()
  await page.getByRole('button', { name: 'Limpar arquivos órfãos' }).click()
  await expect(page.getByText(/3 arquivos de imagem ou fonte/)).toBeVisible()
  await page.getByRole('button', { name: 'Abrir Projeto B' }).click()
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue('Projeto B')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Finalizar e exportar', exact: true }).click()
  await page.getByRole('button', { name: 'Exportar PNG', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('Projeto-B-01.png')
  if (await page.getByRole('dialog', { name: 'Finalizar projeto', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar exportação', exact: true }).click()
  await page.getByText('Mais ações', { exact: true }).click()
  await page.getByRole('button', { name: 'Recuperar versão anterior' }).click()
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue('Checkpoint')
  expect(errors).toEqual([])
})
