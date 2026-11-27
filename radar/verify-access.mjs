import { readFile } from 'node:fs/promises'

const hostname = 'posts.marioserafim.com.br'
const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'))
if (config.workers_dev !== false || config.preview_urls !== false || config.routes?.length !== 1 ||
    config.routes[0].pattern !== hostname || config.routes[0].custom_domain !== true) throw Error('Configuração do domínio protegido inválida')
const protectedPaths = ['/', '/radar.json', '/virals-youtube.json', '/favicon.svg']
if (process.argv.includes('--visual')) protectedPaths.push('/api/visual/page', '/api/visual/brave', '/api/visual/download', '/api/visual/import', '/api/visual/complement', '/api/visual/approve-source')
for (const path of protectedPaths) {
  const response = await fetch(`https://${hostname}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(10000) })
  const location = new URL(response.headers.get('location') ?? '/', response.url)
  if (response.status !== 302 || location.protocol !== 'https:' || !location.hostname.endsWith('.cloudflareaccess.com') ||
      location.pathname !== `/cdn-cgi/access/login/${hostname}`) throw Error(`Cloudflare Access não confirmado para ${path} (HTTP ${response.status})`)
  console.log(`${path}: HTTP 302 para Cloudflare Access`)
}
