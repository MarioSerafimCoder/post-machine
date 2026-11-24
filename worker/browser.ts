import { z } from 'zod'
import { extractArticle } from './extract'
import { readJson } from './security'

export type BrowserBinding = {
  script(code: string, options: { library: 'playwright'; timeout: number; keepAlive: number }): Promise<Response>
  closeSession(id: string): Promise<unknown>
}

export async function renderVisualPage(binding: BrowserBinding, url: URL, provider: 'original' | 'official', signal: AbortSignal) {
  signal.throwIfAborted()
  const response = await binding.script(`async ({ browser }) => {
    const source = new URL(${JSON.stringify(url.href)})
    const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false })
    try {
      let requests = 0
      await context.routeWebSocket('**/*', socket => socket.close())
      await context.route('**/*', async route => {
        const request = route.request()
        const target = new URL(request.url())
        const type = request.resourceType()
        if (++requests > 18 || request.method() !== 'GET' || target.origin !== source.origin ||
            (type === 'document' ? target.href !== source.href : !['script', 'xhr', 'fetch', 'stylesheet'].includes(type))) {
          return route.abort()
        }
        try {
          const upstream = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 3200 })
          if (!upstream.ok() || Number(upstream.headers()['content-length']) > 1800000) return route.abort()
          const headers = upstream.headers()
          delete headers['set-cookie']
          return route.fulfill({ response: upstream, headers })
        } catch { return route.abort() }
      })
      const page = await context.newPage()
      const loaded = await page.goto(source.href, { waitUntil: 'domcontentloaded', timeout: 3600 })
      if (!loaded?.ok() || /noindex|noimageindex|none/i.test((await loaded.headerValue('x-robots-tag')) || '')) return ''
      await page.locator('main img, article img, video[poster], [itemprop="articleBody"] img').first()
        .waitFor({ state: 'attached', timeout: 1300 }).catch(() => undefined)
      return await page.evaluate(() => document.documentElement.outerHTML.slice(0, 650000))
    } finally { await context.close() }
  }`, { library: 'playwright', timeout: 6500, keepAlive: 10_000 })
  const session = response.headers.get('cf-browser-session-id')
  try {
    if (!response.ok || signal.aborted) { await response.body?.cancel(); return [] }
    const parsed = z.object({ success: z.literal(true), result: z.string().max(650_000) }).safeParse(await readJson(response, 2_000_000))
    if (!parsed.success || !parsed.data.result) return []
    return (await extractArticle(parsed.data.result, url, provider)).images
  } finally { if (session) await binding.closeSession(session).catch(() => undefined) }
}
