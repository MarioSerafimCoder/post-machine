import { expect, test, type Page } from '@playwright/test'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const coffee = { name: 'arquivo-a.png', mimeType: 'image/png', path: 'e2e/fixtures/vision/coffee.png' }
const cat = { name: 'arquivo-b.png', mimeType: 'image/png', path: 'e2e/fixtures/vision/chelsea.png' }

async function imagePreparation(page: Page) {
  await page.goto('/#/studio')
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  await button(page, 'Preparar carrossel').click()
  await page.getByRole('textbox', { name: /Cole aqui/ }).fill('Slide 1 — Retrato de gato\nUma composição com luz lateral.')
  await button(page, 'Organizar slides').click()
  await button(page, 'Imagens').click()
  const { readFile } = await import('node:fs/promises')
  const blank = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    return canvas.toDataURL().split(',')[1]
  }), 'base64')
  await page.getByLabel('Adicionar imagens').setInputFiles([
    { name: coffee.name, mimeType: coffee.mimeType, buffer: await readFile(coffee.path) },
    { name: cat.name, mimeType: cat.mimeType, buffer: await readFile(cat.path) },
    { name: 'arquivo-c.png', mimeType: 'image/png', buffer: blank },
  ])
  await expect(page.locator('.express-image-match strong')).toHaveText(coffee.name)
}

test('usa pixels sob demanda, melhora o pareamento, preserva vínculo e reanalisa offline', async ({ page, context }) => {
  test.setTimeout(70_000)
  const requests: string[] = []
  context.on('request', request => requests.push(request.url()))
  await imagePreparation(page)
  expect(requests.some(url => url.includes('.onnx') || url.includes('.wasm'))).toBe(false)
  const start = Date.now()
  await button(page, 'Analisar imagens localmente').click()
  await expect(page.getByText('2 de 3 imagens com classes visuais reconhecidas.')).toBeVisible({ timeout: 45_000 })
  test.info().annotations.push({ type: 'tempo de carga e 3 análises', description: `${Date.now() - start} ms` })
  const match = page.locator('.express-image-match')
  await expect(match).toContainText('Análise local sugere “gato”')
  await expect(match.locator('strong')).toHaveText(cat.name)
  expect(requests.filter(url => url.includes('.onnx') || url.includes('.wasm')).every(url => url.startsWith(new URL(page.url()).origin))).toBe(true)
  await button(page, 'Ignorar análise visual neste slide').click()
  await expect(match.locator('strong')).toHaveText(coffee.name)
  await button(page, 'Reativar análise visual neste slide').click()
  await button(page, 'Aceitar sugestão').click()
  await expect(match.locator('strong')).toHaveText(cat.name)
  const choice = page.getByLabel('Imagem do slide 1')
  await choice.selectOption({ label: '1 · ' + coffee.name })
  await page.getByText('Ajustar ponto focal do slide 1').click()
  const horizontal = page.getByLabel('Ponto focal horizontal')
  await horizontal.fill('75')
  await expect(horizontal).toHaveValue('75')
  await button(page, 'Centralizar enquadramento').click()
  await expect(horizontal).toHaveValue('50')
  await context.setOffline(true)
  try {
    await button(page, 'Reanalisar imagens localmente').click()
    await expect(page.getByText('2 de 3 imagens com classes visuais reconhecidas.')).toBeVisible({ timeout: 30_000 })
    await expect(match.locator('strong')).toHaveText(coffee.name)
  } finally {
    await context.setOffline(false)
  }
})

test('continua sugerindo por metadados quando o carregamento do modelo falha', async ({ page, context }) => {
  await context.route(/\.onnx(?:\?|$)/, route => route.abort())
  await imagePreparation(page)
  await button(page, 'Analisar imagens localmente').click()
  await expect(page.getByText(/Sugestões por metadados disponíveis/)).toBeVisible({ timeout: 25_000 })
  await expect(page.locator('.express-image-match strong')).toHaveText(coffee.name)
  await button(page, 'Prévia').click()
  await button(page, 'Montar meu post').click()
  await expect(page.getByRole('region', { name: 'Opções de design' }).getByRole('article')).toHaveCount(3)
})
