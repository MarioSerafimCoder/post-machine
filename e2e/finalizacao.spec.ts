import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('finaliza, mantém legenda e cancela uma renderização sem alterar o projeto', async ({ page, context }, info) => {
  test.skip(info.project.name === 'laptop','O cenário percorre as quatro resoluções desktop')
  await context.grantPermissions(['clipboard-read','clipboard-write'])
  await page.goto('/#/studio')
  const button = (name: string) => page.getByRole('button',{name,exact:true})
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  await button('Criar projeto vazio').click()
  await page.getByRole('textbox',{name:'Projeto',exact:true}).fill('Finalização QA')
  await button('Finalizar e exportar').click()
  const region = page.getByRole('region',{name:'Central de exportação'})
  await expect(region.getByText('Revisão atual',{exact:true})).toBeVisible()
  const caption = region.getByRole('textbox',{name:'Legenda',exact:true})
  await expect(caption).toHaveValue('')
  const text = 'Criação e revisão — ação editorial.\nSegunda linha.'
  await caption.fill(text)
  await button('Copiar legenda').click()
  await expect(region.getByRole('status')).toHaveText('Legenda copiada.')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied.replace(/\r\n/g,'\n')).toBe(text)
  for (const [width,height] of [[1024,768],[1280,800],[1440,900],[1920,1080]]) {
    await page.setViewportSize({width,height})
    await expect(region).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.screenshot({path:info.outputPath('finalizacao-' + width + '.png')})
  }
  const txt = page.waitForEvent('download')
  await button('Baixar legenda').click()
  expect(await readFile(await (await txt).path(),'utf8')).toBe(text)

  await page.evaluate(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      if (this.width !== 1080) return toBlob.call(this,callback,...args)
      HTMLCanvasElement.prototype.toBlob = toBlob
      window.setTimeout(() => toBlob.call(this,callback,...args),500)
    }
  })
  const unexpected: string[] = []
  const trackDownload = (event: import('@playwright/test').Download) => unexpected.push(event.suggestedFilename())
  page.on('download',trackDownload)
  await button('Exportar PNG').click()
  await expect(region.getByRole('status').filter({hasText:'Renderizando'})).toBeVisible()
  await button('Cancelar operação').click()
  await expect(region.getByRole('status')).toHaveText('Exportação cancelada.')
  expect(unexpected).toEqual([])
  page.off('download',trackDownload)
  const png = page.waitForEvent('download')
  await button('Exportar PNG').click()
  expect((await png).suggestedFilename()).toBe('Finalizacao-QA-01.png')
  await button('Projetos').click()
  await button('Abrir Finalização QA').click()
  await button('Finalizar e exportar').click()
  await expect(caption).toHaveValue(text)
  await expect(page.getByRole('region',{name:'Slides',exact:true}).getByRole('button',{name:'Slide 1',exact:true})).toHaveAccessibleDescription('0 erros, 0 avisos')
})
