// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../../../worker/index'
import { externalUrl, issueTicket, publicAddress, rasterSignature, verifyTicket } from '../../../worker/security'

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
})
