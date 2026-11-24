import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'

test('Radar abre um único projeto editável e aplica foto licenciada da fonte em segundo plano', async ({ page, context }) => {
  const snapshot = await (await page.request.get('/radar.json')).json()
  const article = {
    ...snapshot.items[0], title: 'Restauro da ponte do Brooklyn', source: 'Veículo da fixture',
    url: 'https://example.org/restauro', canonicalUrl: 'https://example.org/restauro', imageUrl: undefined,
    summary: 'O projeto documentou os materiais usados na restauração.',
  }
  await context.route('**/radar.json', route => route.fulfill({ json: { ...snapshot, items: [article], opportunities: [] } }))
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await context.route('https://api.openverse.org/v1/images/?*', async route => {
    await pending
    await route.fulfill({ json: { page_count: 1, results: [{
      id: 'b48db8fa-29dd-406e-a13c-5928ffc54b43', title: 'Registro de restauro', creator: 'Autor da fixture',
      category: 'photograph', url: 'https://upload.wikimedia.org/editorial-automation.png', filetype: 'png',
      foreign_landing_url: article.url, width: 640, height: 520, license: 'by', license_version: '4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
    }] } })
  })
  await page.goto('/#/radar')
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 520
    canvas.getContext('2d')!.fillRect(0, 0, 640, 520)
    return canvas.toDataURL().split(',')[1]
  }), 'base64')
  await context.route('https://upload.wikimedia.org/editorial-automation.png', route => route.fulfill({
    contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: png,
  }))
  const other = await context.newPage()
  await other.goto('/#/radar')
  const create = (tab: typeof page) => tab.getByRole('button', { name: 'Criar post', exact: true }).click()
  await Promise.all([create(page), create(other)])
  const project = page.getByLabel('Projeto', { exact: true })
  await expect(project).toHaveValue(article.title)
  await expect(other.getByLabel('Projeto', { exact: true })).toHaveValue(article.title)
  await other.close()
  await expect(page.getByRole('status').filter({ hasText: 'Slides editáveis · Buscando imagens' })).toBeVisible()
  await project.fill('Projeto editado')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  release()
  await expect(page.getByRole('button', { name: 'Slide 1', exact: true })).toHaveAttribute('aria-description', /Imagem encontrada/)
  await expect(project).toHaveValue('Projeto editado')
  await page.getByRole('region', { name: 'Editor Studio' }).getByText('Notícia de origem', { exact: true }).click()
  await expect(page.getByRole('link', { name: article.title, exact: true })).toHaveAttribute('href', article.url)

  await page.getByRole('link', { name: 'Radar', exact: true }).click()
  await create(page)
  await expect(project).toHaveValue('Projeto editado')
  await page.getByRole('button', { name: 'Projetos', exact: true }).click()
  await expect(page.getByText('Projeto editado', { exact: true })).toHaveCount(1)
})

test('Studio distribui texto e JSON em versões editáveis com fonte e aviso de excesso', async ({ page }) => {
  await page.route('https://api.openverse.org/v1/images/?*', route => route.fulfill({ status: 503 }))
  await page.goto('/#/radar')
  await page.getByRole('button', { name: 'Criar post', exact: true }).first().click()
  const studio = page.getByRole('region', { name: 'Editor Studio' })
  const importText = async (text: string) => {
    await studio.getByRole('button', { name: 'Colar conteúdo' }).click()
    await studio.getByLabel('Texto, JSON ou Markdown').fill(text)
    await studio.getByText('Escolher template manualmente', { exact: true }).click()
    await studio.getByLabel('Template da nova versão').selectOption('text')
    await studio.getByRole('button', { name: 'Criar nova versão' }).click()
  }
  await importText('# Pátio e luz\n## Contexto do projeto\n\nPrimeiro parágrafo factual.\n\nSegundo parágrafo factual.')
  await expect(studio.getByLabel('Projeto', { exact: true })).toHaveValue('Pátio e luz')
  await expect(studio.getByRole('button', { name: /^Slide \d+$/ })).toHaveCount(3)
  await studio.getByRole('button', { name: 'Camadas', exact: true }).click()
  await studio.getByRole('button', { name: /Contexto do projeto/ }).click()
  await expect(studio.getByLabel('Texto do elemento')).toHaveValue('Contexto do projeto')

  const overflow = 'Texto integral para revisar. '.repeat(185)
  await importText(JSON.stringify({
    schemaVersion: 1, campaign: { title: 'Versão JSON', objective: 'Informar', audience: '', tone: 'Profissional', format: 'post', caption: '', cta: '' },
    sources: [], slides: [{ order: 1, role: 'content', title: 'Título do JSON', subtitle: 'Linha fina',
      body: overflow, imageBrief: '', layoutType: 'editorial' }],
  }))
  await expect(studio.getByLabel('Projeto', { exact: true })).toHaveValue('Versão JSON')
  await expect(studio.getByRole('status').filter({ hasText: 'Há texto além da área neste frame' })).toBeVisible()
  const download = page.waitForEvent('download')
  await studio.getByRole('button', { name: 'Baixar backup ZIP', exact: true }).click()
  const zip = await JSZip.loadAsync(await readFile(await (await download).path()))
  const manifest = JSON.parse(await zip.file('project.json')!.async('string'))
  const json = JSON.stringify(manifest)
  expect(json).toContain(overflow)
  expect(json).toContain('Linha fina')
  expect(json).toContain('editorialSource')
})
