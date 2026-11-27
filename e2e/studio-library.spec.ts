import { expect, test } from '@playwright/test'

test('consulta e ajusta consumo pelo teclado na biblioteca do Studio', async ({ page }, info) => {
  let paused = false
  let automaticLimit = 2
  let totalLimit = 3
  await page.route('**/api/visual/budget', async route => {
    const command = route.request().postDataJSON()
    if (command.action === 'settings') {
      paused = command.settings.enabled === undefined ? paused : !command.settings.enabled
      automaticLimit = command.settings.automaticLimit ?? automaticLimit
      totalLimit = command.settings.totalLimit ?? totalLimit
    }
    await route.fulfill({ json: { state: paused ? 'disabled' : 'ready', allowed: false, reason: paused ? 'paused' : undefined,
      canManage: true, freeOnly: true, settings: { enabled: !paused }, totals: { web: 1, images: 0, automatic: 1, manual: 0, diagnostic: 0, cents: 1 },
      limitCents: 500, reserveCents: 50, totalLimit, automaticLimit, confirmedAt: '2026-11-26T10:00:00Z',
      end: '2026-11-27T10:00:00Z', remaining: totalLimit - 1, automaticRemaining: automaticLimit - 1, manualReserveRemaining: 1,
    } })
  })
  await page.goto('/#/studio')
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()
  await page.getByText('Consumo e franquias', { exact: true }).press('Enter')
  await expect(page.getByText('Modo exclusivamente gratuito ativo.')).toBeVisible()
  await expect(page.getByText('1 (1 Web, 0 Images)')).toBeVisible()
  await page.getByLabel('Limite total de consultas').fill('2')
  await page.getByLabel('Limite de consultas automáticas').fill('1')
  await page.getByRole('button', { name: 'Salvar limites' }).press('Enter')
  await expect(page.getByText('Total 2 · Automáticas 1')).toBeVisible()
  await page.getByRole('button', { name: 'Pausar pesquisa Brave' }).press('Enter')
  await expect(page.getByText('Pesquisa Brave pausada pelo proprietário.')).toBeVisible()
  await page.getByLabel('Permitir buscas gratuitas do Openverse neste navegador').uncheck()
  await page.screenshot({ path: info.outputPath('consumo-e-franquias.png'), fullPage: true })
  await page.reload()
  await page.getByText('Consumo e franquias', { exact: true }).press('Enter')
  await expect(page.getByLabel('Permitir buscas gratuitas do Openverse neste navegador')).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Retomar pesquisa Brave' })).toBeVisible()
})

test('organiza, renomeia, duplica e exporta projetos pela biblioteca visual', async ({ page }, info) => {
  await page.goto('/#/studio')
  const create = page.getByText('＋ Novo projeto', { exact: true })
  await create.focus()
  await create.press('Enter')
  await expect(page.getByRole('button', { name: 'Criar projeto vazio' })).toBeVisible()
  await page.getByRole('button', { name: 'Criar projeto vazio' }).press('Escape')
  await expect(create).toBeFocused()
  await create.click()
  await page.getByRole('button', { name: 'Criar projeto vazio' }).click()
  await page.getByRole('button', { name: 'Adicionar título', exact: true }).click()
  await page.getByLabel('Projeto', { exact: true }).fill('Zeta')
  await page.getByRole('button', { name: 'Projetos', exact: true }).click()

  const card = page.getByRole('article').filter({ has: page.getByRole('button', { name: 'Abrir Zeta', exact: true }) })
  await expect(card.locator('img')).toBeVisible()
  await card.getByLabel('Ações de Zeta').click()
  await card.getByRole('button', { name: 'Duplicar' }).click()
  await expect(page.getByRole('button', { name: 'Abrir Zeta (cópia)', exact: true })).toBeVisible()
  const copy = page.getByRole('article').filter({ has: page.getByRole('button', { name: 'Abrir Zeta (cópia)', exact: true }) })
  await copy.getByLabel('Ações de Zeta (cópia)').click()
  await copy.getByRole('button', { name: 'Renomear' }).click()
  await copy.getByLabel('Novo nome').fill('Álbum')
  await copy.getByRole('button', { name: 'Salvar nome' }).click()
  const filter = page.getByRole('searchbox', { name: 'Buscar projetos' })
  await filter.fill('album')
  await expect(page.getByRole('button', { name: 'Abrir Álbum' })).toBeVisible()
  await expect(card).toHaveCount(0)
  await filter.fill('')
  await page.getByLabel('Ordenar projetos').selectOption('created')
  await expect(page.getByRole('article').first().getByRole('button', { name: 'Abrir Álbum' })).toBeVisible()
  await page.getByLabel('Ordenar projetos').selectOption('name')
  await expect(page.getByRole('article').first().getByRole('button', { name: 'Abrir Álbum' })).toBeVisible()
  await page.getByRole('button', { name: 'Lista', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Lista', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const renamed = page.getByRole('article').first()
  await renamed.getByLabel('Ações de Álbum').click()
  const download = page.waitForEvent('download')
  await renamed.getByRole('button', { name: 'Exportar backup ZIP' }).click()
  expect((await download).suggestedFilename()).toMatch(/\.zip$/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Abrir Álbum' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('biblioteca-projetos.png') })
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
