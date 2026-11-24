// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { build } from 'esbuild'
import { Miniflare } from 'miniflare'
import sample from './fixtures/documentary-sample.json'
import { evaluateCandidate, requestFor } from './automaticSearch'
import type { DocumentaryAsset } from './documentaryContract'
import { campaignContext, researchUrl } from './visualContext'

let runtime: Miniflare
beforeAll(async () => {
  const script = await build({ stdin: { resolveDir: '.', contents: `
    import { extractArticle } from './worker/extract';
    export default { async fetch(request) {
      const { html, url } = await request.json();
      return Response.json(await extractArticle(html, new URL(url), 'original'));
    } };
  ` }, bundle: true, write: false, format: 'esm' })
  runtime = new Miniflare({ workers: [{ config: { name: 'visual-test', compatibilityDate: '2026-11-13',
    manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': { type: 'esm', contents: script.outputFiles[0].text } } } } }] })
})
afterAll(async () => { await runtime?.dispose() })

describe('extração documental em HTMLRewriter', () => {
  it('deriva de metadados estruturados, galeria e poster e ignora recomendações', async () => {
    const url = 'https://www.geico.com/about/pressreleases/2026/20261123/'
    const html = `<head>
      <meta property="og:title" content="How 15% Saved Christmas">
      <meta property="og:image" content="/public/images/aboutgeico/GEICO_15_Percent_Saved_Christmas.jpg">
      <script type="application/ld+json">{"@type":"Article","headline":"How 15% Saved Christmas",
        "image":{"@type":"ImageObject","contentUrl":"/public/images/aboutgeico/GEICO_15_Percent_Saved_Christmas.jpg","width":1200,"height":629},
        "video":{"@type":"VideoObject","thumbnailUrl":"/assets/poster.jpg"}}</script>
      <script type="application/ld+json">{"@type":"WebPage","name":"How 15% Saved Christmas","image":"/homepage/gecko.jpg"}</script>
      </head><body><main><article>
      <h2>Bastidores</h2><figure><picture><source srcset="/small.jpg 320w, /large.jpg 1400w">
      <img data-src="/large.jpg" alt="Oficina"></picture><figcaption>Peça da campanha</figcaption></figure>
      <aside><img src="/ad.jpg"></aside><a href="/press-kit/">Press kit</a>
      </article><section><h2>Outras matérias</h2><img src="/unrelated.jpg"></section></main></body>`
    const response = await runtime.dispatchFetch('http://test/', { method: 'POST', body: JSON.stringify({ url, html }) })
    expect(response.status).toBe(200)
    const { images, links } = await response.json() as { images: DocumentaryAsset[]; links: string[] }
    expect(images.map(image => new URL(image.url).pathname).sort()).toEqual([
      '/assets/poster.jpg', '/large.jpg', '/public/images/aboutgeico/GEICO_15_Percent_Saved_Christmas.jpg',
    ])
    expect(images.find(image => image.url.endsWith('/large.jpg'))).toMatchObject({
      page: url, evidence: 'figure', caption: 'Peça da campanha', section: 'Bastidores',
    })
    expect(links).toEqual(['https://www.geico.com/press-kit/'])
  })
  it('ignora imagens de artigos marcados como protegidos pela fonte', async () => {
    const html = '<meta property="og:image" content="/cover.png"><script type="application/ld+json">' +
      '{"@type":"NewsArticle","headline":"Artigo","isAccessibleForFree":false,"image":"/cover.png"}</script>'
    const result = await runtime.dispatchFetch('http://test/', { method: 'POST',
      body: JSON.stringify({ url: 'https://www.adweek.com/article/', html }) })
    expect(await result.json()).toEqual({ images: [], links: [] })
  })
})

describe('amostra documental pública de 24/11/2026', () => {
  it('preserva 31 pautas de oito tipos e metadados higienizados para CI sem rede', () => {
    expect(sample).toHaveLength(31)
    expect(new Set(sample.map(item => item.topic)).size).toBe(8)
    for (const row of sample) {
      expect(researchUrl(row.url)).toBeDefined()
      for (const asset of row.candidates ?? []) expect(new URL(asset.url).search).toBe('')
    }
  })
  it('recupera o still do GEICO e exclui a recomendação que aparece em Apple e Heinz', () => {
    const report = (id: string) => {
      const row = sample.find(item => item.id.startsWith(id))!
      const page = row.finalUrl ?? row.url
      const copy = { title: row.title, role: 'cover' }
      const campaign = campaignContext({ title: row.title, sources: [{ title: row.title, url: page }], slides: [copy] })
      const request = requestFor('fixture/cover', copy, campaign, .8)!
      return (row.candidates ?? []).map(raw => ({ url: raw.url,
        evaluation: evaluateCandidate({ ...raw, title: row.title, page, ticket: '', provider: 'original',
          evidence: raw.evidence as DocumentaryAsset['evidence'] }, request) }))
    }
    expect(report('geico')).toContainEqual({ url: 'https://www.geico.com/public/images/aboutgeico/GEICO_15_Percent_Saved_Christmas.jpg',
      evaluation: expect.objectContaining({ match: expect.objectContaining({ classification: 'confirmed' }) }) })
    for (const id of ['bf3827f4', '6af3aacd']) {
      const recommendations = report(id).filter(asset => asset.url.endsWith('/artificial-filme-poster.jpg'))
      expect(recommendations).toHaveLength(1)
      expect(recommendations[0].evaluation).toEqual({ score: 0, rejected: true })
    }
  })
})
