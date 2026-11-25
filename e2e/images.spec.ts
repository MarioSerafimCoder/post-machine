import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'

const ids = ['ee293bf3-d38a-4162-aca8-771708adc0b8', '6b1455be-9a81-4fb1-a08b-ea6bfe705587']
const fixture = (index: number) => ({
  id: ids[index], title: ['Fachada da fixture', 'Pátio da fixture'][index], creator: ['Autor A', 'Autor B'][index], source: 'flickr',
  url: `https://live.staticflickr.com/fixture-${index}.png`, thumbnail: `https://api.openverse.org/v1/images/${ids[index]}/thumb/`,
  width: 400, height: 300, filetype: 'png', foreign_landing_url: `https://www.flickr.com/photos/fixture${index}`,
  license: index === 0 ? 'by' : 'by-nc', license_version: '4.0', license_url: `https://creativecommons.org/licenses/${index === 0 ? 'by' : 'by-nc'}/4.0/`,
  attribution: `Atribuição da fixture ${index}`,
})

test('notícia vira carrossel com headline, Openverse, Auditoria, ZIP e backup', async ({ page }) => {
  await page.goto('/#/radar')
  await page.locator('.news-story').getByRole('button', { name: 'Criar carrossel', exact: true }).first().click()
  await page.getByRole('button', { name: 'Editar briefing', exact: true }).click()
  await page.getByLabel('Quantidade de slides').selectOption('2')
  await page.getByRole('button', { name: 'Gerar prompt para IA', exact: true }).click()
  await expect(page.getByLabel('Prompt editorial')).toHaveValue(/Separe fatos verificáveis/)
  await page.getByLabel('Conteúdo em JSON ou Markdown').fill(JSON.stringify({
    schemaVersion: 1, campaign: { title: 'Acervo de teste', objective: 'Educar', audience: 'Designers', tone: 'Profissional', format: 'carousel', caption: 'Legenda original da campanha.', cta: '' },
    slides: [{ order: 1, role: 'cover', title: 'Pátios urbanos', body: 'A luz organiza o espaço.', imageBrief: '', layoutType: 'text' },
      { order: 2, role: 'cta', title: 'Leia mais', body: '', imageBrief: '', layoutType: 'editorial' }], sources: [],
  }))
  await page.getByRole('button', { name: 'Importar conteúdo', exact: true }).click()
  await page.getByRole('button', { name: 'Melhorar headline', exact: true }).first().click()
  const headlines = page.getByRole('region', { name: 'Agente de Headlines' })
  await headlines.getByRole('button', { name: 'Gerar propostas por regras' }).click()
  await headlines.getByRole('button', { name: 'Aplicar', exact: true }).first().click()
  await page.getByRole('button', { name: 'Salvar e abrir no Studio' }).click()
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue('Acervo de teste')
  await page.getByRole('button', { name: 'Camadas', exact: true }).click()
  await page.getByRole('button', { name: /^2 ·/ }).click()
  await page.getByLabel('Texto do elemento').fill('Fachadas e pátios')
  await page.getByText('Propriedades avançadas', { exact: true }).click()
  await page.getByLabel('Largura', { exact: true }).fill('700')
  await page.getByLabel('X', { exact: true }).fill('20')
  const bytes = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 400; canvas.height = 300; canvas.getContext('2d')!.fillRect(0, 0, 400, 300)
    return canvas.toDataURL().split(',')[1]
  }), 'base64')
  await page.route('https://api.openverse.org/v1/images/?*', route => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('source')).toBe('flickr')
    return route.fulfill({ json: { page_count: 2, results: [fixture(url.searchParams.get('page') === '1' ? 0 : 1)] } })
  })
  await page.route('https://api.openverse.org/v1/images/*/thumb/', route => route.fulfill({ status: 404, body: '' }))
  await page.route('https://live.staticflickr.com/fixture-0.png', route => route.fulfill({ contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: bytes }))
  await page.route('https://live.staticflickr.com/fixture-1.png', route => route.abort('failed'))
  await page.getByRole('button', { name: 'Imagens', exact: true }).click()
  await page.getByRole('button', { name: 'Pesquisar imagens', exact: true }).click()
  await expect(page.getByLabel('Consulta visual')).toHaveValue(/Fachadas e pátios/i)
  await page.getByRole('button', { name: 'Pesquisar no Openverse' }).click()
  await page.getByLabel('Fonte do Openverse', { exact: true }).selectOption('flickr')
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click()
  await expect(page.getByText('Miniatura indisponível', { exact: true })).toBeVisible()
  for (const width of [1024,1280,1440]) {
    await page.setViewportSize({ width, height: 960 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('button', { name: 'Ver detalhes' }).click()
  let detail = page.getByRole('region', { name: 'Detalhes da imagem selecionada' })
  await expect(detail).toContainText('Atribuição exigida')
  await detail.getByRole('button', { name: 'Inserir no Studio' }).click()
  await expect(detail).toContainText('Imagem inserida')
  const x = page.getByLabel('X', { exact: true })
  if (!await x.isVisible()) await page.getByText('Propriedades avançadas', { exact: true }).click()
  await x.fill('160')
  await page.getByRole('button', { name: 'Próxima página' }).click()
  await page.getByRole('button', { name: 'Ver detalhes' }).click()
  detail = page.getByRole('region', { name: 'Detalhes da imagem selecionada' })
  await expect(detail).toContainText('restringe uso comercial')
  await detail.getByRole('button', { name: 'Inserir no Studio' }).click()
  await expect(detail).toContainText('não liberou o original')
  await detail.getByLabel('Importar arquivo com estes créditos').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: bytes })
  await expect(detail).toContainText('Imagem inserida')
  await expect(x).toHaveValue('160')
  await page.getByRole('button', { name: 'Finalizar e exportar', exact: true }).click()
  await expect(page.getByRole('textbox', {name:'Legenda', exact:true})).toHaveValue('Legenda original da campanha.')
  await page.getByText('Créditos das imagens', { exact: true }).click()
  await expect(page.getByLabel('Texto de atribuição')).toHaveValue(/Autor B/)
  await expect(page.getByLabel('Texto de atribuição')).not.toHaveValue(/Autor A/)
  await page.getByRole('button', { name: 'Fechar exportação', exact: true }).click()
  await page.getByText('Revisar', { exact: true }).click()
  await page.getByRole('button', { name: 'Problemas técnicos', exact: true }).click()
  await page.getByRole('button', { name: 'Auditar slide atual', exact: true }).click()
  const margin = page.getByRole('heading', { name: 'Texto fora da margem segura' })
  await expect(margin).toBeVisible()
  page.once('dialog', dialog => void dialog.accept())
  await margin.locator('..').getByRole('button', { name: 'Propor correção' }).click()
  await expect(margin).toHaveCount(0)
  await page.getByRole('button', { name: 'Finalizar e exportar', exact: true }).click()
  await page.getByRole('button', { name: 'Exportar ZIP', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Revise antes de exportar' })).toContainText('Uso comercial restrito', { timeout: 15000 })
  const zipEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar com avisos' }).click()
  const zip = await JSZip.loadAsync(await readFile(await (await zipEvent).path()))
  expect(await zip.file('creditos.txt')!.async('string')).toContain('Autor B')
  expect((await zip.file('01-Acervo-de-teste.png')!.async('nodebuffer')).readUInt32BE(16)).toBe(1080)
  expect((await zip.file('02-Acervo-de-teste.png')!.async('nodebuffer')).readUInt32BE(20)).toBe(1350)
  await page.getByRole('button', { name: 'Fechar exportação', exact: true }).click()
  if (await page.locator('.slide-menu:not([open]) > summary').count()) await page.locator('.slide-menu > summary').click()
  await page.getByRole('button', { name: 'Duplicar slide', exact: true }).click()
  const backupEvent = page.waitForEvent('download')
  if (await page.getByRole('dialog', { name: 'Finalizar projeto', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar exportação', exact: true }).click()
  await page.getByText('Mais ações', { exact: true }).click()
  await page.getByRole('button', { name: 'Backup completo' }).click()
  const backup = await readFile(await (await backupEvent).path())
  const backupZip = await JSZip.loadAsync(backup)
  expect(Object.keys(backupZip.files).filter(name => /^assets\/[a-f0-9]{64}$/.test(name))).toHaveLength(1)
  if (await page.getByRole('dialog', { name: 'Finalizar projeto', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar exportação', exact: true }).click()
  await page.getByRole('button', { name: 'Projetos', exact: true }).click()
  await page.getByLabel('Restaurar projeto ZIP').setInputFiles({ name: 'arquivo.zip', mimeType: 'application/zip', buffer: backup })
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue(/restaurado/)
  await page.getByRole('button', { name: 'Finalizar e exportar', exact: true }).click()
  await page.getByText('Créditos das imagens', { exact: true }).click()
  await expect(page.getByLabel('Texto de atribuição')).toHaveValue(/Slides: 1, 2[\s\S]+Autor B/)
  await page.getByRole('button', { name: 'Fechar exportação', exact: true }).click()
  await page.getByRole('button', { name: 'Imagens utilizadas' }).click()
  await expect(page.getByRole('region', { name: 'Imagens utilizadas' })).toContainText('Pátio da fixture')
})

test('Auditoria identifica imagem local ilegível em vez de perder o relatório', async ({ page }) => {
  await page.goto('/#/studio')
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  await page.getByRole('button', { name: 'Criar projeto vazio' }).click()
  if (await page.getByRole('dialog', { name: 'Finalizar projeto', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar exportação', exact: true }).click()
  await page.getByRole('button', { name: 'Projetos', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Abrir Novo projeto' })).toBeVisible()
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('post-machine-studio')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const transaction = database.transaction('projects', 'readwrite')
      const cursor = transaction.objectStore('projects').openCursor()
      cursor.onsuccess = () => {
        const entry = cursor.result
        if (!entry) return
        const project = entry.value
        project.slides[0].scene.objects = [{ type: 'Image', src: 'data:image/png;base64,Y29ycm9tcGlkbw==', width: 40, height: 40 }]
        entry.update(project)
      }
      await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error) })
    } finally { database.close() }
  })
  if (await page.getByRole('dialog', { name: 'Finalizar projeto', exact: true }).isVisible()) await page.getByRole('button', { name: 'Fechar exportação', exact: true }).click()
  await page.getByRole('link', { name: 'Auditoria', exact: true }).click()
  await page.getByLabel('Projeto para auditar').selectOption({ label: 'Novo projeto' })
  await page.getByRole('button', { name: 'Auditar todos os slides' }).click()
  await expect(page.getByRole('heading', { name: 'Arquivo de imagem ilegível' })).toBeVisible()
})

test('Openverse mostra falha de rede, permite tentar novamente e explica HTTP 429', async ({ page }) => {
  await page.goto('/#/studio')
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  await page.getByRole('button', { name: 'Criar projeto vazio' }).click()
  await page.getByRole('button', { name: 'Imagens', exact: true }).click()
  await page.getByRole('button', { name: 'Pesquisar imagens', exact: true }).click()
  await page.getByRole('button', { name: 'Pesquisar no Openverse' }).click()
  const panel = page.getByRole('region', { name: 'Pesquisa de imagens no Openverse' })
  let requests = 0
  await page.route('https://api.openverse.org/v1/images/?*', route => {
    requests++
    return requests === 1 ? route.abort('failed') : route.fulfill({ status: 429, headers: { 'retry-after': '60' }, body: '{}' })
  })
  await panel.getByLabel('Termo de pesquisa').fill('fotografia de teste')
  const search = panel.getByRole('button', { name: 'Pesquisar', exact: true })
  await search.click()
  await expect(panel.getByRole('alert')).toContainText('Não foi possível conectar ao Openverse')
  await search.click()
  await expect(panel.getByRole('alert')).toContainText('Limite de buscas atingido')
  expect(requests).toBe(2)
})
