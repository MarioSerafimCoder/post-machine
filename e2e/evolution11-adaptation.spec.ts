import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

async function downloadFrom(page: Page, action: () => Promise<unknown>, warnings = false) {
  const download = page.waitForEvent('download')
  const warningButton = button(page, 'Exportar com avisos')
  await action()
  if (warnings && await Promise.race([download.then(() => false), warningButton.waitFor().then(() => true)])) await warningButton.click()
  return readFile(await (await download).path())
}

async function projectWithMedia(page: Page) {
  await page.goto('/#/studio')
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 960; canvas.height = 640
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#cad0dd'; ctx.fillRect(0, 0, 960, 640)
    ctx.fillStyle = '#313750'; ctx.fillRect(320, 80, 400, 420)
    return canvas.toDataURL().split(',')[1]
  }), 'base64')
  const font = await readFile('public/fonts/inter-regular.woff2')
  const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex')
  const family = 'Marca-' + hash(font).slice(0, 12)
  const now = new Date().toISOString()
  const manifest = {
    schemaVersion: 1, assetEncoding: 'media-v1', id: 'e283bca0-5ec3-4b60-80fc-3bc75246dd10', name: 'Recorte de direção',
    format: 'portrait', updatedAt: now, caption: 'Legenda de teste.', campaignId: null, campaignUpdatedAt: null,
    brand: { name: '', handle: '', primary: '#111111', secondary: '#d60016', background: '#ffffff', margin: 80, logo: null,
      headingFont: family, bodyFont: family, fonts: [{ family, name: 'Inter de teste', source: 'asset:' + hash(font) }],
    },
    slides: [0, 1].map(index => ({
      id: ['e283bca0-5ec3-4b60-80fc-3bc75246dd11', 'e283bca0-5ec3-4b60-80fc-3bc75246dd12'][index],
      layout: 'author-v1', imageBrief: 'Uma fachada com luz natural.', role: 'content',
      scene: { background: '#ffffff', objects: [
        { type: 'Textbox', originX: 'left', originY: 'top', left: 80, top: 80, width: 920, text: 'Arquitetura e ritmo',
          fontSize: 78, fontFamily: family, fill: '#111111', semantic: 'title', templateRole: 'title' },
        { type: 'Image', src: 'asset:' + hash(png), originX: 'left', originY: 'top', left: 80, top: 290,
          width: 960, height: 640, scaleX: .9, scaleY: .9, semantic: 'image', templateRole: 'image',
          imageCredit: { schemaVersion: 1, provider: 'openverse', sourceId: 'e283bca0-5ec3-4b60-80fc-3bc75246dd13',
            retrievedAt: now, title: 'Fachada de teste', creator: 'Autor da fixture', license: 'by', licenseVersion: '4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' } },
        { type: 'Textbox', originX: 'left', originY: 'top', left: 80, top: 1020, width: 900, fontSize: 34,
          fontFamily: family, fill: '#111111', text: 'As aberturas definem a leitura da fachada.', semantic: 'body', templateRole: 'body' },
      ] },
    })),
  }
  const backup = await new JSZip().file('project.json', JSON.stringify(manifest))
    .file('assets/' + hash(png), png, { createFolders: false }).file('assets/' + hash(font), font, { createFolders: false }).generateAsync({ type: 'nodebuffer' })
  await page.getByLabel('Restaurar projeto ZIP').setInputFiles({ name: 'projeto.zip', mimeType: 'application/zip', buffer: backup })
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue('Recorte de direção (restaurado)')
  return { original: manifest, pngHash: hash(png), fontHash: hash(font) }
}

test('compara, audita e exporta quadrado e story com fonte, imagem e créditos intactos', async ({ page }) => {
  test.setTimeout(60_000)
  const { original, pngHash, fontHash } = await projectWithMedia(page)
  const openAdaptation = async () => {
    await page.getByText('Mais ações', { exact: true }).click()
    await button(page, 'Adaptar formato').click()
    return page.getByRole('dialog', { name: 'Adaptar formato' })
  }
  for (const [format, height, caption] of [['square', 1080, 'Quadrado'], ['story', 1920, 'Story']] as const) {
    const comparison = await openAdaptation()
    await comparison.getByLabel('Formato de destino').selectOption(format)
    await expect(comparison.getByRole('img', { name: 'Original, slide 1' })).toBeVisible()
    await expect(comparison.getByRole('img', { name: 'Adaptado, slide 1' })).toBeVisible()
    await expect(comparison.getByRole('region', { name: 'Auditoria da adaptação' })).not.toContainText('Texto excede a área')
    await expect(comparison.getByRole('region', { name: 'Auditoria da adaptação' })).not.toContainText('Texto fora da margem segura')
    await comparison.getByLabel('Slide para comparar').selectOption('1')
    await expect(comparison.getByRole('img', { name: 'Adaptado, slide 2' })).toBeVisible()
    await button(page, 'Salvar cópia e editar no Studio').click()
    await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue(new RegExp(caption + '$'))
    await button(page, 'Finalizar e exportar').click()
    const png = await downloadFrom(page, () => button(page, 'Exportar PNG').click(), true)
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, height])
    const zip = await JSZip.loadAsync(await downloadFrom(page, () => button(page, 'Exportar ZIP').click(), true))
    expect(await zip.file('creditos.txt')!.async('string')).toContain('Autor da fixture')
    expect(zip.filter(path => path.endsWith('.png'))).toHaveLength(2)
    await page.getByText('Mais ações', { exact: true }).click()
    const backup = await JSZip.loadAsync(await downloadFrom(page, () => button(page, 'Backup completo').click()))
    expect(backup.file('assets/' + pngHash)).toBeTruthy()
    expect(backup.file('assets/' + fontHash)).toBeTruthy()
    const design = JSON.parse(await backup.file('project.json')!.async('string'))
    const [title, image, body] = design.slides[0].scene.objects
    expect([title.text, body.text]).toEqual([original.slides[0].scene.objects[0].text, original.slides[0].scene.objects[2].text])
    expect(title.fontFamily).toBe(original.brand.headingFont)
    expect(image.scaleX).toBeCloseTo(image.scaleY, 4)
    expect(image.top).not.toBe(290)
    await button(page, 'Projetos').click()
    await button(page, 'Abrir Recorte de direção (restaurado)').click()
    await expect(page.getByText('Retrato · 1080 × 1350', { exact: true })).toBeVisible()
  }
})

test('salva variante de um template e oferece a composição correspondente ao formato', async ({ page }) => {
  const { pngHash, fontHash } = await projectWithMedia(page)
  await page.getByText('Mais ações', { exact: true }).click()
  await button(page, 'Salvar como template').click()
  await page.getByLabel('Nome do template').fill('Família editorial')
  await button(page, 'Salvar template').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await button(page, 'Projetos').click()
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  await button(page, 'Usar template').click()
  const library = page.getByRole('region', { name: 'Meus templates' })
  const original = library.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Família editorial', exact: true }) })
  await original.getByText('Gerenciar template').click()
  const templateArchive = await JSZip.loadAsync(await downloadFrom(page, () => original.getByRole('button', { name: 'Exportar backup' }).click()))
  expect(templateArchive.file('assets/' + pngHash)).toBeTruthy()
  expect(templateArchive.file('assets/' + fontHash)).toBeTruthy()
  await original.getByRole('button', { name: 'Adaptar formato' }).click()
  await button(page, 'Salvar como variante').click()
  await expect(library.getByRole('heading', { name: 'Família editorial · Quadrado' })).toBeVisible()
  await original.getByRole('button', { name: 'Adaptar formato' }).click()
  await expect(page.getByRole('dialog').getByText('Variante autoral · Quadrado')).toBeVisible()
  await button(page, 'Usar variante existente').click()
  await expect(page.getByRole('region', { name: 'Editor Studio' }).getByText('Quadrado · 1080 × 1080', { exact: true })).toBeVisible()
})
