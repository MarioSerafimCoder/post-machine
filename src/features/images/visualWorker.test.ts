// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../../../worker/index'
import { externalFetch, externalUrl, issueTicket, publicAddress, rasterSignature, verifyTicket } from '../../../worker/security'

const issuer = 'https://visual-test-team.cloudflareaccess.com'
const audience = 'visual-test-app'
const origin = 'https://project.example.com'
const key = 'test signing material, confined to unit tests'
const allowed = { limit: vi.fn(async () => ({ success: true })) }
const env = {
  ASSETS: { fetch: async () => new Response('SPA') }, VISUAL_LIMIT: allowed, BRAVE_LIMIT: allowed,
  CLOUDFLARE_ACCESS_ISSUER: issuer, CLOUDFLARE_ACCESS_AUD: audience, VISUAL_DOWNLOAD_KEY: key,
}
const jwk = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]) }, true, ['sign', 'verify'])
const publicKey = { ...await crypto.subtle.exportKey('jwk', jwk.publicKey), kid: 'test-key' }
const jwks = () => Response.json({ keys: [publicKey] })
const toSegment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
async function token(attrs: object = {}) {
  const header = toSegment({ alg: 'RS256', kid: 'test-key' })
  const body = toSegment({ iss: issuer, aud: [audience], sub: 'editor', exp: Math.ceil(Date.now() / 1000) + 120, type: 'app', ...attrs })
  const content = header + '.' + body
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', jwk.privateKey, new TextEncoder().encode(content))
  return content + '.' + Buffer.from(signature).toString('base64url')
}
function request(route: string, payload: object, jwt?: string, site = origin) {
  return new Request(origin + '/api/visual/' + route, { method: 'POST', body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json', origin: site, ...(jwt ? { 'cf-access-jwt-assertion': jwt } : {}) } })
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('Worker de pesquisa visual', () => {
  it('serve a SPA e valida assinatura, emissor, audiência, validade e origem', async () => {
    const outbound = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.redirect).toBe('manual')
      return jwks()
    })
    vi.stubGlobal('fetch', outbound)
    expect(await (await worker.fetch(new Request(origin + '/'), env)).text()).toBe('SPA')
    expect((await worker.fetch(request('brave', {}), env)).status).toBe(401)
    expect((await worker.fetch(request('brave', {}, await token({ aud: ['other-app'] })), env)).status).toBe(401)
    expect((await worker.fetch(request('brave', {}, await token({ exp: 1 })), env)).status).toBe(401)
    expect((await worker.fetch(request('brave', {}, (await token()).slice(0, -5) + 'AAAAA'), env)).status).toBe(401)
    expect((await worker.fetch(request('brave', {}, await token(), 'https://other.example.com'), env)).status).toBe(403)
    expect(outbound).toHaveBeenCalledTimes(1)
  })
  it('verifica o cookie assinado do Access quando a rota de arquivos estáticos não fornece a asserção', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jwks()))
    const authorized = new Request(origin + '/api/visual/page', { headers: {
      cookie: 'theme=dark; CF_Authorization=' + await token(),
    } })
    expect((await worker.fetch(authorized, env)).status).toBe(405)
    const rejected = new Request(origin + '/api/visual/page', { headers: {
      cookie: 'CF_Authorization=' + await token({ aud: ['outra-aplicacao'] }),
    } })
    expect((await worker.fetch(rejected, env)).status).toBe(401)
  })
  it('nega destinos internos e destinos HTTPS que não constam na lista de saídas', async () => {
    const jwt = await token()
    const outbound = vi.fn(async () => jwks())
    vi.stubGlobal('fetch', outbound)
    for (const url of ['https://127.0.0.1/a.jpg', 'https://localhost/a.jpg', 'https://others.example.com/a.jpg', 'http://www.b9.com.br/a.jpg']) {
      expect((await worker.fetch(request('import', { url }, jwt), env)).status).toBe(403)
    }
    expect(externalUrl('https://www.b9.com.br/retorno?url=outra')).toBeUndefined()
    expect(['127.0.0.1', '100.64.0.1', '169.254.169.254', '172.18.0.2', '192.168.1.1'].every(ip => !publicAddress(ip, 1))).toBe(true)
    expect(publicAddress('2001:db8::1', 28)).toBe(false)
    expect(publicAddress('2606:4700:4700::1111', 28)).toBe(true)
  })
  it('vincula o download à sessão e rejeita arquivo incompleto', async () => {
    const ticket = await issueTicket('https://upload.wikimedia.org/test.jpg', 'editor', key)
    expect(await verifyTicket(ticket, 'editor', key)).toBe('https://upload.wikimedia.org/test.jpg')
    expect(await verifyTicket(ticket, 'other-editor', key)).toBeUndefined()
    expect(await verifyTicket(ticket + 'a', 'editor', key)).toBeUndefined()
    expect(rasterSignature(Uint8Array.from([255, 216, 255, 0]), 'image/jpeg')).toBe(false)
    const response = await worker.fetch(request('download', { ticket: 'incorrect' }, await token()), env)
    expect(response.status).toBe(403)
  })
  it('restringe o portfólio à página revisada e aos rasters do namespace da agência', async () => {
    const page = 'https://how.studio/work/pets'
    const asset = 'https://images.prismic.io/how-and-how/pets-foundation.jpg?auto=format%2Ccompress&w=1080'
    expect(externalUrl(page)?.href).toBe(page)
    expect(externalUrl(asset)?.href).toBe(asset)
    const outbound = vi.fn()
    vi.stubGlobal('fetch', outbound)
    const configured = 'how.studio,images.prismic.io'
    for (const url of [
      'https://how.studio/work/other',
      page + '?target=https%3A%2F%2Fpublic.example.com',
      'https://images.prismic.io/other-tenant/foundation.jpg',
      'https://images.prismic.io/how-and-how/pets.svg',
      'https://images.prismic.io/how-and-how/dir%2fabc.jpg',
      'https://images.prismic.io/how-and-how/foundation.jpg?url=https%3A%2F%2Fpublic.example.com',
    ]) {
      expect(externalUrl(url, configured)).toBeUndefined()
      await expect(externalFetch(new URL(url), configured, 'image/jpeg', new AbortController().signal)).rejects.toThrow('Destination rejected')
    }
    expect(outbound).not.toHaveBeenCalled()
  })
  it('usa o navegador complementar somente para o propósito assinado e fecha a sessão', async () => {
    const jwt = await token()
    vi.stubGlobal('fetch', vi.fn(async () => jwks()))
    const url = 'https://www.b9.com.br/pauta-dinamica/'
    const downloadTicket = await issueTicket(url, 'editor', key)
    const renderTicket = await issueTicket(url, 'editor', key, 'render')
    expect(await verifyTicket(renderTicket, 'editor', key)).toBeUndefined()
    const browser = {
      script: vi.fn(async () => Response.json({ success: true, result: '' }, { headers: { 'cf-browser-session-id': 'render-session' } })),
      closeSession: vi.fn(async () => undefined),
    }
    const configured = { ...env, VISUAL_EXTRA_LIMIT: allowed, BROWSER: browser, VISUAL_BROWSER_FREE: 'confirmed', VISUAL_BROWSER_HOSTS: 'www.b9.com.br' }
    expect((await worker.fetch(request('complement', { renderTicket }, undefined), configured)).status).toBe(401)
    expect((await (await worker.fetch(request('complement', { renderTicket: downloadTicket }, jwt), configured)).json()).state).toBe('disabled')
    expect((await (await worker.fetch(request('complement', { renderTicket }, jwt), { ...configured, VISUAL_BROWSER_FREE: '' })).json()).state).toBe('disabled')
    expect(browser.script).not.toHaveBeenCalled()
    expect((await worker.fetch(request('complement', { renderTicket }, jwt), configured)).status).toBe(200)
    expect(browser.script).toHaveBeenCalledWith(expect.stringContaining('maxRedirects: 0'), {
      library: 'playwright', timeout: 6500, keepAlive: 10_000,
    })
    expect(browser.closeSession).toHaveBeenCalledWith('render-session')
  })
  it('aceita trailers e bastidores do canal cadastrado e elimina vídeos de outras campanhas', async () => {
    const jwt = await token()
    const channelId = 'UC' + 'g'.repeat(22)
    const ids = ['a', 'b', 'c'].map(letter => letter.repeat(11))
    const outbound = vi.fn(async (raw: URL, init: RequestInit) => {
      const url = new URL(raw)
      if (url.href.startsWith(issuer)) return jwks()
      expect(init.headers).toEqual({ 'x-goog-api-key': 'unit-test' })
      expect(url.searchParams.has('key')).toBe(false)
      if (url.pathname.endsWith('/search')) {
        expect(url.searchParams.get('channelId')).toBe(channelId)
        return Response.json({ items: ids.map(videoId => ({ id: { videoId } })) })
      }
      return Response.json({ items: ids.map((id, index) => ({ id, snippet: {
        channelId: index === 2 ? 'UC' + 'h'.repeat(22) : channelId,
        title: index === 1 ? 'Other Campaign — official trailer' : 'Nocturnal Garden — behind the scenes',
        thumbnails: { maxres: { url: 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg', width: 1280, height: 720 } },
      } })) })
    })
    vi.stubGlobal('fetch', outbound)
    const configuration = { ...env, VISUAL_EXTRA_LIMIT: allowed, YOUTUBE_API_KEY: 'unit-test',
      VISUAL_YOUTUBE_QUOTA: 'confirmed', VISUAL_YOUTUBE_CHANNELS: 'Studio Film=' + channelId }
    const input = { query: 'Studio Film Nocturnal Garden official film', campaign: 'Nocturnal Garden', anchors: ['Studio Film'] }
    const response = await worker.fetch(request('complement', input, jwt), configuration)
    expect(await response.json()).toMatchObject({ state: 'ready', candidates: [
      { page: 'https://www.youtube.com/watch?v=' + ids[0], provider: 'official', evidence: 'poster' },
    ] })
    expect(outbound.mock.calls.filter(([url]) => new URL(url).hostname === 'www.googleapis.com')).toHaveLength(2)
  })
  it('enriquece resultados de Brave Images pela página permitida e evita reler a mesma origem', async () => {
    const jwt = await token()
    vi.stubGlobal('HTMLRewriter', class { on() { return this } transform(response: Response) { return response } })
    const sourcePage = 'https://www.businesswire.com/news/home/visual-campaign'
    const outbound = vi.fn(async (raw: URL | string) => {
      const url = new URL(raw)
      if (url.hostname === issuer.slice('https://'.length)) return jwks()
      if (url.hostname === 'cloudflare-dns.com') return Response.json({ Status: 0, Answer: url.searchParams.get('type') === 'A'
        ? [{ type: 1, TTL: 30, data: '1.1.1.1' }] : [] })
      if (url.hostname === 'api.search.brave.com') return Response.json({ results: [1, 2].map(index => ({
        url: sourcePage, title: 'Official visual identity campaign', description: 'Brand identity artwork',
        properties: { url: `https://media.creativeboom.com/mark-${index}.jpg`, width: 1200, height: 800 },
      })) })
      if (url.href === sourcePage) return new Response('<html><article></article></html>', { headers: { 'content-type': 'text/html' } })
      throw Error('Unexpected origin')
    })
    vi.stubGlobal('fetch', outbound)
    const configured = { ...env, BRAVE_SEARCH_API_KEY: 'unit-test', BRAVE_VISUAL_ZERO_SPEND: 'confirmed' }
    const response = await worker.fetch(request('brave', { kind: 'images', query: 'visual identity campaign', anchors: ['Official visual identity'] }, jwt), configured)
    const result = await response.json()
    expect(response.status).toBe(200)
    expect(result.candidates).toHaveLength(2)
    expect(outbound.mock.calls.filter(([url]) => new URL(String(url)).href === sourcePage)).toHaveLength(1)
  })
  it('mantém Brave opcional e abre o circuito ao receber 429', async () => {
    const jwt = await token()
    const outbound = vi.fn(async (input: URL | string, init: RequestInit) => {
      expect(init.redirect).toBe('manual')
      return String(input).startsWith(issuer) ? jwks() : new Response('', { status: 429, headers: { 'retry-after': '30' } })
    })
    vi.stubGlobal('fetch', outbound)
    const query = { kind: 'images', query: 'Peças da campanha' }
    expect(await (await worker.fetch(request('brave', query, jwt), env)).json()).toEqual({ state: 'disabled', candidates: [] })
    expect(await (await worker.fetch(request('brave', query, jwt), { ...env, BRAVE_SEARCH_API_KEY: 'unit-test' })).json())
      .toEqual({ state: 'disabled', candidates: [] })
    const configured = { ...env, BRAVE_SEARCH_API_KEY: 'unit-test', BRAVE_VISUAL_ZERO_SPEND: 'confirmed' }
    expect((await worker.fetch(request('brave', query, jwt), configured)).status).toBe(429)
    expect((await worker.fetch(request('brave', query, jwt), configured)).status).toBe(429)
    expect(outbound.mock.calls.filter(([url]) => String(url).startsWith('https://api.search.brave.com'))).toHaveLength(1)
  })
  it('verifica DNS novamente ao seguir redirecionamentos e limita volume pelo usuário autenticado', async () => {
    const jwt = await token()
    vi.stubGlobal('fetch', vi.fn(async (raw: URL | string, init: RequestInit) => {
      expect(init.redirect).toBe('manual')
      const url = new URL(raw)
      if (url.hostname === 'visual-test-team.cloudflareaccess.com') return jwks()
      if (url.hostname === 'cloudflare-dns.com') return Response.json({ Status: 0,
        Answer: url.searchParams.get('type') === 'A' ? [{ type: 1, TTL: 10,
          data: url.searchParams.get('name') === 'storage.ghost.io' ? '192.168.1.1' : '1.1.1.1' }] : [] })
      if (url.hostname === 'www.b9.com.br') return Response.redirect('https://storage.ghost.io/redirect.jpg')
      throw Error('Unexpected origin')
    }))
    const guarded = await worker.fetch(request('import', { url: 'https://www.b9.com.br/test.jpg' }, jwt), env)
    expect(guarded.status).toBe(422)
    const denied = await worker.fetch(request('import', { url: 'https://www.b9.com.br/test.jpg' }, jwt),
      { ...env, VISUAL_LIMIT: { limit: async () => ({ success: false }) } })
    expect(denied.status).toBe(429)
  })
  it('autoriza fontes públicas automaticamente mantendo sessão e assinatura dos downloads', async () => {
    const jwt = await token()
    const url = 'https://publisher.example.com/work'
    vi.stubGlobal('fetch', vi.fn(async (raw: URL) => new URL(raw).hostname === new URL(issuer).hostname ? jwks()
      : new URL(raw).hostname === 'cloudflare-dns.com' ? Response.json({ Status: 0, Answer: [{ type: 1, data: '93.184.216.34' }] })
        : new Response('', { status: 404 })))
    expect((await worker.fetch(request('approve-source', { url }), env)).status).toBe(401)
    expect(await (await worker.fetch(request('page', { url }, jwt), env)).json()).toMatchObject({ state: 'blocked' })
    const grant = await (await worker.fetch(request('approve-source', { url }, jwt), env)).json()
    expect(grant).toMatchObject({ host: 'publisher.example.com', approval: expect.any(String) })
    const page = (subject: string, approval: string, target = url) => {
      const req = request('page', { url: target }, subject)
      req.headers.set('x-visual-source-approvals', approval)
      return worker.fetch(req, env).then(response => response.json())
    }
    expect(await page(jwt, grant.approval)).toMatchObject({ state: 'blocked' })
    expect(await page(await token({ sub: 'another' }), grant.approval)).toMatchObject({ state: 'blocked' })
    expect(await page(jwt, grant.approval + 'x')).toMatchObject({ state: 'blocked' })
    expect(await page(jwt, grant.approval, 'https://different.example.com/work')).toMatchObject({ state: 'blocked' })
  })

})
