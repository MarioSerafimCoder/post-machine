import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { markdownExample } from '../src/features/campaigns/contract'

test('notícia real vira briefing, prompt e campanha editável com backup', async ({ page, context }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  if (testInfo.project.name === 'laptop') await page.setViewportSize({ width: 1024, height: 800 })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/#/radar')
  const first = page.getByRole('article').first()
  const title = await first.getByRole('heading').innerText()
  const url = await first.getByRole('link', { name: title, exact: true }).getAttribute('href')
  await page.getByRole('searchbox', { name: 'Buscar notícias' }).fill(title)
  await first.getByRole('button', { name: 'Criar post' }).click()
  await expect(page.getByRole('region', { name: 'Notícia de origem' }).getByRole('link')).toHaveAttribute('href', url!)
  await page.getByLabel('Público-alvo').fill('Diretores de arte')
  await page.getByRole('combobox', { name: 'Objetivo', exact: true }).selectOption('Educar')
  await page.getByLabel('Tom de comunicação').selectOption('Reflexivo')
  await page.getByLabel('Quantidade de slides').selectOption('2')
  await page.getByRole('button', { name: 'Salvar público e tom como padrão' }).click()
  await expect(page.getByText('Preferências salvas para as próximas pautas.')).toBeVisible()
  await page.getByRole('button', { name: 'Gerar prompt para IA', exact: true }).click()
  const prompt = page.getByLabel('Prompt editorial')
  await expect(prompt).toHaveValue(/Diretores de arte/)
  await expect(prompt).toHaveValue(/Separe fatos verificáveis/)
  await page.getByRole('button', { name: 'Copiar prompt' }).click()
  await expect(page.getByText('Prompt copiado.')).toBeVisible()
  const pastedPrompt = await page.evaluate(() => navigator.clipboard.readText())
  expect(pastedPrompt.replace(/\r\n/g, '\n')).toBe(await prompt.inputValue())
  await page.getByLabel('Ferramenta de IA').selectOption('Claude')
  await expect(page.getByRole('link', { name: 'Abrir Claude' })).toHaveAttribute('href', 'https://claude.ai/new')

  const input = page.getByLabel('Conteúdo em JSON ou Markdown')
  await input.fill('{}')
  await page.getByRole('button', { name: 'Importar conteúdo' }).click()
  await expect(page.getByRole('alert')).toContainText('schemaVersion')
  await input.fill(JSON.stringify({
    schemaVersion: 1, campaign: { title: 'Campanha de teste', objective: 'Educar', audience: 'Diretores de arte',
      tone: 'Reflexivo', format: 'carousel', caption: 'Legenda', cta: 'Leia a fonte.' },
    sources: [], slides: [
      { order: 1, role: 'cover', title: 'Capa inicial', body: '', imageBrief: '', layoutType: 'editorial' },
      { order: 2, role: 'cta', title: 'Final', body: '', imageBrief: '', layoutType: 'editorial' },
    ],
  }))
  await page.getByRole('button', { name: 'Importar conteúdo' }).click()
  await expect(page.getByRole('heading', { name: 'Revisão editorial' })).toBeFocused()
  await expect(page.getByRole('region', { name: 'Revisão editorial' }).getByRole('link', { name: title })).toHaveAttribute('href', url!)
  await page.getByRole('group', { name: 'Peça 1 · Capa' }).getByLabel('Título').fill('Capa editada')
  await page.getByRole('group', { name: 'Peça 1 · Capa' }).getByRole('button', { name: 'Mover para baixo' }).click()
  await expect(page.getByRole('group', { name: 'Peça 2 · Capa' }).getByLabel('Título')).toHaveValue('Capa editada')
  await page.getByRole('button', { name: 'Adicionar peça' }).click()
  await page.getByRole('group', { name: 'Peça 3 · Conteúdo' }).getByRole('button', { name: 'Excluir peça' }).click()
  await page.getByRole('group', { name: 'Peça 2 · Capa' }).getByRole('button', { name: 'Duplicar peça' }).click()
  await expect(page.getByRole('group', { name: 'Peça 3 · Capa' }).getByLabel('Título')).toHaveValue('Capa editada')
  await page.getByRole('button', { name: 'Salvar sem abrir', exact: true }).click()
  await expect(page.getByText('Campanha salva.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar às notícias' }).click()
  await expect(page.getByRole('searchbox', { name: 'Buscar notícias' })).toHaveValue(title)
  await page.getByRole('button', { name: 'Pautas e prompts' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const pendingDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar backup' }).click()
  const download = await pendingDownload
  const backup = await readFile(await download.path())
  await page.reload()
  await page.getByRole('button', { name: 'Pautas e prompts' }).click()
  await page.getByRole('searchbox', { name: 'Buscar campanhas' }).fill('Campanha de teste')
  const saved = page.getByRole('button', { name: /Campanha de teste/ })
  await saved.click()
  await expect(page.getByRole('group', { name: 'Peça 3 · Capa' }).getByLabel('Título')).toHaveValue('Capa editada')
  await page.getByRole('button', { name: 'Duplicar campanha' }).click()
  await expect(page.getByLabel('Nome da campanha')).toHaveValue('Campanha de teste (cópia)')
  await page.getByRole('button', { name: 'Excluir campanha' }).click()
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click()
  await expect(saved).toHaveCount(1)
  await page.getByLabel('Restaurar backup JSON').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: backup })
  await expect(page.getByText(/Backup restaurado/)).toBeVisible()
  await expect(saved).toHaveCount(2)
  expect(errors).toEqual([])
})

test('importa Markdown de arquivo para post único', async ({ page }) => {
  await page.goto('/#/radar')
  await page.getByRole('button', { name: 'Criar post', exact: true }).first().click()
  await page.getByRole('combobox', { name: 'Formato', exact: true }).selectOption('post')
  await page.getByLabel('Carregar arquivo').setInputFiles({
    name: 'post.md', mimeType: 'text/markdown', buffer: Buffer.from(markdownExample),
  })
  await page.getByRole('button', { name: 'Importar conteúdo' }).click()
  await expect(page.getByLabel('Nome da campanha')).toHaveValue('Nome da campanha')
  await expect(page.getByLabel('Sugestão de imagem')).toHaveValue('Sugestão de imagem.')
})

test('importa a resposta do GPT com datas parciais ao salvar e abre o projeto editável no Studio', async ({ page }) => {
  await page.goto('/#/radar')
  await page.getByRole('button', { name: 'Pautas e prompts', exact: true }).click()
  await page.getByRole('button', { name: 'Nova campanha', exact: true }).click()
  await page.getByRole('button', { name: 'Começar do zero', exact: true }).click()
  await page.getByRole('combobox', { name: 'Formato', exact: true }).selectOption('post')

  const sources = [
    { title: 'Fonte com data', url: 'https://example.com/1', publishedAt: '2026-11-18' },
    { title: 'Fonte sem hora', url: 'https://example.com/2', publishedAt: '2026-11-17' },
    { title: 'Fonte sem data', url: 'https://example.com/3', publishedAt: '' },
    { title: 'Outra fonte', url: 'https://example.com/4' },
  ]
  const response = {
    schemaVersion: 1,
    campaign: { title: 'Campanha enviada ao Studio', objective: 'Informar', audience: 'Leigo',
      tone: 'Provocativo', format: 'carousel', caption: 'Legenda preservada.', cta: 'Conheça o contexto.' },
    sources, slides: [{ order: 1, role: 'content', title: 'Título importado diretamente', body: 'Texto de referência do GPT.',
      imageBrief: 'Direção de arte vinculada ao slide.', layoutType: 'editorial' }],
  }
  await page.getByLabel('Conteúdo em JSON ou Markdown').fill(JSON.stringify(response))
  await expect(page.getByText('Prévia indisponível.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Salvar e abrir no Studio' }).click()
  await expect(page).toHaveURL(/#\/studio/)
  await expect(page.getByRole('region', { name: 'Editor Studio' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Projeto' })).toHaveValue('Campanha enviada ao Studio')
  await expect(page.getByRole('region', { name: 'Slides' }).getByRole('button', { name: 'Slide 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Camadas', exact: true }).click()
  await expect(page.getByRole('button', { name: /Título importado diretamente/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Conheça o contexto/ })).toBeVisible()
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Radar' }).click()
  await expect(page.getByRole('heading', { name: 'Revisão editorial' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Fonte com data' }) }))
    .toContainText('18/11/2026')
})
