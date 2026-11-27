// @vitest-environment node
import { expect, test } from 'vitest'
import { build } from 'esbuild'
import { Miniflare } from 'miniflare'

test('extrai a variante grande da figura e separa cards que levam a outras matérias', async () => {
  const module = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import { extractArticle } from './worker/extract'
    export default { async fetch(request) {
      return Response.json(await extractArticle(request.body, new URL('https://www.creativeboom.com/news/work/'), 'original'))
    } }
  ` }, bundle: true, write: false, format: 'esm' })
  const runtime = new Miniflare({ telemetry: { enabled: false }, workers: [{ config: {
    name: 'extract-test', compatibilityDate: '2026-11-13', manifest: { mainModule: 'index.mjs',
      modules: { 'index.mjs': { type: 'esm', contents: module.outputFiles[0].text } } },
  } }] })
  const html = `<meta property="og:image" content="/work.jpg"><main><article>
    <figure><img srcset="/thumbnail.jpg 180w, /work.jpg 1280w" width="180" height="120" alt="Print by the studio">
    <figcaption>Autoria do estúdio</figcaption></figure>
    <figure><a href="/news/another/"><img src="/wrong.jpg"></a></figure></article>
    <article class="reel--card"><figure><img src="/card.jpg"></figure></article></main>`
  try {
    const extract = async (body: string) => (await runtime.dispatchFetch('http://article.test', { method: 'POST', body })).json()
    expect(await extract(html)).toMatchObject({ images: [{ url: 'https://www.creativeboom.com/work.jpg',
      alternateUrls: ['https://www.creativeboom.com/thumbnail.jpg'],
      width: 1280, caption: 'Print by the studio Autoria do estúdio', leadImage: true }] })
    const responsive = await extract('<body class="single-post postid-11"><article class="type-post post-11"><picture><source srcset="/print.webp 1280w"><img src="/print.jpg" alt="Gravura da artista"></picture></article><article class="type-post post-12"><img src="/ad.jpg"></article>')
    expect(responsive).toMatchObject({ images: [
      { url: 'https://www.creativeboom.com/print.webp', caption: 'Gravura da artista' },
      { url: 'https://www.creativeboom.com/print.jpg', caption: 'Gravura da artista' },
    ] })
    expect(await extract('<meta name="robots" content="noimageindex">' + html)).toMatchObject({ images: [], blocked: true })
    const gallery = (size: number) => '<article>' + Array.from({ length: size }, (_, index) =>
      `<figure><img src="/panel-${index}.jpg" alt="Painel ${index}"></figure>`).join('') + '</article>'
    expect((await extract(gallery(6)) as { images: unknown[] }).images).toHaveLength(6)
    const bounded = await extract(gallery(181)) as { images: unknown[]; truncated?: boolean }
    expect(bounded.images).toHaveLength(180)
    expect(bounded.truncated).toBe(true)
  } finally { await runtime.dispose() }
}, 20000)
