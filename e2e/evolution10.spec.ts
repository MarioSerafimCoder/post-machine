import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'

test('mantém assistente fora da arte e devolve o foco da revisão nas quatro larguras', async ({ page }, info) => {
  test.skip(info.project.name === 'laptop', 'A matriz usa as quatro resoluções desktop.')
  await page.goto('/#/studio')
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  await button('Criar projeto vazio').click()
  await button('Adicionar título').click()
  await page.getByLabel('Texto do elemento').fill('Uma coisa incrível')
  for (const [width, height] of [[1024,768],[1280,800],[1440,900],[1920,1080]]) {
    await page.setViewportSize({ width, height })
    await button('Assistente Editorial').click()
    const popup = page.getByRole('region', { name: 'Assistente Editorial' })
    await expect(popup).toBeVisible()
    const panel = await popup.boundingBox()
    const art = await page.locator('.canvas-paper').boundingBox()
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(art!.x)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.screenshot({ path: info.outputPath(`studio-assistente-${width}.png`) })
    await page.keyboard.press('Escape')
    await button('Revisar carrossel').click()
    await expect(page.getByRole('heading', { name: 'Revisão editorial do projeto' })).toBeFocused()
    await button('Fechar revisão editorial').click()
    await expect(button('Revisar carrossel')).toBeFocused()
  }
  await button('Salvar').click()
  await expect(page.getByRole('status').filter({ hasText: /^Salvo$/ })).toBeVisible()
  for (const [route, name] of [['radar', 'Radar'], ['auditoria', 'Auditoria'], ['studio', 'Expressa']] as const) {
    await page.getByRole('link', { name: route === 'studio' ? 'Studio' : name, exact: true }).click()
    if (route === 'radar') await button('Criar post').first().waitFor()
    if (route === 'auditoria') {
      await page.getByRole('button', { name: /Revisar projeto:/ }).first().click()
      await button('Auditar todos os slides').click()
      await button('Baixar relatório JSON').waitFor()
    }
    if (route === 'studio') {
      await button('Criar conteúdo').click()
      await button('Colar ou importar conteúdo pronto').click()
      await page.getByRole('textbox', { name: /Cole aqui/ }).waitFor()
    }
    for (const [width, height] of [[1024,768],[1280,800],[1440,900],[1920,1080]]) {
      await page.setViewportSize({ width, height })
      await page.evaluate(() => window.scrollTo(0, 0))
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      await page.screenshot({ path: info.outputPath(`${name.toLowerCase()}-${width}.png`) })
    }
  }
})

for (const count of [1, 6, 20]) test(`fabrica e exporta ${count} slide(s) com PNG no tamanho da arte`, async ({ page }, info) => {
  test.skip(info.project.name === 'laptop', 'A exportação de volume roda uma vez no perfil desktop.')
  test.setTimeout(75_000)
  await page.goto('/#/studio')
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  await button('Produção Expressa').click()
  await page.getByRole('textbox', { name: /Cole aqui/ }).fill(Array.from({ length: count }, (_, index) =>
    `Slide ${index + 1} — Recorte ${index + 1}\nA arte organiza a leitura e preserva o texto original.`).join('\n\n'))
  await button('Organizar slides').click()
  await button('Prévia').click()
  await button(count === 1 ? 'Fabricar meu post' : 'Fabricar meu carrossel').click()
  await expect(page.getByRole('region', { name: 'Propostas de fabricação' }).getByRole('article')).toHaveCount(3, {timeout: 25_000})
  await button('Usar esta versão').click()
  await button('Finalizar e exportar').click()
  const download = page.waitForEvent('download', { timeout: 38_000 })
  await button(count === 1 ? 'Exportar PNG' : 'Exportar ZIP').click()
  const warning = button('Exportar com avisos')
  if (await Promise.race([download.then(() => false), warning.waitFor({ timeout: 38_000 }).then(() => true)])) await warning.click()
  const downloaded = await readFile(await (await download).path())
  const pngs = count === 1 ? [downloaded] : await JSZip.loadAsync(downloaded).then(zip =>
    Promise.all(zip.filter(path => path.endsWith('.png')).map(file => file.async('nodebuffer'))))
  expect(pngs).toHaveLength(count)
  for (const png of pngs) expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1350])
})

test('confirma e desfaz em uma ação dois ajustes de margem verificados', async ({ page }) => {
  await page.goto('/#/studio')
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  await button('Criar projeto vazio').click()
  for (let index = 0; index < 2; index++) {
    if (index) await button('Adicionar slide').click()
    await button('Adicionar título').click()
    await page.getByText('Propriedades avançadas', { exact: true }).click()
    await page.getByLabel('X', { exact: true }).fill('20')
  }
  await button('Auditar design').click()
  await button('Auditar todos os slides').click()
  const heading = page.getByRole('heading', { name: 'Texto fora da margem segura' })
  await expect(heading).toHaveCount(2)
  page.once('dialog', dialog => {
    expect(dialog.message()).toContain('Aplicar 2 ajuste(s)')
    void dialog.accept()
  })
  await button('Prévia de correções de posição em lote').click()
  await expect(heading).toHaveCount(0)
  await button('Desfazer última alteração').click()
  await button('Reanalisar').click()
  await expect(heading).toHaveCount(2)
})

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
