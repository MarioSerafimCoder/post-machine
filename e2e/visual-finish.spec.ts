import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'

test('revisão automática, exportação completa e alterações posteriores sobrevivem à recarga', async ({ page }) => {
  await page.goto('/#/studio')
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  await button('Criar projeto vazio').click()
  await page.getByLabel('Projeto', { exact: true }).fill('Entrega editorial')
  await button('Adicionar título').click()
  await page.getByLabel('Texto do elemento').fill('Uma composição editorial')
  await expect(button('Slide 1')).toHaveAccessibleDescription('0 erros, 0 avisos')
  await button('Finalizar e exportar').click()
  const panel = page.getByRole('region', { name: 'Central de exportação' })
  await expect(panel.getByText('Revisão atual', { exact: true })).toBeVisible()
  const download = page.waitForEvent('download')
  await button('Exportar ZIP').click()
  const zip = await JSZip.loadAsync(await readFile(await (await download).path()))
  expect(Object.keys(zip.files)).toEqual(['01-Entrega-editorial.png'])
  await expect(panel.getByText('Exportado', { exact: true })).toBeVisible()
  await button('Fechar exportação').click()
  await expect(button('Finalizar e exportar')).toBeFocused()
  await page.reload()
  await button('Abrir Entrega editorial').click()
  await button('Finalizar e exportar').click()
  await expect(panel.getByText('Exportado', { exact: true })).toBeVisible()
  await page.getByLabel('Legenda', { exact: true }).fill('Nova legenda após exportar.')
  await expect(panel.getByText('Alterado após exportação', { exact: true })).toBeVisible()
  await button('Fechar exportação').click()
  await page.getByRole('link', { name: 'Auditoria', exact: true }).click()
  await page.getByRole('button', { name: 'Revisar projeto: Entrega editorial' }).click()
  await expect(page.getByRole('button', { name: 'Baixar relatório JSON' })).toBeVisible()
})

test('inspeção visual das superfícies criativas em cinco resoluções desktop', async ({ page }, info) => {
  test.skip(info.project.name === 'laptop', 'Matriz desktop completa em uma execução.')
  test.setTimeout(120_000)
  const sizes = [[1280,800], [1440,900], [1366,768], [1920,1080], [2560,1440]]
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  const shot = async (name: string, width: number) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.screenshot({ path: info.outputPath(`${name}-${width}.png`), animations: 'disabled' })
  }
  await page.goto('/#/studio')
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  await button('Criar projeto vazio').click()
  await page.getByLabel('Projeto', { exact: true }).fill('Design em movimento')
  await button('Templates').click()
  await button('Capa editorial').click()
  await button('Camadas').click()
  await page.getByRole('button', { name: /^2 ·/ }).click()
  await page.getByLabel('Texto do elemento').fill('Design em movimento')
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    await button('Ajustar à tela').click()
    await expect(button('Adicionar slide')).toBeInViewport()
    await shot('studio-propriedades', width)
    await button('Assistente Editorial').hover()
    await expect(button('Assistente Editorial')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await button('Assistente Editorial').click()
    await shot('assistente', width)
    await page.keyboard.press('Escape')
    await button('Finalizar e exportar').click()
    await expect(page.getByRole('region', { name: 'Central de exportação' }).getByText('Revisão atual', { exact: true })).toBeVisible()
    await shot('finalizacao', width)
    await button('Fechar exportação').click()
  }
  await button('Projetos').click()
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    await shot('biblioteca', width)
    for (const [route, name] of [['inicio','Início'], ['radar','Radar'], ['auditoria','Auditoria']] as const) {
      await page.getByRole('link', { name, exact: true }).click()
      if (route === 'radar') {
        await page.locator('.news-story').first().waitFor()
        const opportunities = page.getByRole('button', { name: 'Oportunidades', exact: true })
        const fits = await opportunities.evaluate(button => {
          const label = button.querySelector('span')!.getBoundingClientRect()
          const bounds = button.getBoundingClientRect()
          return label.left >= bounds.left && label.right <= bounds.right && button.scrollWidth <= button.clientWidth
        })
        expect(fits).toBe(true)
      }
      if (route === 'inicio') await page.getByRole('button', { name: 'Continuar editando: Design em movimento' }).waitFor()
      await shot(route, width)
    }
    await page.getByRole('link', { name: 'Studio', exact: true }).click()
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.library-card').first()).toHaveCSS('transition-duration', '0s')
})
