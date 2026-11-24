import { expect, test, type Page, type TestInfo } from '@playwright/test'

const sizes = [[1024, 800], [1280, 800], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440]]

async function inspect(page: Page, info: TestInfo, name: string) {
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    const issues = await page.evaluate(() => {
      const problems: string[] = []
      if (document.documentElement.scrollWidth > innerWidth) problems.push('Página com rolagem horizontal')
      for (const node of document.querySelectorAll<HTMLElement>('button, summary, label, .context-rail span')) {
        if (!node.checkVisibility() || node.closest('.editorial-launcher, .sr-only')) continue
        const css = getComputedStyle(node)
        if (['hidden', 'auto', 'scroll'].includes(css.overflowX)) continue
        if (node.scrollWidth > node.clientWidth + 2) problems.push(`${node.tagName}: ${node.innerText.trim().slice(0, 80)}`)
      }
      for (const label of document.querySelectorAll<HTMLElement>('.context-rail button > span')) {
        if (!label.checkVisibility()) continue
        const button = label.parentElement!.getBoundingClientRect(), text = label.getBoundingClientRect()
        if (text.left < button.left || text.right > button.right || getComputedStyle(label).textAlign !== 'center') problems.push(`Menu: ${label.textContent}`)
      }
      return problems
    })
    await page.screenshot({ path: info.outputPath(`${name}-${width}.png`), animations: 'disabled' })
    expect(issues, `${name} em ${width}px`).toEqual([])
  }
}

test('menus e formulários mantêm textos contidos e alinhados no desktop', async ({ page }, info) => {
  test.skip(info.project.name === 'laptop', 'A matriz já inclui seis resoluções desktop.')
  test.setTimeout(180_000)
  const button = (name: string) => page.getByRole('button', { name, exact: true })
  const nav = (name: string) => page.getByRole('link', { name, exact: true }).click()
  await page.goto('/#/radar')
  await button('Mais filtros').click()
  await inspect(page, info, 'radar-filtros')
  await button('Pautas e prompts').click()
  await button('Nova campanha').click()
  await button('Começar do zero').click()
  await expect(page.getByRole('heading', { name: 'Briefing editorial' })).toBeVisible()
  await inspect(page, info, 'briefing')
  await button('Gerar prompt para IA').click()
  await expect(page.getByLabel('Conteúdo em JSON ou Markdown')).toBeVisible()
  await inspect(page, info, 'importacao')
  await button('Virais e formatos').click()
  await button('Adicionar referência').click()
  await inspect(page, info, 'referencias')
  await nav('Auditoria')
  await expect(page.getByRole('heading', { name: 'Nenhum projeto para revisar' })).toBeVisible()
  await inspect(page, info, 'auditoria-vazia')
  await nav('Studio')
  await expect(page.getByRole('heading', { name: 'Seus projetos aparecem aqui' })).toBeVisible()
  await inspect(page, info, 'biblioteca-vazia')
  await page.getByText('＋ Novo projeto', { exact: true }).click()
  await button('Criar projeto vazio').click()
  await button('Minha marca').click()
  await inspect(page, info, 'marca')
  await button('Texto').click()
  await button('Adicionar título').click()
  await page.getByText('Propriedades avançadas', { exact: true }).click()
  await inspect(page, info, 'propriedades-texto')
  await button('Imagens').click()
  await button('Buscar imagem para este slide').click()
  await inspect(page, info, 'pesquisa-imagens')
  await page.getByText('Mais ações', { exact: true }).click()
  await inspect(page, info, 'menu-studio')
  await page.keyboard.press('Escape')
  await page.getByText('Revisar', { exact: true }).click()
  await button('Problemas técnicos').click()
  await page.getByText('Regras da marca e limites', { exact: true }).click()
  await inspect(page, info, 'auditoria-regras')
})
