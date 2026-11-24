import { researchUrl } from '../src/features/images/visualContext'
import radar from '../radar/sources.json'

const defaultHosts = [
  ...radar.sources.filter(source => source.kind === 'rss').map(source => new URL(source.url).hostname),
  'storage.ghost.io', 'cdn.mos.cms.futurecdn.net', 'i.guim.co.uk', 'images.adsttc.com',
  'media.creativeboom.com', 'static-www.adweek.com',
  'upload.wikimedia.org', 'live.staticflickr.com', 'www.businesswire.com', 'mms.businesswire.com',
]
export function externalUrl(value: string, configured = '', base?: string) {
  const url = researchUrl(value, base)
  const hosts = [...defaultHosts, ...configured.split(',').map(host => host.trim().toLowerCase())]
  return url && hosts.includes(url.hostname) && !/^\/_next\/image(?:\/|$)/i.test(url.pathname) &&
    ![...url.searchParams.keys()].some(key => /^(?:url|uri|redirect|redirect_uri|target|destination|callback|proxy)$/i.test(key)) ? url : undefined
}

export async function readLimited(response: Response | Request, max: number) {
  if (!response.body || Number(response.headers.get('content-length')) > max) {
    await response.body?.cancel()
    throw Error('Invalid size')
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > max) { await reader.cancel(); throw Error('Invalid size') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const data = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.byteLength
  }
  return data
}
export const readJson = async (request: Request | Response, max: number): Promise<unknown> =>
  JSON.parse(new TextDecoder().decode(await readLimited(request, max)))

export function publicAddress(value: string, type: number) {
  if (type === 28) {
    const compact = value.toLowerCase()
    return /^[23][\da-f]{3}:[\da-f:]+$/.test(compact) &&
      !/^(?:2001:(?:0|2|10|20|db8)(?::|$)|2002:|3fff:)/.test(compact)
  }
  if (type !== 1 || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return false
  const octets = value.split('.').map(Number)
  const [a, b, c] = octets
  return octets.every(item => item <= 255) && a > 0 && a < 224 && ![10, 127].includes(a) &&
    !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && (b === 168 || b === 0 && [0, 2].includes(c) || b === 88 && c === 99)) &&
    !(a === 198 && ([18, 19].includes(b) || b === 51 && c === 100)) && !(a === 203 && b === 0 && c === 113)
}

const dns = new Map<string, number>()
async function publicDns(hostname: string, signal: AbortSignal) {
  if ((dns.get(hostname) ?? 0) > Date.now()) return
  const answers = await Promise.all(['A', 'AAAA'].map(async type => {
    const endpoint = new URL('https://cloudflare-dns.com/dns-query')
    endpoint.search = new URLSearchParams({ name: hostname, type }).toString()
    const response = await fetch(endpoint, { headers: { Accept: 'application/dns-json' }, redirect: 'error', signal })
    if (!response.ok) { await response.body?.cancel(); throw Error('DNS unavailable') }
    const result = await readJson(response, 12_000) as { Status?: number; Answer?: { type: number; data: string; TTL: number }[] }
    if (result.Status !== 0) throw Error('DNS unavailable')
    return (result.Answer ?? []).filter(answer => answer.type === 1 || answer.type === 28)
  }))
  const addresses = answers.flat()
  if (!addresses.length || addresses.some(answer => !publicAddress(answer.data, answer.type))) throw Error('Destination rejected')
  if (dns.size >= 100) dns.delete(dns.keys().next().value!)
  dns.set(hostname, Date.now() + Math.max(0, Math.min(30, ...addresses.map(answer => answer.TTL))) * 1000)
}

export async function externalFetch(initial: URL, configured: string | undefined, accept: string, signal: AbortSignal) {
  let url = initial
  for (let hop = 0; hop <= 2; hop++) {
    await publicDns(url.hostname, signal)
    const response = await fetch(url, { headers: { Accept: accept }, credentials: 'omit', redirect: 'manual', cache: 'no-store', signal })
    if (response.status < 300 || response.status >= 400) return { url, response }
    await response.body?.cancel()
    const next = externalUrl(response.headers.get('location') ?? '', configured, url.href)
    if (!next || next.href === url.href) break
    url = next
  }
  throw Error('Redirect rejected')
}

const encoder = new TextEncoder()
function decode(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))
}
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const decodeJson = (value: string) => JSON.parse(new TextDecoder().decode(decode(value)))
type Keys = { expires: number; keys: (JsonWebKey & { kid?: string })[] }
const keysets = new Map<string, Keys>()
async function accessKeys(issuer: string) {
  const existing = keysets.get(issuer)
  if (existing && existing.expires > Date.now()) return existing.keys
  const response = await fetch(issuer + '/cdn-cgi/access/certs', { redirect: 'error', signal: AbortSignal.timeout(2500) })
  if (!response.ok) { await response.body?.cancel(); throw Error('Access keys unavailable') }
  const data = await readJson(response, 32_000) as { keys: Keys['keys'] }
  if (!Array.isArray(data.keys)) throw Error('Access keys unavailable')
  keysets.set(issuer, { expires: Date.now() + 300_000, keys: data.keys })
  return data.keys
}

export async function accessSubject(token: string | null, issuer?: string, audience?: string) {
  if (!issuer || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) || !audience ||
    !token || token.length > 8192) return
  try {
    const parts = token.split('.')
    if (parts.length !== 3 || parts.some(part => !/^[\w-]+$/.test(part))) return
    const [header, payload, signature] = parts
    const { alg, kid } = decodeJson(header)
    const { iss, aud, sub, exp, nbf, type } = decodeJson(payload)
    const now = Date.now() / 1000
    if (alg !== 'RS256' || typeof kid !== 'string' || iss !== issuer || !Array.isArray(aud) || !aud.includes(audience) ||
      (type !== undefined && type !== 'app') || typeof sub !== 'string' || !sub || sub.length > 160 ||
      !Number.isSafeInteger(exp) || exp <= now || (nbf !== undefined && (!Number.isSafeInteger(nbf) || nbf > now))) return
    const jwk = (await accessKeys(issuer)).find(key => key.kty === 'RSA' && key.kid === kid)
    if (!jwk) return
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    if (await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(signature), encoder.encode(header + '.' + payload))) return sub as string
  } catch { return }
}

export async function accessRequestSubject(request: Request, issuer?: string, audience?: string) {
  const assertion = request.headers.get('cf-access-jwt-assertion')
  const subject = await accessSubject(assertion, issuer, audience)
  if (subject) return subject
  const cookie = request.headers.get('cookie')?.split(';').map(item => item.trim()).find(item => item.startsWith('CF_Authorization='))
    ?.slice('CF_Authorization='.length)
  if (cookie && cookie !== assertion) return accessSubject(cookie, issuer, audience)
}

const hmac = (secret: string) => crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
export async function issueTicket(url: string, person: string, secret: string) {
  const payload = encode(encoder.encode(JSON.stringify([url, person, Date.now() + 15 * 60_000])))
  const signature = await crypto.subtle.sign('HMAC', await hmac(secret), encoder.encode(payload))
  return payload + '.' + encode(new Uint8Array(signature))
}
export async function verifyTicket(ticket: string, person: string, secret: string) {
  try {
    const parts = ticket.split('.')
    if (parts.length !== 2 || parts.some(part => !/^[\w-]+$/.test(part))) return
    const [payload, signature] = parts
    if (!await crypto.subtle.verify('HMAC', await hmac(secret), decode(signature), encoder.encode(payload))) return
    const [url, owner, expiry] = decodeJson(payload)
    if (owner === person && expiry > Date.now() && typeof url === 'string') return url
  } catch { return }
}

export function rasterSignature(bytes: Uint8Array, type: string) {
  const at = (offset: number, values: number[]) => values.every((value, index) => bytes[offset + index] === value)
  if (type === 'image/png') return bytes.length >= 45 && at(0, [137, 80, 78, 71, 13, 10, 26, 10]) &&
    at(12, [73, 72, 68, 82]) && at(bytes.length - 8, [73, 69, 78, 68])
  if (type === 'image/jpeg') return bytes.length >= 20 && at(0, [255, 216, 255]) && at(bytes.length - 2, [255, 217])
  return type === 'image/webp' && bytes.length >= 20 && at(0, [82, 73, 70, 70]) && at(8, [87, 69, 66, 80]) &&
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 === bytes.length
}
