import { expect, test } from '@playwright/test'

test('ID externo e decisões da peça sobrevivem à edição, persistência e backup do Studio', async ({ page }) => {
  await page.goto('/#/inicio')
  const first = await page.evaluate(async () => {
    const contracts = '/src/features/campaigns/contract.ts'
    const identity = '/src/features/campaigns/slideIdentity.ts'
    const express = '/src/features/studio/expressDraft.ts'
    const templates = '/src/features/studio/templates.ts'
    const model = '/src/features/studio/model.ts'
    const storage = '/src/features/studio/storage.ts'
    const { importContent, newDraft, defaultPreferences } = await import(contracts)
    const { identifyContent } = await import(identity)
    const { reconcileExpressSlides, openExpressDraft } = await import(express)
    const { fromCampaign } = await import(templates)
    const { defaultBrand } = await import(model)
    const { saveProject, backupProject, restoreProject } = await import(storage)
    const content = identifyContent(importContent(JSON.stringify({ schemaVersion: 1,
      campaign: { title: 'IDs persistentes', objective: 'Informar', audience: '', tone: 'Direto', format: 'carousel', caption: '', cta: '' }, sources: [],
      slides: [{ id: 'capa-externa', order: 1, role: 'cover', title: 'Título', body: 'Corpo', imageBrief: '', layoutType: 'text' },
        { order: 2, role: 'content', title: 'Legado', body: 'Texto preservado', imageBrief: '', layoutType: 'text' }] })))
    const draft = { ...newDraft(null, defaultPreferences), content }
    const project = fromCampaign(draft, defaultBrand)
    await saveProject(project)
    const restored = await restoreProject(new File([await backupProject(project)], 'backup.zip'))
    const before = { key: 'capa-externa', id: 'capa-externa', title: 'Antes', body: 'Antes', imageId: 'foto', imageLocked: true,
      framing: 'contain', focalPoint: { x: .3, y: .6 }, composition: 3, visualDecision: 'approved', discardedVisuals: ['url:recusada'] }
    const slides = reconcileExpressSlides([{ id: 'nova', title: 'Adicionada', body: '' },
      { id: before.id, title: 'Título alterado', body: 'Corpo alterado', imageBrief: 'Outro contexto' }], [before], () => crypto.randomUUID())
    const slot = openExpressDraft('evolution13')
    await slot.save({ text: '', slides, name: 'Regressão', styleId: 'swiss', format: 'portrait', step: 'Conteúdo', origin: 'local', photos: [] })
    return { ids: project.slides.map((slide: { id: string }) => slide.id), restored: restored.slides.map((slide: { id: string }) => slide.id) }
  })
  expect(first.ids[0]).toBe('capa-externa')
  expect(first.ids[1]).toMatch(/^[0-9a-f-]{36}$/)
  expect(first.restored).toEqual(first.ids)
  await page.reload()
  const persisted = await page.evaluate(async () => {
    const path = '/src/features/studio/expressDraft.ts'
    const { openExpressDraft } = await import(path)
    return (await openExpressDraft('evolution13').load()).slides
  })
  expect(persisted[1]).toMatchObject({ key: 'capa-externa', id: 'capa-externa', imageId: 'foto', imageLocked: true,
    framing: 'contain', focalPoint: { x: .3, y: .6 }, composition: 3, visualDecision: 'approved', needsImageReview: true })
  expect(persisted[0].imageId).toBeUndefined()
})

test('Radar aprende somente no navegador, redefine preferências e mantém o desktop sem overflow', async ({ page }, info) => {
  await page.goto('/#/radar')
  const card = page.locator('.news-story').first()
  await card.getByRole('button', { name: 'Menos como esta', exact: true }).click()
  await expect(page.getByText('Preferência editorial ajustada neste navegador.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('post-machine:radar-editorial-preferences:v1') ?? '{}')).length)).toBe(1)
  await page.reload()
  await page.getByRole('button', { name: 'Mais filtros', exact: true }).click()
  await page.getByRole('combobox', { name: 'Interesse', exact: true }).selectOption('design')
  await expect(page.getByRole('button', { name: 'Remover filtro Para designers', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Redefinir preferências editoriais', exact: true }).click()
  expect(await page.evaluate(() => localStorage.getItem('post-machine:radar-editorial-preferences:v1'))).toBe('{}')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('radar-evolution13.png'), fullPage: true })
})
