import { test, expect } from '@playwright/test'

test('navegação, histórico, estados vazios e ausência de overflow', async ({ page }) => {
  await page.goto('/')
  const navigation = page.getByRole('navigation', { name: 'Navegação principal' })
  await navigation.getByRole('link', { name: 'Radar', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Radar')
  await page.getByRole('button', { name: 'Pautas e prompts' }).click()
  await expect(page.getByRole('heading', { name: 'Pautas e campanhas', exact: true })).toBeVisible()
  await navigation.getByRole('link', { name: 'Studio', exact: true }).click()
  await expect(page.getByText('O editor visual ainda não está disponível.', { exact: false })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Radar')
  await navigation.getByRole('link', { name: 'Auditoria', exact: true }).click()
  await expect(page.getByText('Nenhuma arte foi analisada', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('roteiro acessível fecha com Escape e devolve foco', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Roteiro do produto', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Radar funcional')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('link direto e recuperação de rota desconhecida', async ({ page }) => {
  await page.goto('/#/studio')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Studio')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Studio')
  await page.goto('/#/inexistente')
  await page.getByRole('link', { name: 'Voltar ao início' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ideias boas')
})

test('telas pequenas recebem somente orientação para desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Disponível somente para desktop' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).not.toBeVisible()
})
