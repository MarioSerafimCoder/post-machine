import { expect, test } from '@playwright/test'

test('detecta caixa vazia em edição e revisa a sequência do carrossel', async ({ page }, info) => {
  await page.goto('/#/studio')
  await page.getByRole('button', { name: 'Criar projeto vazio' }).click()
  await page.getByRole('button', { name: 'Adicionar título', exact: true }).click()
  const field = page.getByLabel('Texto do elemento')
  await field.fill('')
  const dock = page.getByRole('complementary', { name: 'Assistente Editorial' })
  const balloon = dock.getByRole('region', { name: 'Insight editorial' })
  await expect(balloon).toContainText('Campo de texto vazio')
  const first = page.getByRole('button', { name: 'Slide 1', exact: true }).locator('img')
  await expect(first).toBeVisible()
  const emptySource = await first.getAttribute('src')
  await field.fill('Arquitetura dos pátios urbanos')
  await expect(balloon.getByText('Campo de texto vazio', { exact: false })).toBeHidden()
  await expect(first).not.toHaveAttribute('src', emptySource!)
  await page.getByRole('button', { name: 'Duplicar slide', exact: true }).click()
  const source = await first.getAttribute('src')
  const second = page.getByRole('button', { name: 'Slide 2', exact: true }).locator('img')
  await expect(second).toBeVisible()
  const before = await second.getAttribute('src')
  await page.getByRole('button', { name: 'Revisar carrossel' }).click()
  const review = page.getByRole('region', { name: 'Revisão editorial do projeto' })
  await expect(review).toContainText('Slide 2 repete o título do slide 1.')
  await review.getByText('Revisar coerência editorial no GPT').click()
  await expect(review.getByLabel('Prompt de revisão')).toHaveValue(/Arquitetura dos pátios urbanos/)
  await expect(review.getByRole('link', { name: 'Abrir ChatGPT' })).toHaveAttribute('href', 'https://chatgpt.com/')
  await page.screenshot({ path: info.outputPath('revisao-editorial.png') })
  await review.getByRole('button', { name: 'Fechar revisão editorial' }).click()
  await page.getByRole('button', { name: 'Camadas', exact: true }).click()
  await page.getByRole('button', { name: /· Arquitetura dos pátios urbanos$/ }).click()
  await field.fill('Como o pátio organiza a vizinhança')
  await expect(second).not.toHaveAttribute('src', before!)
  await expect(first).toHaveAttribute('src', source!)
})

test('prévia identifica campos extras e usa direção de imagem na Produção Expressa', async ({ page }, info) => {
  await page.goto('/#/studio')
  await page.getByRole('button', { name: 'Produção Expressa', exact: true }).click()
  await page.getByLabel('Cole aqui o conteúdo do seu post ou carrossel').fill(JSON.stringify({
    schemaVersion: 1,
    campaign: { title: 'Pátios urbanos', objective: 'Educar', audience: 'Designers', tone: 'Profissional', format: 'post', caption: 'Sobre pátios.', cta: 'Salve a referência.' },
    sources: [],
    slides: [{ order: 1, role: 'content', title: 'O pátio e a luz', body: 'Aberturas definem a entrada de luz.', imageBrief: 'pátio interno arquitetura', layoutType: 'editorial', tags: ['referência'] }],
  }))
  await expect(page.getByText('Prévia · 1 peça(s) · Pátios urbanos')).toBeVisible()
  await expect(page.getByText(/Campos fora do modelo ignorados.*slides\[1\]\.tags/)).toBeVisible()
  await page.screenshot({ path: info.outputPath('previa-gpt.png') })
  await page.getByRole('button', { name: 'Organizar slides' }).click()
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('O pátio e a luz')
  await page.getByRole('navigation', { name: 'Etapas da Produção Expressa' }).getByRole('button', { name: 'Imagens' }).click()
  await page.getByRole('button', { name: 'Openverse', exact: true }).click()
  await page.getByLabel('Buscar pelo conteúdo do slide').selectOption({ label: 'Slide 1 · O pátio e a luz' })
  await expect(page.getByLabel('Termo de pesquisa')).toHaveValue('pátio interno arquitetura')
  await page.getByLabel('Licença', { exact: true }).selectOption('by')
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 300
    canvas.getContext('2d')!.fillRect(0, 0, 400, 300)
    return canvas.toDataURL().split(',')[1]
  }), 'base64')
  await page.route('https://api.openverse.org/v1/images/?*', route => {
    const params = new URL(route.request().url()).searchParams
    expect(params.get('q')).toBe('pátio interno arquitetura')
    expect(params.get('license')).toBe('by')
    return route.fulfill({ json: { page_count: 1, results: [{
      id: 'ee293bf3-d38a-4162-aca8-771708adc0b8', title: 'Pátio da fixture', creator: 'Autor da fixture', source: 'flickr',
      url: 'https://live.staticflickr.com/patio.png', foreign_landing_url: 'https://www.flickr.com/photos/fixture',
      width: 400, height: 300, filetype: 'png', license: 'by', license_version: '4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/',
    }] } })
  })
  await page.route('https://live.staticflickr.com/patio.png', route => route.fulfill({
    contentType: 'image/png', headers: { 'access-control-allow-origin': '*' },
    body: png,
  }))
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click()
  await page.getByRole('button', { name: 'Ver detalhes', exact: true }).click()
  await expect(page.getByText('Atribuição exigida.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Vincular ao slide com créditos' }).click()
  await expect(page.getByText('Imagem inserida com os créditos vinculados.')).toBeVisible()
  await expect(page.getByLabel('Imagem do slide 1')).toHaveValue(/^[a-f0-9]{64}$/)
})
