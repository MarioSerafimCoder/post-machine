import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const exactStatus = (page: Page, text: string) => page.getByText(text, { exact: true })
const photo = (label: string, number: number, documentary: boolean, category = 'photograph') => ({
  id: `762ec81b-3312-40d6-8ce2-e70aa6b4346${number}`, title: label, category, creator: 'Autoria da fixture',
  foreign_landing_url: `https://www.flickr.com/photos/fixture/${number}`, url: `https://live.staticflickr.com/evolution12-${number}.png`,
  description: documentary ? 'Arquivo histórico. Fotografia documental.' : 'Fotografia de apoio.',
  width: 1000, height: 800, license: 'by', license_version: '4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/',
})

async function mockImages(page: Page, delayed: Promise<void> = Promise.resolve()) {
  await page.goto('/#/inicio')
  const photos = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1000; canvas.height = 800
    const context = canvas.getContext('2d')!
    return [1, 2, 3, 4].map(number => {
      context.fillStyle = '#dae1ef'; context.fillRect(0, 0, 1000, 800)
      context.fillStyle = '#193040'; context.fillRect(100 * number, 80 * number, 200, 400)
      return canvas.toDataURL().split(',')[1]
    })
  })
  const queries: string[] = []
  await page.route('https://api.openverse.org/v1/images/?*', async route => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('category') !== 'photograph') return route.fulfill({ json: { page_count: 0, results: [] } })
    const query = url.searchParams.get('q')!
    queries.push(query)
    const results = /ponte|bridge/.test(query)
      ? [photo('Ponte estaiada monumental', 1, true)]
      : /cafe|coffee/.test(query) ? [photo('Café e xícara na mesa', 2, false)] :
        /biblioteca|library/.test(query) ? [photo('Biblioteca municipal histórica', 3, true)] :
          [photo('Cidade conceitual abstrata', 4, true, 'illustration')]
    if (/cafe|coffee/.test(query)) await delayed
    await route.fulfill({ json: { page_count: 1, results } }).catch(() => undefined)
  })
  await page.route('https://live.staticflickr.com/evolution12-*.png', route => {
    const index = Number(/evolution12-(\d+)\.png$/.exec(route.request().url())?.[1]) - 1
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, contentType: 'image/png', body: Buffer.from(photos[index], 'base64') })
  })
  return queries
}

test('cola, busca em paralelo, usa apoio editorial e retoma escolhas e créditos', async ({ page }, info) => {
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  const queries = await mockImages(page, delayed)
  await page.goto('/#/studio')
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  await button(page, 'Preparar carrossel').click()
  await page.getByRole('textbox', { name: /Cole aqui/ }).evaluate(input => {
    const transfer = new DataTransfer()
    transfer.setData('text/plain', 'Slide 1 — Ponte estaiada\nA obra conecta dois bairros.\n\nSlide 2 — Café e xícara\nUm hábito da cidade.\n\nSlide 3 — Cidade abstrata\nUm conceito sem referência visual.')
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }))
  })
  await expect(exactStatus(page, 'Imagem encontrada')).toBeVisible()
  await expect(exactStatus(page, 'Buscando imagem…').first()).toBeVisible()
  await button(page, 'Imagens').click()
  release()
  await expect(exactStatus(page, 'Imagem encontrada').nth(1)).toBeVisible()
  await expect(exactStatus(page, 'Nenhuma imagem adequada encontrada.')).toBeVisible()
  await button(page, 'Escolher imagem · 1').click()
  await expect(page.getByLabel('Buscar pelo conteúdo do slide').locator('option:checked')).toContainText('Cidade abstrata')
  await page.screenshot({ path: info.outputPath('apoio-editorial.png'), fullPage: true })
  expect(queries.filter(query => /cafe|coffee/.test(query))).toHaveLength(1)
  expect(queries.every(query => !query.includes('conceitual') && !query.includes('abstrata'))).toBe(true)
  const images = page.locator('.express-image-row')
  await images.nth(0).getByRole('button', { name: 'Travar imagem', exact: true }).click()
  await expect(images.nth(0).getByLabel('Imagem do slide 1')).toBeDisabled()
  const before = queries.filter(query => /ponte|bridge/.test(query)).length
  await button(page, 'Conteúdo').click()
  await page.getByLabel('Título', { exact: true }).nth(1).fill('Biblioteca municipal')
  await expect(exactStatus(page, 'Imagem encontrada').last()).toBeVisible()
  await button(page, 'Imagens').click()
  await expect(images.nth(1)).toContainText('Biblioteca municipal histórica')
  expect(queries.filter(query => /ponte|bridge/.test(query))).toHaveLength(before)
  await page.screenshot({ path: info.outputPath('busca-progressiva.png'), fullPage: true })
  await button(page, 'Voltar aos projetos').click()
  await page.reload()
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  await button(page, 'Preparar carrossel').click()
  await button(page, 'Retomar preparação').click()
  await expect(images.nth(0)).toContainText('Travado')
  await expect(images.nth(1)).toContainText('Biblioteca municipal histórica')
  await button(page, 'Prévia').click()
  await button(page, 'Montar meu carrossel').click()
  await button(page, 'Usar esta versão').click()
  await button(page, 'Finalizar e exportar').click()
  const download = page.waitForEvent('download')
  await button(page, 'Exportar ZIP').click()
  const warning = button(page, 'Exportar com avisos')
  if (await Promise.race([download.then(() => false), warning.waitFor().then(() => true)])) await warning.click()
  const zip = await JSZip.loadAsync(await readFile(await (await download).path()))
  expect(await zip.file('creditos.txt')!.async('string')).toContain('Autoria da fixture')
})

test('abre conteúdo importado no Studio e preenche o frame em segundo plano', async ({ page }, info) => {
  await mockImages(page)
  let interrupted = true
  await page.route('https://api.openverse.org/v1/images/?*', route => interrupted
    ? route.fulfill({ status: 503 }) : route.fallback())
  await page.goto('/#/radar')
  await page.locator('.news-story').getByRole('button', { name: 'Criar carrossel', exact: true }).first().click()
  await button(page, 'Editar briefing').click()
  await page.getByRole('combobox', { name: 'Formato', exact: true }).selectOption('post')
  await button(page, 'Gerar prompt para IA').click()
  await page.getByLabel('Conteúdo em JSON ou Markdown').fill(JSON.stringify({
    schemaVersion: 1, campaign: { title: 'Ponte estaiada', objective: 'Informar', audience: 'Moradores', tone: 'Profissional', format: 'post', caption: '', cta: '' },
    sources: [], slides: [{ order: 1, role: 'content', title: 'Ponte estaiada', body: 'A obra liga dois bairros.', imageBrief: '', layoutType: 'editorial' }],
  }))
  await button(page, 'Importar conteúdo').click()
  await button(page, 'Salvar e abrir no Studio').click()
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue('Ponte estaiada')
  await expect(button(page, 'Tentar novamente · 1')).toBeVisible()
  interrupted = false
  await button(page, 'Tentar novamente · 1').press('Enter')
  await expect(page.getByRole('button', { name: 'Slide 1', exact: true })).toHaveAttribute('aria-description', /Imagem encontrada/)
  await button(page, 'Fotos aplicadas · 1').click()
  const imageStatus = page.getByRole('status').getByText('Imagem encontrada', { exact: true })
  await expect(imageStatus).toBeVisible()
  await expect(page.locator('.slide-thumbnail')).toBeVisible()
  await page.screenshot({ path: info.outputPath('studio-frame-documental.png') })
  await button(page, 'Desfazer escolha automática').click()
  await expect(exactStatus(page, 'Sem imagem')).toBeVisible()
  await button(page, 'Voltar ao automático').click()
  await expect(imageStatus).toBeVisible()
})

test('aplica uma foto de arquivo como apoio quando o assunto exato não tem imagens', async ({ page }) => {
  await mockImages(page)
  const searches: string[] = []
  let imported = false
  await page.route('https://api.openverse.org/v1/images/?*', route => {
    if (!imported) return route.fulfill({ json: { page_count: 0, results: [] } })
    const url = new URL(route.request().url())
    const query = url.searchParams.get('q')!
    searches.push(query)
    if (searches.length === 1) return route.fulfill({ status: 504 })
    return route.fulfill({ json: { page_count: 1, results: query === 'macy thanksgiving day parade'
      ? [photo('Macy’s Thanksgiving Day Parade 2022', 1, true)] : [] } })
  })
  await page.goto('/#/radar')
  await page.locator('.news-story').getByRole('button', { name: 'Criar carrossel', exact: true }).first().click()
  await button(page, 'Editar briefing').click()
  await page.getByRole('combobox', { name: 'Formato', exact: true }).selectOption('post')
  await button(page, 'Gerar prompt para IA').click()
  await page.getByLabel('Conteúdo em JSON ou Markdown').fill(JSON.stringify({
    schemaVersion: 1, campaign: { title: 'Um filme de Natal', objective: 'Informar', audience: 'Leitores', tone: 'Profissional', format: 'post', caption: '', cta: '' },
    sources: [], slides: [{ order: 1, role: 'cover', title: 'A marca fez um filme de Natal',
      body: 'A produção será exibida durante o desfile da Macy’s.', imageBrief: '', layoutType: 'editorial',
      visualContext: { searchQueries: ['Filme de Natal', 'Macy’s Thanksgiving Day Parade'] } }],
  }))
  await button(page, 'Importar conteúdo').click()
  imported = true
  await button(page, 'Salvar e abrir no Studio').click()
  await expect(button(page, 'Slide 1')).toHaveAttribute('aria-description', /Imagem encontrada/)
  expect(searches).toEqual(['filme natal', 'macy thanksgiving day parade'])
  await button(page, 'Imagens').click()
  const imageStatus = page.getByRole('status').filter({ hasText: 'Imagem encontrada' })
  await imageStatus.getByText('Sobre a imagem').click()
  await expect(imageStatus.getByText(/Confira na fonte a cena e a data/)).toBeVisible()
})

test('descarta resposta antiga após editar um card com busca em andamento', async ({ page }) => {
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  const queries = await mockImages(page, delayed)
  await page.goto('/#/studio')
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  await button(page, 'Preparar carrossel').click()
  await page.getByRole('textbox', { name: /Cole aqui/ }).fill('Slide 1 — Café e xícara\nUma imagem do cotidiano.')
  await button(page, 'Organizar slides').click()
  await expect.poll(() => queries.some(query => /cafe|coffee/.test(query))).toBe(true)
  await page.getByLabel('Título', { exact: true }).fill('Biblioteca municipal')
  await expect(exactStatus(page, 'Imagem encontrada')).toBeVisible()
  await button(page, 'Imagens').click()
  const row = page.locator('.express-image-row')
  await expect(row).toContainText('Biblioteca municipal histórica')
  await row.getByRole('button', { name: 'Manter esta', exact: true }).click()
  release()
  await expect(row).toContainText('Confirmado manualmente')
  await expect(row).toContainText('Biblioteca municipal histórica')
  expect(queries.filter(query => /cafe|coffee/.test(query))).toHaveLength(1)
})
