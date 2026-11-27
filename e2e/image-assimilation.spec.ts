import { expect, test, type Page } from '@playwright/test'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'

const source = 'https://www.geico.com/work/prisma/'
const title = 'Oficina Prisma'
function picture(seed: number) {
  const canvas = createCanvas(900, 720), context = canvas.getContext('2d')
  context.fillStyle = '#f5e7c6'; context.fillRect(0, 0, 900, 720)
  for (let index = 0; index < 16; index++) {
    context.fillStyle = index % 2 ? '#1d3640' : '#c92c42'
    context.fillRect((index * 163 + seed * 211) % 820, (index * index * 67 + seed * 97) % 620, 45 + index * 8, 60 + seed * 10)
  }
  return canvas.toBuffer('image/png')
}
const asset = (index: number) => ({ url: `https://www.geico.com/work/panel-${index}.png`, page: source,
  provider: 'official', evidence: 'figure', caption: `Oficina Prisma painel ${index}`, title, width: 900, height: 720, ticket: `panel-${index}` })
const hint = (index: number) => ({ imageUrl: asset(index).url, sourceUrl: source, description: `Painel ${index}` })
const content = (count: number) => ({ schemaVersion: 1, campaign: { title, audience: '', objective: 'Informar', tone: 'Profissional',
  format: count > 1 ? 'carousel' : 'post', caption: '', cta: '', visualContext: { campaignName: title, subject: title } }, sources: [],
slides: Array.from({ length: count }, (_, index) => ({ id: `panel-${index}`, order: index + 1, role: index ? 'content' : 'cover',
  title: `Painel ${index}`, body: 'Texto editorial de teste.', imageBrief: `Painel ${index}`, layoutType: 'photo',
  visualContext: { documentaryRequired: true, visualCandidates: [hint(index)] } })) })
async function importCampaign(page: Page, data: unknown) {
  await page.goto('/#/inicio')
  await page.getByRole('button', { name: /^Criar conteúdo/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Importar conteúdo' }).click()
  await page.getByLabel('Cole aqui o conteúdo do seu post ou carrossel').fill(JSON.stringify(data))
  await expect(page.getByRole('region', { name: 'Editor Studio' })).toBeVisible()
}
async function downloadBackup(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar backup ZIP', exact: true }).click()
  const bytes = await readFile(await (await download).path())
  const zip = await JSZip.loadAsync(bytes)
  return { bytes, project: JSON.parse(await zip.file('project.json')!.async('string')) }
}

test('arquivo identificado sem evidência do detalhe pede conferência e não afirma contradição ou ausência', async ({ page }) => {
  const data = content(1)
  data.slides[0].role = 'content'
  data.slides[0].imageBrief = 'Bastidores de Oficina Prisma'
  const discovered = { ...asset(0), caption: 'Estúdio fornecedor', title: 'Uma publicação em outro idioma' }
  await page.route('**/api/visual/page', route => route.fulfill({ json: { state: 'ok', candidates: [discovered] } }))
  await page.route('**/api/visual/download', route => route.fulfill({ contentType: 'image/png', body: picture(0) }))
  await importCampaign(page, data)
  const studio = page.getByRole('region', { name: 'Editor Studio' })
  await studio.getByRole('button', { name: 'Imagens', exact: true }).click()
  await expect(studio.getByText('Referência importada · conferir correspondência')).toBeVisible()
  await expect(studio.getByText(/A fonte identifica uma imagem incompatível|não foi identificado na extração/)).toHaveCount(0)
  await studio.getByRole('button', { name: 'Finalizar e exportar' }).click()
  await expect(studio.getByText('Finalização visual pendente')).toBeVisible()
})

test('edição manual da alternativa durante a busca preserva as formas e cancela a substituição tardia', async ({ page }) => {
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  let requested = false, downloads = 0
  await page.route('**/api/visual/page', async route => {
    requested = true
    await delayed
    await route.fulfill({ json: { state: 'ok', candidates: [asset(0)] } }).catch(() => undefined)
  })
  await page.route('**/api/visual/download', route => {
    downloads++
    return route.fulfill({ contentType: 'image/png', body: picture(0) })
  })
  await importCampaign(page, content(1))
  await expect.poll(() => requested).toBe(true)
  const studio = page.getByRole('region', { name: 'Editor Studio' })
  await studio.getByRole('button', { name: 'Camadas', exact: true }).click()
  await studio.locator('.studio-tools button[data-semantic="editorialAlternative"]').first().click()
  await studio.getByText('Propriedades avançadas', { exact: true }).click()
  await studio.getByLabel('X', { exact: true }).fill('120')
  release()
  const backup = await downloadBackup(page)
  expect(backup.project.slides[0].visualChoice.mode).toBe('manual')
  expect(backup.project.slides[0].scene.objects.filter((object: { semantic: string }) => object.semantic === 'editorialAlternative')
    .map((object: { left: number }) => object.left)).toContain(120)
  expect(backup.project.slides[0].scene.objects.some((object: { semantic: string }) => object.semantic === 'image')).toBe(false)
  expect(downloads).toBe(0)
})

for (const [http, state, expected] of [[504, undefined, /A busca demorou demais/], [403, undefined, /A fonte não permite acessar/],
  [200, 'not_found', /A página indicada não existe/], [200, 'ok', /arquivo indicado não foi identificado na extração/]] as const) {
  test(`explica falha de página ${state ?? http} e preenche a área visual`, async ({ page }) => {
    await page.route('**/api/visual/page', route => route.fulfill({ status: http, json: { state, candidates: [] } }))
    await page.route('**/api/visual/brave', route => route.fulfill({ json: { state: 'disabled', candidates: [] } }))
    await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { results: [], page_count: 0 } }))
    await importCampaign(page, content(1))
    const studio = page.getByRole('region', { name: 'Editor Studio' })
    await studio.getByRole('button', { name: 'Imagens', exact: true }).click()
    await expect(studio.getByText(expected)).toBeVisible()
    await expect(studio.getByText('Alternativa editorial · composição gráfica local')).toBeVisible()
  })
}

test('recebe cinco imagens da mesma página, alternativa e variantes, salva, reabre e restaura', async ({ page }) => {
  test.setTimeout(60000)
  const data = content(5)
  data.slides[0].visualContext.visualCandidates.unshift(hint(9))
  // Exact file, equivalent parameter order; the page identifies its real smaller rendition.
  data.slides[4].visualContext.visualCandidates[0].imageUrl += '?height=720&width=900'
  let pages = 0
  const tickets: string[] = []
  await page.route('**/api/visual/page', route => {
    pages++
    expect(route.request().postDataJSON().preferredImages).toHaveLength(6)
    return route.fulfill({ json: { state: 'ok', candidates: [asset(9), ...Array.from({ length: 5 }, (_, index) =>
      index === 4 ? { ...asset(index), url: asset(index).url + '?width=900&height=720', alternateUrls: [asset(index).url + '?width=600&height=480'] } : asset(index))] } })
  })
  await page.route('**/api/visual/brave', route => route.fulfill({ json: { state: 'disabled', candidates: [] } }))
  await page.route('**/api/visual/download', route => {
    const ticket: string = route.request().postDataJSON().ticket; tickets.push(ticket)
    return ticket === 'panel-9' ? route.fulfill({ status: 422, json: { error: 'invalid_image' } }) :
      route.fulfill({ contentType: 'image/png', body: picture(Number(ticket.split('-')[1])) })
  })
  await importCampaign(page, data)
  const studio = page.getByRole('region', { name: 'Editor Studio' })
  for (let index = 0; index < 5; index++) await expect(studio.getByRole('button', { name: `Slide ${index + 1}`, exact: true })).toHaveAttribute('aria-description', /Imagem encontrada/)
  expect(pages).toBe(1)
  expect(tickets).toContain('panel-9')
  await expect(studio.getByRole('status').filter({ hasText: /^Salvo$/ })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Abrir ' + title, exact: true }).click()
  const backup = await downloadBackup(page)
  expect(backup.project.slides.map((slide: { id: string }) => slide.id)).toEqual(data.slides.map(slide => slide.id))
  for (const slide of backup.project.slides) {
    expect(slide.scene.objects.filter((object: { semantic: string }) => object.semantic === 'image')).toHaveLength(1)
    expect(slide.scene.objects.some((object: { semantic: string; visible: boolean }) => object.semantic === 'imageFrame' && object.visible !== false)).toBe(false)
  }
  await studio.getByRole('button', { name: 'Projetos', exact: true }).click()
  await page.getByLabel('Restaurar projeto ZIP').setInputFiles({ name: 'restauracao.zip', mimeType: 'application/zip', buffer: backup.bytes })
  await expect(studio).toBeVisible()
  await expect(studio.getByRole('button', { name: 'Slide 5', exact: true })).toHaveAttribute('aria-description', /Imagem encontrada/)
  await studio.getByRole('button', { name: 'Finalizar e exportar' }).click()
  const exported = page.waitForEvent('download')
  await studio.getByRole('button', { name: 'Exportar ZIP', exact: true }).click()
  const warning = studio.getByRole('button', { name: 'Exportar com avisos' })
  if (await Promise.race([exported.then(() => false), warning.waitFor().then(() => true)])) await warning.click()
  const delivery = await JSZip.loadAsync(await readFile(await (await exported).path()))
  expect(Object.keys(delivery.files).filter(name => name.endsWith('.png'))).toHaveLength(5)
  expect(await delivery.file('creditos.txt')!.async('string')).toContain(source)
  expect(pages).toBe(1)
})

test('vídeo sem imagem vira composição editorial, bloqueia prontidão e exporta somente após confirmação', async ({ page }, testInfo) => {
  const data = content(1)
  Object.assign(data.slides[0].visualContext, { visualCandidates: [], referenceStatus: 'video_only', videoUrl: 'https://www.youtube.com/watch?v=abcdef12345' })
  await page.route('**/api/visual/**', route => route.fulfill({ json: { state: 'disabled', candidates: [] } }))
  await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { results: [], page_count: 0 } }))
  await importCampaign(page, data)
  const studio = page.getByRole('region', { name: 'Editor Studio' })
  await studio.getByRole('button', { name: 'Imagens', exact: true }).click()
  await expect(studio.getByText(/Há referência em vídeo/)).toBeVisible()
  await expect(studio.getByText('Alternativa editorial · composição gráfica local')).toBeVisible()
  await studio.getByRole('button', { name: 'Finalizar e exportar' }).click()
  await expect(studio.getByText('Finalização visual pendente')).toBeVisible()
  await studio.getByRole('button', { name: 'Exportar ZIP', exact: true }).click()
  await expect(studio.getByRole('button', { name: 'Exportar com avisos' })).toHaveCount(0)
  await studio.getByRole('button', { name: 'Fechar exportação' }).click()
  await studio.getByRole('button', { name: 'Confirmar alternativa pertinente' }).click()
  const studioPixels = await studio.locator('.canvas-paper canvas.lower-canvas').evaluate(canvas => (canvas as HTMLCanvasElement).toDataURL())
  await page.screenshot({ path: testInfo.outputPath('alternativa-editorial.png') })
  const before = await downloadBackup(page)
  const localShapes = before.project.slides[0].scene.objects.filter((object: { semantic: string }) => object.semantic === 'editorialAlternative')
  expect(localShapes.length).toBeGreaterThan(5)
  expect(before.project.slides[0].visualChoice.reception.confirmed).toBe(true)
  await studio.getByRole('button', { name: 'Finalizar e exportar' }).click()
  const download = page.waitForEvent('download')
  await studio.getByRole('button', { name: 'Exportar ZIP', exact: true }).click()
  const warnings = studio.getByRole('button', { name: 'Exportar com avisos' })
  if (await Promise.race([download.then(() => false), warnings.waitFor().then(() => true)])) await warnings.click()
  const zip = await JSZip.loadAsync(await readFile(await (await download).path()))
  const pngs = Object.keys(zip.files).filter(name => name.endsWith('.png'))
  expect(pngs).toHaveLength(1)
  const shown = await loadImage(Buffer.from(studioPixels.split(',')[1], 'base64'))
  const delivered = await loadImage(await zip.file(pngs[0])!.async('nodebuffer'))
  const shownCanvas = createCanvas(shown.width, shown.height), deliveredCanvas = createCanvas(shown.width, shown.height)
  shownCanvas.getContext('2d').drawImage(shown, 0, 0)
  deliveredCanvas.getContext('2d').drawImage(delivered, 0, 0, shown.width, shown.height)
  const shownData = shownCanvas.getContext('2d').getImageData(0, 0, shown.width, shown.height).data
  const deliveredData = deliveredCanvas.getContext('2d').getImageData(0, 0, shown.width, shown.height).data
  let difference = 0
  for (let index = 0; index < shownData.length; index++) difference += Math.abs(shownData[index] - deliveredData[index])
  expect(difference / shownData.length).toBeLessThan(8)
  await studio.getByRole('button', { name: 'Fechar exportação' }).click()
  await expect(studio.getByRole('status').filter({ hasText: /^Salvo$/ })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Abrir ' + title, exact: true }).click()
  await studio.getByRole('button', { name: 'Imagens', exact: true }).click()
  await expect(studio.getByText(/Pertinência confirmada manualmente/)).toBeVisible()
  await expect(studio.getByRole('button', { name: 'Confirmar alternativa pertinente' })).toHaveCount(0)
})
