import { expect, test } from '@playwright/test'

test('cria conteúdo pela entrada unificada e organiza o JSON na colagem', async ({ page }) => {
  await page.goto('/#/inicio')
  await page.getByRole('button', { name: 'Criar conteúdo', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Colar ou importar conteúdo pronto' }).click()
  await page.getByRole('textbox', { name: /Cole aqui/ }).fill(JSON.stringify({
    schemaVersion: 1,
    campaign: { title: 'Um novo recorte', objective: 'Educar', audience: 'Designers', tone: 'Profissional', format: 'post', caption: '', cta: '' },
    sources: [],
    slides: [{ order: 1, role: 'content', title: 'A luz organiza a leitura', body: 'Uma pauta sobre arquitetura.', imageBrief: '', layoutType: 'editorial' }],
  }))
  await expect(page.getByLabel('Nome do projeto')).toHaveValue('Um novo recorte')
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('A luz organiza a leitura')
  await expect(page.getByRole('status').filter({ hasText: '1 slide(s) organizados' })).toBeVisible()
})

test('desfaz uma sequência de digitação e alinha pela margem da marca', async ({ page }) => {
  await page.goto('/#/studio')
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  await button('Criar projeto vazio').click()
  await button('Adicionar título').click()
  const field = page.getByLabel('Texto do elemento')
  const original = await field.inputValue()
  await field.fill('')
  await field.pressSequentially('Titulo novo')
  await button('Desfazer').click()
  await button('Camadas').click()
  const layers = page.locator('.studio-tools')
  await layers.getByRole('button', { name: `1 · ${original}`, exact: true }).click()
  await expect(field).toHaveValue(original)
  await button('Refazer').click()
  await layers.getByRole('button', { name: /Titulo novo/ }).click()
  await expect(field).toHaveValue('Titulo novo')
  await button('Minha marca').click()
  await page.getByLabel('Margem segura (px)').fill('120')
  await page.getByText('Organizar camada', { exact: true }).click()
  await button('Alinhar à esquerda').click()
  await page.getByText('Propriedades avançadas', { exact: true }).click()
  expect(Number(await page.getByLabel('X', { exact: true }).inputValue())).toBeCloseTo(120, 0)
  await expect(page.getByRole('status').filter({ hasText: /^Salvo$/ })).toBeVisible()
})

test('retoma a preparação com imagem e vínculo após voltar aos projetos e recarregar', async ({ page }) => {
  await page.goto('/#/studio')
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  await button('Produção Expressa').click()
  await page.getByLabel('Cole aqui o conteúdo do seu post ou carrossel').fill('Slide 1 — Pátios de arquitetura\nA luz orienta os percursos.')
  await button('Organizar slides').click()
  await page.getByLabel('Nome do projeto').fill('Preparação recuperada')
  const tools = page.getByRole('navigation', { name: 'Etapas da Produção Expressa' })
  await tools.getByRole('button', { name: 'Imagens' }).click()
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 120
    canvas.height = 100
    canvas.getContext('2d')!.fillRect(0, 0, 120, 100)
    return canvas.toDataURL().split(',')[1]
  })
  await page.getByLabel('Adicionar imagens').setInputFiles({
    name: 'patio.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64'),
  })
  const association = page.getByLabel('Imagem do slide 1')
  await association.selectOption({ label: '1 · patio.png' })
  await page.getByLabel('Enquadramento do slide 1').selectOption('contain')
  await button('Voltar aos projetos').click()
  await button('Produção Expressa').waitFor()
  await page.reload()
  await button('Produção Expressa').click()
  await button('Retomar preparação').click()
  await expect(association.locator('option:checked')).toHaveText('1 · patio.png')
  await expect(page.getByLabel('Enquadramento do slide 1')).toHaveValue('contain')
  await tools.getByRole('button', { name: 'Conteúdo' }).click()
  await expect(page.getByLabel('Nome do projeto')).toHaveValue('Preparação recuperada')
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Pátios de arquitetura')
})
