import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const studioButton = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

test('controles do Studio por teclado preservam o slide e funcionam nas quatro resoluções', async ({ page }) => {
  await page.goto('/#/studio')
  await studioButton(page, 'Criar projeto vazio').click()
  await studioButton(page, 'Adicionar slide').click()
  await studioButton(page, 'Adicionar título').click()
  const slide = studioButton(page, 'Slide 2')
  await expect(slide).toHaveAttribute('aria-pressed', 'true')
  await studioButton(page, 'Desfazer').click()
  await expect(slide).toHaveAttribute('aria-pressed', 'true')
  await studioButton(page, 'Refazer').click()
  await expect(slide).toHaveAttribute('aria-pressed', 'true')
  await studioButton(page, 'Camadas').press('Enter')
  const layer = page.getByRole('button', { name: /Seu título aqui/ })
  await layer.press('Enter')
  await expect(layer).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Texto do elemento').fill('Título editado por teclado')
  await page.getByText('Propriedades avançadas', { exact: true }).click()
  await page.getByLabel('Opacidade').press('ArrowDown')
  await expect(page.getByLabel('Opacidade')).toHaveValue('0.95')
  await page.getByRole('link', { name: 'Radar', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Radar')
  await page.keyboard.press('Delete')
  await page.getByRole('link', { name: 'Studio', exact: true }).click()
  await page.getByRole('button', { name: /Título editado por teclado/ }).press('Enter')
  await expect(page.getByLabel('Texto do elemento')).toHaveValue('Título editado por teclado')
  const menu = page.getByText('Mais ações', { exact: true })
  await menu.press('Enter')
  await studioButton(page, 'Backup completo').focus()
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
  await expect(studioButton(page, 'Backup completo')).not.toBeVisible()
  for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height })
    await studioButton(page, 'Ajustar à tela').click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    const stage = await page.locator('.canvas-stage').boundingBox()
    const paper = await page.locator('.canvas-paper').boundingBox()
    expect(stage && paper && paper.width <= stage.width && paper.height <= stage.height).toBe(true)
  }
})

for (const [format, height] of [['square', 1080], ['story', 1920]] as const) {
  test(`exporta ${format} com forma translúcida e sem guias, mesmo após falha temporária`, async ({ page }, info) => {
    await page.goto('/#/studio')
    await page.getByLabel('Formato do projeto').selectOption(format)
    await studioButton(page, 'Criar projeto vazio').click()
    await studioButton(page, 'Elementos').click()
    await studioButton(page, 'Retângulo').click()
    await page.getByText('Propriedades avançadas', { exact: true }).click()
    await page.getByLabel('Opacidade').fill('0.5')
    await page.getByLabel('X', { exact: true }).fill('160')
    await expect(page.getByLabel('Área segura')).toBeChecked()
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
        if (this.width !== 1080) return original.call(this, callback, ...args)
        HTMLCanvasElement.prototype.toBlob = original
        callback(null)
      }
    })
    await page.getByRole('button', { name: 'Finalizar e exportar', exact: true }).click()
    await studioButton(page, 'Exportar PNG').click()
    await expect(page.getByRole('alert')).toContainText('Não foi possível exportar a imagem.')
    const download = page.waitForEvent('download')
    await studioButton(page, 'Exportar PNG').click()
    const png = await readFile(await (await download).path())
    const image = await loadImage(png)
    expect([image.width, image.height]).toEqual([1080, height])
    const canvas = createCanvas(1080, height)
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data]
    expect(pixel(80, 100)).toEqual(pixel(40, 100))
    expect(pixel(200, 160)[3]).toBe(255)
    expect(pixel(200, 160)[0]).toBeGreaterThan(40)
    expect(pixel(200, 160)[0]).toBeLessThan(pixel(40, 100)[0])
    await info.attach(`exportacao-${format}`, { body: png, contentType: 'image/png' })
  })
}
