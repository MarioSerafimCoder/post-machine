// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { automaticPublicSources, externalFetch, externalUrl } from '../../../worker/security'

afterEach(() => vi.unstubAllGlobals())
it('allows public publishers and CDN URLs only in automatic discovery mode', () => {
  expect(externalUrl('https://new-publisher.example.com/story')).toBeUndefined()
  expect(externalUrl('https://new-publisher.example.com/story', automaticPublicSources)?.hostname).toBe('new-publisher.example.com')
  for (const url of ['http://example.com/x', 'https://127.0.0.1/x', 'https://localhost/x', 'https://example.com/?url=https://other.com'])
    expect(externalUrl(url, automaticPublicSources)).toBeUndefined()
})
it('checks DNS again on redirects and never fetches a private destination', async () => {
  const visited: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (raw: URL) => {
    const url = new URL(raw)
    if (url.hostname === 'cloudflare-dns.com') return Response.json({ Status: 0, Answer: [{ type: 1,
      data: url.searchParams.get('name') === 'private-cdn.example.com' ? '10.0.0.1' : '93.184.216.34' }] })
    visited.push(url.hostname)
    return Response.redirect('https://private-cdn.example.com/photo.jpg')
  }))
  await expect(externalFetch(new URL('https://publisher-check.example.com/story'), automaticPublicSources, 'text/html', AbortSignal.timeout(2000))).rejects.toThrow('Destination rejected')
  expect(visited).toEqual(['publisher-check.example.com'])
})

