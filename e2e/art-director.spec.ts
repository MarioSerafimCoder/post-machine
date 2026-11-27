import { expect, test } from '@playwright/test'

test('importa arquivo JSON pela entrada principal e abre projeto editável sem montar manualmente', async ({ page }, info) => {
  const id = '0464faaa-ca8d-4e02-8dcd-8db12c7cc8c7'
  await page.route('**/api/visual/**', route => route.fulfill({ json: { state: 'disabled', candidates: [] } }))
  await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { results: [], result_count: 0, page_count: 0 } }))
  await page.goto('/#/inicio')
  await page.getByRole('button', { name: /^Criar conteúdo/ }).click()
  await page.getByLabel('Arquivo para criar conteúdo').setInputFiles({
    name: 'projeto.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
      schemaVersion: 1, campaign: { title: 'Detalhes de arquitetura', objective: 'Informar', audience: '', tone: 'Profissional', format: 'post', caption: 'Legenda preservada.', cta: '' },
      sources: [], slides: [{ id, order: 1, role: 'cover', title: 'Camadas e ritmos', body: 'Uma composição em dois planos.', imageBrief: 'Somente texto', layoutType: 'text' }],
    })),
  })
  await expect(page.getByRole('region', { name: 'Editor Studio' })).toBeVisible()
  await expect(page.getByLabel('Projeto', { exact: true })).toHaveValue('Detalhes de arquitetura')
  await expect(page.locator('.canvas-container canvas').first()).toBeVisible()
  await page.screenshot({ path: info.outputPath('importacao-inteligente.png') })
  const stored = await page.evaluate(async () => {
    const { recentProjects } = await import('/src/features/studio/database.ts' as string)
    const { loadProject } = await import('/src/features/studio/storage.ts' as string)
    const [first] = await recentProjects()
    return loadProject(first.id)
  })
  expect(stored.slides[0].id).toBe(id)
  expect(stored.caption).toBe('Legenda preservada.')
})

test('montagem automática abre arte editável sem foto e preserva o texto', async ({ page }) => {
  await page.goto('/#/studio')
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  await page.getByRole('button', { name: 'Preparar carrossel', exact: true }).click()
  await page.getByLabel('Cole aqui o conteúdo do seu post ou carrossel').fill(
    'Slide 1 — Identidade visual da marca\nUma introdução.\nSlide 2 — Conclusão\nO texto final permanece íntegro.')
  await page.getByRole('button', { name: 'Organizar slides' }).click()
  await page.getByRole('button', { name: 'Montar automaticamente' }).click()
  await expect(page.getByRole('region', { name: 'Slides', exact: true }).getByRole('button', { name: /^Slide [1-2]$/ })).toHaveCount(2)
  await expect(page.getByRole('textbox', { name: 'Projeto', exact: true })).toHaveValue('Identidade visual da marca')
  await expect(page.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible()
  const texts = await page.evaluate(async () => {
    const modulePath = '/src/features/studio/storage.ts'
    const { listProjects, loadProject } = await import(/* @vite-ignore */ modulePath)
    const { projects } = await listProjects()
    const project = await loadProject(projects[0].id)
    return project.slides.flatMap((slide: { scene: { objects: { text?: string }[] } }) =>
      slide.scene.objects.map((object: { text?: string }) => object.text).filter(Boolean))
  })
  expect(texts).toEqual(expect.arrayContaining(['Identidade visual da marca', 'O texto final permanece íntegro.']))
})
