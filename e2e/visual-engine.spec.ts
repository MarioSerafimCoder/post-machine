import { expect, test } from '@playwright/test'
import { createCanvas } from '@napi-rs/canvas'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'

const source = 'https://www.geico.com/about/pressreleases/2026/20261123/'
const campaignName = 'How 15% Saved Christmas'
const title = 'Um filme criado quadro a quadro'
const editor = 'Editor Studio'
function poster(version: number) {
  const canvas = createCanvas(850, 680)
  const draw = canvas.getContext('2d')
  draw.fillStyle = '#f8e5c9'
  draw.fillRect(0, 0, 850, 680)
  for (let index = 0; index < 9; index++) {
    draw.fillStyle = index % 2 ? '#ca322a' : '#214242'
    if (version === 1) draw.fillRect(35 + index * 92, 100 + index * 30, 45, 305)
    else if (version === 2) draw.fillRect(410 - index * 32, index * 69, 480 - index * 31, 30)
    else { draw.beginPath(); draw.arc(75 + index * 84, index % 2 ? 215 : 460, 45 + index * 3, 0, Math.PI * 2); draw.fill() }
  }
  return canvas.toBuffer('image/png')
}

test('valida a referência importada, pesquisa no Studio e mantém a substituição no backup', async ({ page }) => {
  const hint = { imageUrl: documentary[0].url, sourceUrl: source, description: 'Still do filme de Natal da GEICO.' }
  const alternative = { ...documentary[0], evidence: 'figure', title: 'Outro still do filme',
    caption: campaignName + ' — still alternativo do filme', url: 'https://www.geico.com/public/images/test/alternate.png', ticket: 'alternate' }
  let imageQueries = 0
  const downloadTickets: string[] = []
  await page.route('**/api/visual/page', route => {
    expect(route.request().postDataJSON().preferredImages).toEqual([hint.imageUrl])
    return route.fulfill({ json: { candidates: [documentary[0]] } })
  })
  await page.route('**/api/visual/brave', route => {
    imageQueries++
    expect(route.request().postDataJSON()).toMatchObject({ kind: 'images', query: 'GEICO How 15% Saved Christmas film still' })
    return route.fulfill({ json: { state: 'ok', candidates: [alternative] } })
  })
  await page.route('**/api/visual/download', route => {
    const { ticket } = route.request().postDataJSON()
    downloadTickets.push(ticket)
    return route.fulfill({ contentType: 'image/png', body: poster(ticket === 'alternate' ? 3 : 1) })
  })
  const data = { schemaVersion: 1, campaign: { title, audience: '', objective: 'Informar', tone: 'Profissional',
    format: 'carousel', caption: '', cta: '', visualContext: { subject: 'GEICO apresenta ' + campaignName,
      campaignName, entities: ['GEICO'], visualCandidates: [hint] } },
  sources: [{ url: source, title: 'GEICO — comunicado de ' + campaignName }],
  slides: [
    { order: 1, role: 'cover', title, body: 'Um curta de Natal realizado em stop motion.', imageBrief: 'Still do filme',
      layoutType: 'photo', visualContext: { visualCandidates: [hint], searchQueries: ['GEICO How 15% Saved Christmas film still'] } },
    { order: 2, role: 'content', title: 'Como foi feito', body: 'A técnica é parte da narrativa.', imageBrief: 'Somente texto', layoutType: 'textual' },
    { order: 3, role: 'cta', title: 'Veja o curta', body: 'Confira a peça na página da campanha.', imageBrief: 'Somente texto', layoutType: 'textual' },
  ] }
  await page.goto('/#/inicio')
  await page.getByRole('button', { name: /^Criar conteúdo/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Importar conteúdo' }).click()
  await page.getByLabel('Cole aqui o conteúdo do seu post ou carrossel').fill(JSON.stringify(data))
  const studio = page.getByRole('region', { name: editor })
  await expect(studio.getByRole('button', { name: 'Slide 1', exact: true })).toHaveAttribute('aria-description', /Imagem encontrada/)
  expect(imageQueries).toBe(0)
  await studio.getByRole('button', { name: 'Imagens', exact: true }).click()
  await studio.getByRole('button', { name: 'Substituir imagem', exact: true }).click()
  await expect(studio.getByLabel('Consulta visual')).toHaveValue('GEICO How 15% Saved Christmas film still')
  await studio.getByRole('button', { name: 'Pesquisar imagens relacionadas' }).click()
  await expect(studio.getByRole('link', { name: 'Conferir fonte' })).toHaveAttribute('href', source)
  await studio.getByRole('button', { name: 'Aplicar ao slide' }).click()
  await expect(studio.getByText('Imagem aplicada ao slide.')).toBeVisible()
  await expect(studio.getByText('Confirmado manualmente', { exact: true })).toBeVisible()
  await studio.getByRole('button', { name: 'Travar imagem' }).click()
  await expect(studio.getByRole('group', { name: 'Origem da imagem' }).getByRole('button', { name: 'Substituir imagem' })).toBeDisabled()
  const saved = page.waitForEvent('download')
  await studio.getByRole('button', { name: 'Baixar backup ZIP', exact: true }).click()
  const zip = await JSZip.loadAsync(await readFile(await (await saved).path()))
  const project = JSON.parse(await zip.file('project.json')!.async('string'))
  expect(project.importedContent.campaign.visualContext.visualCandidates).toEqual([hint])
  expect(project.slides[0].visualContext.visualCandidates).toEqual([hint])
  expect(project.slides[0].visualChoice).toMatchObject({ mode: 'locked', decision: 'replaced', match: { classification: 'confirmed' } })
  expect(project.slides[0].scene.objects.filter((object: { semantic: string }) => object.semantic === 'image'))
    .toMatchObject([{ imageCredit: { originalUrl: alternative.url } }])
  await expect(studio.getByRole('status').filter({ hasText: /^Salvo$/ })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Abrir ' + title, exact: true }).click()
  await studio.getByRole('button', { name: 'Imagens', exact: true }).click()
  await expect(studio.getByRole('button', { name: 'Destravar imagem', exact: true })).toBeVisible()
  expect(imageQueries).toBe(1)
  expect(downloadTickets).toEqual(['official-cover', 'alternate'])
})
const documentary = [
  { url: 'https://www.geico.com/public/images/aboutgeico/GEICO_15_Percent_Saved_Christmas.jpg', page: source,
    provider: 'official', evidence: 'structured', ticket: 'official-cover', title: 'GEICO — ' + campaignName,
    caption: 'GEICO — ' + campaignName + ' — still do filme' },
  { url: 'https://www.geico.com/public/images/test/workshop.png', page: source, provider: 'official',
    evidence: 'figure', ticket: 'official-workshop', title: campaignName,
    caption: 'How 15% Saved Christmas — bastidores, bonecos e oficina', section: 'Bastidores' },
  { url: 'https://www.geico.com/public/images/test/parade.png', page: source, provider: 'original', evidence: 'figure',
    ticket: 'excluded-parade', title: campaignName, caption: 'Road Trip to Parade — float de GEICO' },
]

test('verifica candidatos da página compartilhada e reabre o projeto com os créditos da alternativa', async ({ page }) => {
  const failed = { ...documentary[0], url: 'https://www.geico.com/frames/primary.jpg', ticket: 'failed-primary' }
  const alternative = { ...documentary[0], author: 'Crédito do still alternativo' }
  const workshopAlias = 'https://www.geico.com/frames/workshop-small.jpg'
  const workshop = { ...documentary[1], alternateUrls: [workshopAlias], author: 'Crédito da oficina' }
  const wrong = { ...documentary[2], caption: 'Road Trip to Parade — bonecos na oficina' }
  const absent = 'https://www.geico.com/frames/unlisted.jpg'
  const hint = (imageUrl: string) => ({ imageUrl, sourceUrl: source, description: campaignName + ' — bonecos na oficina' })
  let sourceRequests = 0
  let searches = 0
  const downloads: string[] = []
  await page.route('**/api/visual/page', route => {
    sourceRequests++
    expect(route.request().postDataJSON()).toMatchObject({ url: source, preferredImages: [failed.url, wrong.url, workshop.url, absent, alternative.url, workshopAlias] })
    return route.fulfill({ json: { candidates: [wrong, workshop, alternative, failed] } })
  })
  await page.route('**/api/visual/brave', route => {
    searches++
    return route.fulfill({ json: { state: 'disabled', candidates: [] } })
  })
  await page.route('**/api/visual/download', route => {
    const { ticket } = route.request().postDataJSON()
    downloads.push(ticket)
    return ticket === failed.ticket ? route.fulfill({ status: 422, json: { error: 'image_unavailable' } }) :
      route.fulfill({ contentType: 'image/png', body: poster(ticket === workshop.ticket ? 2 : 1) })
  })
  const headline = 'O filme e a oficina'
  const data = {
    schemaVersion: 1, campaign: { title: headline, audience: '', objective: 'Informar', tone: 'Profissional',
      format: 'carousel', caption: '', cta: '', visualContext: { campaignName, subject: 'GEICO — ' + campaignName, entities: ['GEICO'] } },
    sources: [],
    slides: [
      { order: 1, role: 'cover', title: headline, body: 'Conheça o curta.', layoutType: 'photo', imageBrief: 'Imagem do filme',
        visualContext: { visualCandidates: [hint(failed.url), hint(workshop.url), hint(alternative.url)] } },
      { order: 2, role: 'content', title: 'Bonecos na oficina', body: 'O trabalho nos bastidores.', layoutType: 'photo', imageBrief: 'Bonecos na oficina',
        visualContext: { visualCandidates: [hint(wrong.url), hint(absent), hint(workshopAlias)] } },
    ],
  }
  await page.goto('/#/inicio')
  await page.getByRole('button', { name: /^Criar conteúdo/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Importar conteúdo' }).click()
  await page.getByLabel('Cole aqui o conteúdo do seu post ou carrossel').fill(JSON.stringify(data))
  const studio = page.getByRole('region', { name: editor })
  for (const order of [1, 2]) {
    await expect(studio.getByRole('button', { name: 'Slide ' + order, exact: true })).toHaveAttribute('aria-description', /Imagem encontrada/)
  }
  expect(sourceRequests).toBe(1)
  expect(searches).toBe(0)
  expect([...downloads].sort()).toEqual([failed.ticket, alternative.ticket, workshop.ticket].sort())
  await expect(studio.getByRole('status').filter({ hasText: /^Salvo$/ })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Abrir ' + headline, exact: true }).click()
  const saved = page.waitForEvent('download')
  await studio.getByRole('button', { name: 'Baixar backup ZIP', exact: true }).click()
  const zip = await JSZip.loadAsync(await readFile(await (await saved).path()))
  const project = JSON.parse(await zip.file('project.json')!.async('string'))
  for (const [index, asset] of [alternative, workshop].entries()) {
    expect(project.slides[index].visualChoice.match.classification).toBe('confirmed')
    expect(project.slides[index].scene.objects).toEqual(expect.arrayContaining([expect.objectContaining({
      semantic: 'image', imageCredit: expect.objectContaining({ originalUrl: asset.url, sourcePage: source, creator: asset.author }),
    })]))
  }
  expect(sourceRequests).toBe(1)
})

test('investiga somente páginas indicadas e mostra bloqueio com orçamento Brave esgotado', async ({ page }) => {
  const refused = 'https://www.example.com/gallery'
  const pages: string[] = []
  let braveChecks = 0
  await page.route('**/api/visual/page', route => {
    const { url, preferredImages } = route.request().postDataJSON()
    expect(preferredImages).toBeUndefined()
    pages.push(url)
    return url === refused ? route.fulfill({ status: 403, json: { error: 'destination_rejected' } }) :
      route.fulfill({ json: { candidates: [documentary[0]] } })
  })
  await page.route('**/api/visual/brave', route => {
    braveChecks++
    return route.fulfill({ status: 429, json: { state: 'limited', reason: 'exhausted', candidates: [] } })
  })
  await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { page_count: 0, results: [] } }))
  await page.route('**/api/visual/download', route => {
    expect(route.request().postDataJSON().ticket).toBe('official-cover')
    return route.fulfill({ contentType: 'image/png', body: poster(1) })
  })
  await page.goto('/#/inicio')
  await page.getByRole('button', { name: /^Criar conteúdo/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Importar conteúdo' }).click()
  await page.getByLabel('Cole aqui o conteúdo do seu post ou carrossel').fill(JSON.stringify({
    schemaVersion: 1, campaign: { title, audience: '', objective: 'Informar', tone: 'Profissional',
      format: 'carousel', caption: '', cta: '', visualContext: { campaignName } }, sources: [],
    slides: [
      { order: 1, role: 'cover', title, body: 'Conheça o filme.', imageBrief: 'Still do filme', layoutType: 'photo',
        visualContext: { preferredSourceUrls: [source] } },
      { order: 2, role: 'content', title: 'Fachada do estúdio', body: 'Visão externa.', imageBrief: 'Fachada do estúdio', layoutType: 'photo',
        visualContext: { preferredSourceUrls: [refused] } },
    ],
  }))
  const studio = page.getByRole('region', { name: editor })
  await expect(studio.getByRole('button', { name: 'Slide 1', exact: true })).toHaveAttribute('aria-description', /Imagem encontrada/)
  const pending = studio.getByRole('button', { name: 'Slide 2', exact: true })
  await expect(pending).toHaveAttribute('aria-description', /Alternativa editorial · revisão pendente/)
  await pending.click()
  await studio.getByRole('button', { name: 'Imagens', exact: true }).click()
  await expect(studio.getByText(/A fonte não permite acessar a imagem/)).toBeVisible()
  expect([...pages].sort()).toEqual([source, refused].sort())
  expect(braveChecks).toBe(1)
})

test('autoriza domínio, carrega referência sem legenda e mantém a conferência ao reabrir', async ({ page }) => {
  const addressed = 'https://publisher.example.com/work/'
  const asset = { ...documentary[0], url: 'https://publisher.example.com/picture.png', page: addressed,
    evidence: 'body', caption: undefined, author: 'Estúdio de teste' }
  await page.route('**/api/visual/page', route => route.fulfill({ json: route.request().headers()['x-visual-source-approvals'] === 'test.grant'
    ? { state: 'ok', candidates: [asset] } : { state: 'authorization', candidates: [], approvalUrls: [addressed] } }))
  await page.route('**/api/visual/approve-source', route => {
    expect(route.request().postDataJSON()).toEqual({ url: addressed })
    return route.fulfill({ json: { host: 'publisher.example.com', approval: 'test.grant' } })
  })
  await page.route('**/api/visual/brave', route => route.fulfill({ json: { state: 'disabled', candidates: [] } }))
  await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { page_count: 0, results: [] } }))
  await page.route('**/api/visual/download', route => route.fulfill({ contentType: 'image/png', body: poster(1) }))
  await page.goto('/#/inicio')
  await page.getByRole('button', { name: /^Criar conteúdo/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Importar conteúdo' }).click()
  await page.getByLabel('Cole aqui o conteúdo do seu post ou carrossel').fill(JSON.stringify({
    schemaVersion: 1, campaign: { title, audience: '', objective: 'Informar', tone: 'Profissional',
      format: 'post', caption: '', cta: '', visualContext: { campaignName } }, sources: [],
    slides: [{ order: 1, role: 'cover', title, body: 'Bastidores da criação.', imageBrief: 'Bonecos na oficina', layoutType: 'photo',
      visualContext: { visualCandidates: [{ imageUrl: asset.url, sourceUrl: addressed, description: 'Bonecos na oficina' }] } }],
  }))
  const studio = page.getByRole('region', { name: editor })
  await studio.getByRole('button', { name: 'Imagens', exact: true }).click()
  await studio.getByRole('button', { name: 'Autorizar publisher.example.com' }).click()
  await expect(studio.getByText('Referência importada · conferir correspondência')).toBeVisible()
  await studio.getByRole('button', { name: 'Confirmar referência' }).click()
  await expect(studio.getByText('Confirmado manualmente')).toBeVisible()
  await expect(studio.getByRole('status').filter({ hasText: /^Salvo$/ })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Abrir ' + title, exact: true }).click()
  await studio.getByRole('button', { name: 'Imagens', exact: true }).click()
  await expect(studio.getByText('Confirmado manualmente')).toBeVisible()
})

for (const count of [3, 4, 6, 10]) {
  test(`continua a busca e mede a abertura de ${count} slides da Expressa no Studio`, async ({ page }, info) => {
    test.setTimeout(50_000)
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    let sourceRequests = 0
    let modelRequests = 0
    const downloads: string[] = []
    const calls: string[] = []
    await page.route(/\/(?:visual-models|visual-ocr)\//, route => {
      modelRequests++
      return route.abort()
    })
    await page.route('**/api/visual/page', async route => {
      sourceRequests++
      await pending
      await route.fulfill({ json: { candidates: count === 4 ? [] : documentary, audiovisualAvailable: true } }).catch(() => undefined)
    })
    await page.route('**/api/visual/brave', route => {
      calls.push('brave')
      return route.fulfill({ json: { state: 'disabled', candidates: [] } })
    })
    await page.route('https://api.openverse.org/**', route => {
      calls.push('openverse')
      return route.fulfill({ json: { page_count: 0, results: [] } })
    })
    await page.route('**/api/visual/complement', route => {
      calls.push('complement')
      expect(route.request().postDataJSON().campaign).toBe(campaignName)
      return route.fulfill({ json: { candidates: documentary } })
    })
    await page.route('**/api/visual/download', route => {
      const { ticket } = route.request().postDataJSON()
      downloads.push(ticket)
      if (count === 3 && ticket === 'official-cover' && downloads.filter(id => id === ticket).length === 1) {
        return route.fulfill({ status: 422, json: { error: 'source_unavailable' } })
      }
      return route.fulfill({ contentType: 'image/png', body: poster(ticket === 'official-cover' ? 1 : 2) })
    })
    const data = {
      schemaVersion: 1, campaign: { title, audience: '', objective: 'Informar', tone: 'Profissional', format: 'carousel', caption: '', cta: '',
        visualContext: { subject: 'GEICO apresenta ' + campaignName, campaignName, entities: ['GEICO'],
          excludedSubjects: ['Road Trip to Parade'], year: 2026 },
      }, sources: [{ url: source, title: 'GEICO — comunicado de How 15% Saved Christmas', publishedAt: '2026-11-23' }],
      slides: Array.from({ length: count }, (_, index) => ({
        order: index + 1, role: index === 0 ? 'cover' : 'content', title: index === 0 ? title : index === 1 ? 'Bonecos e oficina' : 'Contexto editorial ' + index,
        body: index === 1 ? 'Um olhar para os bastidores e a criação dos bonecos.' : 'Texto editável do carrossel.',
        imageBrief: index === 0 ? 'Still do filme' : index === 1 ? 'Bastidores da oficina' : 'Somente texto',
        layoutType: index <= 1 ? 'photo' : 'textual',
        ...(index <= 1 ? { visualContext: { imageType: index === 0 ? 'Still do filme' : 'Bastidores' } } : {}),
      })),
    }
    await page.goto('/#/inicio')
    await page.getByRole('button', { name: /^Criar conteúdo/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Importar conteúdo' }).click()
    const started = performance.now()
    await page.getByLabel('Cole aqui o conteúdo do seu post ou carrossel').fill(JSON.stringify(data))
    await expect.poll(() => sourceRequests).toBe(1)
    const studio = page.getByRole('region', { name: editor })
    await expect(studio.getByLabel('Projeto', { exact: true })).toHaveValue(title)
    const opened = performance.now()
    if (count === 10) {
      const second = studio.getByRole('button', { name: 'Slide 2', exact: true })
      await second.click()
      await second.press('Alt+ArrowRight')
      await expect(studio.getByRole('button', { name: 'Slide 3', exact: true })).toHaveAttribute('aria-pressed', 'true')
    }
    if (count === 6) {
      await studio.getByRole('button', { name: 'Finalizar e exportar', exact: true }).click()
      await expect(studio.getByText(/Há buscas de imagens em andamento/)).toBeVisible()
      release()
      await page.getByRole('button', { name: 'Exportar ZIP', exact: true }).click()
      await expect(studio.getByText('Finalização visual pendente')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Exportar com avisos' })).toHaveCount(0)
      await page.getByRole('button', { name: 'Fechar exportação' }).click()
    } else release()
    const first = studio.getByRole('button', { name: 'Slide 1', exact: true })
    const second = studio.getByRole('button', { name: count === 10 ? 'Slide 3' : 'Slide 2', exact: true })
    await expect(first).toHaveAttribute('aria-description', /Imagem encontrada/)
    const firstAt = performance.now()
    await expect(second).toHaveAttribute('aria-description', /Imagem encontrada/)
    const stabilizedAt = performance.now()
    expect(downloads).toHaveLength(count === 3 ? 3 : 2)
    expect(downloads).not.toContain('excluded-parade')
    expect(sourceRequests).toBe(1)
    if (count === 4) {
      expect(calls.filter(call => call === 'complement')).toHaveLength(1)
      expect(calls.at(-1)).toBe('complement')
    } else expect(calls).toHaveLength(0)
    const textual = studio.getByRole('button', { name: count === 10 ? 'Slide 2' : 'Slide 3', exact: true })
    await expect(textual).not.toHaveAttribute('aria-description', /Buscando|Imagem encontrada/)
    if (count === 3) {
      await studio.getByRole('button', { name: 'Fotos aplicadas · 2', exact: true }).click()
      await studio.getByRole('button', { name: 'Manter esta', exact: true }).click()
    }
    const backup = page.waitForEvent('download')
    await studio.getByRole('button', { name: 'Baixar backup ZIP', exact: true }).click()
    const zip = await JSZip.loadAsync(await readFile(await (await backup).path()))
    const project = JSON.parse(await zip.file('project.json')!.async('string'))
    expect(project.importedContent.campaign.visualContext.campaignName).toBe(campaignName)
    expect(project.importedContent.slides.map((slide: { id: string }) => slide.id).sort()).toEqual(project.slides.map((slide: { id: string }) => slide.id).sort())
    expect(project.slides[count === 10 ? 2 : 1].visualContext.imageType).toBe('Bastidores')
    expect(project.slides[0].scene.objects.some((item: { imageCredit?: { provider: string } }) => item.imageCredit?.provider === 'official')).toBe(true)
    if (count === 3) expect(project.slides[0].visualChoice).toMatchObject({ mode: 'manual', decision: 'approved' })
    await studio.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(studio.getByRole('status').filter({ hasText: /^Salvo$/ })).toBeVisible()
    const warmStart = performance.now()
    await page.reload()
    await page.getByRole('button', { name: 'Abrir ' + title, exact: true }).click()
    await expect(first).toHaveAttribute('aria-description', /Imagem encontrada/)
    const warm = performance.now()
    expect(sourceRequests).toBe(1)
    expect(downloads).toHaveLength(count === 3 ? 3 : 2)
    expect(modelRequests).toBe(0)
    await info.attach('tempos-visuais', { contentType: 'application/json', body: JSON.stringify({
      count, viewport: page.viewportSize(), openedMs: Math.round(opened - started), firstMs: Math.round(firstAt - started),
      stableMs: Math.round(stabilizedAt - started), warmMs: Math.round(warm - warmStart), sourceRequests, downloads: downloads.length,
      braveRequests: calls.filter(call => call === 'brave').length, openverseRequests: calls.filter(call => call === 'openverse').length,
      exportedWhilePending: count === 6,
    }) })
  })
}
test('recupera a variante da mesma fonte e explica o conflito no segundo slide', async ({ page }) => {
  const raster = poster(2)
  const asset = { ...documentary[0], evidence: 'figure' }
  const usable = { ...asset, url: asset.url + '?w=1280', ticket: 'usable' }
  const broken = { ...asset, url: asset.url + '?w=1600', ticket: 'broken' }
  const tickets: string[] = []
  await page.route('**/api/visual/page', route => route.fulfill({ json: { state: 'ok', candidates: [usable, { ...broken, url: asset.url + '?w=1500', ticket: 'broken2' }, broken] } }))
  await page.route('**/api/visual/brave', route => route.fulfill({ json: { state: 'disabled', candidates: [] } }))
  await page.route('https://api.openverse.org/**', route => route.fulfill({ json: { page_count: 0, results: [] } }))
  await page.route('**/api/visual/download', route => {
    const ticket = route.request().postDataJSON().ticket
    tickets.push(ticket)
    return ticket === 'usable' ? route.fulfill({ contentType: 'image/png', body: raster }) :
      route.fulfill({ status: 422, json: { error: 'image_unavailable' } })
  })
  await page.goto('/')
  const result = await page.evaluate(async ({ source, title }) => {
    const base = '/src/features/images/'
    const { campaignContext } = await import(base + 'visualContext.ts')
    const { requestFor } = await import(base + 'automaticSearch.ts')
    const { investigateVisuals } = await import(base + 'searchOrchestrator.ts')
    const slides = ['cover','content'].map(role => ({ role, title, imageBrief: title }))
    const context = campaignContext({ title, sources: [{ url: source, title }], slides })
    const requests = slides.map((slide, index) => requestFor('variants/' + index, slide, context, 1))
    const images: string[] = []
    const states: string[] = []
    await investigateVisuals(requests, {
      used: () => new Set(),
      image: (_request: unknown, image: { object: { imageCredit: { originalUrl: string } } }) => images.push(image.object.imageCredit.originalUrl),
      finish: (_request: unknown, state: string) => states.push(state),
    }, AbortSignal.timeout(15000))
    return { images, states }
  }, { source, title: campaignName })
  expect(tickets).toEqual(['broken', 'broken2', 'usable'])
  expect(result).toEqual({ images: [usable.url], states: ['duplicate'] })
})

test('expira a aprovação sem perdê-la em gravações concorrentes vigentes', async ({ page }) => {
  await page.goto('/')
  const write = async (approved: boolean) => page.evaluate(async ({ candidate, approved }) => {
    const path = '/src/features/images/visualMemory.ts'
    const memory = await import(path)
    const credit = { sourceId: 'asset-test', provider: 'original', originalUrl: candidate.url }
    await memory.rememberVisual('test-scope', candidate, credit, new Blob(['fixture']), undefined, approved)
  }, { candidate: documentary[0], approved })
  const read = () => page.evaluate(async () => {
    const path = '/src/features/images/visualMemory.ts'
    const memory = await import(path)
    return (await memory.readVisualMemory('test-scope')).map((entry: { approved?: boolean }) => !!entry.approved)
  })
  const start = Date.UTC(2026, 10, 26)
  await page.clock.setFixedTime(new Date(start))
  await Promise.all([write(true), write(false)])
  expect(await read()).toEqual([true])
  await page.clock.setFixedTime(new Date(start + 86_400_001))
  expect(await read()).toEqual([])
  await write(false)
  expect(await read()).toEqual([false])
})
