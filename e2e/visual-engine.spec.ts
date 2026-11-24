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
    else draw.fillRect(410 - index * 32, index * 69, 480 - index * 31, 30)
  }
  return canvas.toBuffer('image/png')
}
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

for (const count of [3, 6, 10]) {
  test(`continua a busca e mede a abertura de ${count} slides da Expressa no Studio`, async ({ page }, info) => {
    test.setTimeout(50_000)
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    let sourceRequests = 0
    const downloads: string[] = []
    const calls: string[] = []
    await page.route('**/api/visual/page', async route => {
      sourceRequests++
      await pending
      await route.fulfill({ json: { candidates: documentary } }).catch(() => undefined)
    })
    await page.route('**/api/visual/brave', route => {
      calls.push('brave')
      return route.fulfill({ json: { state: 'disabled', candidates: [] } })
    })
    await page.route('https://api.openverse.org/**', route => {
      calls.push('openverse')
      return route.fulfill({ json: { page_count: 0, results: [] } })
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
    const importButton = page.getByRole('button', { name: /Importar conteúdo/ }).first()
    await importButton.click()
    await page.getByLabel('Cole aqui o conteúdo do seu post ou carrossel').fill(JSON.stringify(data))
    await expect.poll(() => sourceRequests).toBe(1)
    const started = performance.now()
    await page.getByRole('button', { name: 'Montar e abrir no Studio', exact: true }).click()
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
      const exported = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Exportar ZIP', exact: true }).click()
      const warning = page.getByRole('button', { name: 'Exportar com avisos' })
      if (await Promise.race([exported.then(() => false), warning.waitFor().then(() => true)])) await warning.click()
      const zip = await JSZip.loadAsync(await readFile(await (await exported).path()))
      expect(zip.file('creditos.txt')).toBeNull()
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
    expect(calls).toHaveLength(0)
    const textual = studio.getByRole('button', { name: count === 10 ? 'Slide 2' : 'Slide 3', exact: true })
    await expect(textual).not.toHaveAttribute('aria-description', /Buscando|Imagem encontrada/)
    const backup = page.waitForEvent('download')
    await studio.getByRole('button', { name: 'Baixar backup ZIP', exact: true }).click()
    const zip = await JSZip.loadAsync(await readFile(await (await backup).path()))
    const project = JSON.parse(await zip.file('project.json')!.async('string'))
    expect(project.importedContent.campaign.visualContext.campaignName).toBe(campaignName)
    expect(project.slides[count === 10 ? 2 : 1].visualContext.imageType).toBe('Bastidores')
    expect(project.slides[0].scene.objects.some((item: { imageCredit?: { provider: string } }) => item.imageCredit?.provider === 'official')).toBe(true)
    await studio.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(studio.getByRole('status').filter({ hasText: /^Salvo$/ })).toBeVisible()
    const warmStart = performance.now()
    await page.reload()
    await page.getByRole('button', { name: 'Abrir ' + title, exact: true }).click()
    await expect(first).toHaveAttribute('aria-description', /Imagem encontrada/)
    const warm = performance.now()
    expect(sourceRequests).toBe(1)
    expect(downloads).toHaveLength(count === 3 ? 3 : 2)
    await info.attach('tempos-visuais', { contentType: 'application/json', body: JSON.stringify({
      count, viewport: page.viewportSize(), openedMs: Math.round(opened - started), firstMs: Math.round(firstAt - started),
      stableMs: Math.round(stabilizedAt - started), warmMs: Math.round(warm - warmStart), sourceRequests, downloads: downloads.length,
      braveRequests: calls.filter(call => call === 'brave').length, openverseRequests: calls.filter(call => call === 'openverse').length,
      exportedWhilePending: count === 6,
    }) })
  })
}
