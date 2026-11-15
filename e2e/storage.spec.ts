import { expect, test } from '@playwright/test'

test('limpeza preserva imagens compartilhadas, marca e checkpoints', async ({ page }) => {
  await page.goto('/#/studio')
  await page.getByRole('button', { name: 'Criar projeto vazio' }).waitFor()
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 100
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'))
    const ids = ['a', 'b', 'c', 'd'].map(letter => letter.repeat(64))
    const brand = { name: '', handle: '', primary: '#163f35', secondary: '#d8ed91', background: '#f7f5ec', headingFont: 'Inter', bodyFont: 'Inter', margin: 80, logo: null, fonts: [] }
    const project = (name: string, asset: string) => ({ schemaVersion: 1, id: crypto.randomUUID(), name, format: 'portrait', brand, campaignId: null, campaignUpdatedAt: null, updatedAt: new Date().toISOString(), slides: [{ id: crypto.randomUUID(), layout: 'blank', role: 'content', imageBrief: '', scene: { background: '#ffffff', objects: asset ? [{ type: 'Image', src: 'asset:' + asset, width: 100, height: 100, left: 200, top: 200 }] : [] } }] })
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('post-machine-studio', 2)
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
  await expect(page.getByRole('status')).toContainText('Não foi possível')
  await page.getByRole('button', { name: 'Verificar armazenamento' }).click()
  await expect(page.getByText(/1 arquivos sem referência/)).toBeVisible()
  await page.getByRole('button', { name: 'Limpar arquivos órfãos' }).click()
  await expect(page.getByText(/3 arquivos de imagem ou fonte/)).toBeVisible()
  await page.getByRole('button', { name: 'Abrir Projeto B' }).click()
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue('Projeto B')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar PNG', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('Projeto-B-01.png')
  await page.getByRole('button', { name: 'Recuperar versão anterior' }).click()
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue('Checkpoint')
})
