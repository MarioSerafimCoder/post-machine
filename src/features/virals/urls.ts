export const platforms = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', pinterest: 'Pinterest', behance: 'Behance', dribbble: 'Dribbble', web: 'Sites e blogs' } as const
export type Platform = keyof typeof platforms
export const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/

export function identifyUrl(input: string): { url: string; canonical: string; platform: Platform; platformId?: string } {
  let original: URL
  try { original = new URL(input.trim()) } catch { throw Error('Informe uma URL pública completa, começando com https://.') }
  if (!['http:', 'https:'].includes(original.protocol) || original.username || original.password || !original.hostname.includes('.')) {
    throw Error('Use um link público HTTP ou HTTPS sem credenciais.')
  }
  const host = original.hostname.replace(/^(www|m|mobile)\./, '')
  const parts = original.pathname.split('/').filter(Boolean)
  let platform: Platform = 'web', platformId: string | undefined
  const canonical = new URL(original)
  const supportedHosts: Record<string, Platform> = {
    'youtube.com': 'youtube', 'youtu.be': 'youtube', 'youtube-nocookie.com': 'youtube',
    'instagram.com': 'instagram', 'tiktok.com': 'tiktok', 'vm.tiktok.com': 'tiktok', 'vt.tiktok.com': 'tiktok',
    'pinterest.com': 'pinterest', 'pinterest.com.br': 'pinterest', 'pin.it': 'pinterest',
    'behance.net': 'behance', 'dribbble.com': 'dribbble',
  }
  if (Object.hasOwn(supportedHosts, host)) platform = supportedHosts[host]
  if (platform === 'youtube') {
    const candidate = host === 'youtu.be' ? parts[0] : parts[0] === 'watch' ? original.searchParams.get('v') : ['shorts','live','embed'].includes(parts[0]) ? parts[1] : undefined
    if (!candidate || !youtubeIdPattern.test(candidate)) throw Error('Use o link de um vídeo, Short ou live específica do YouTube.')
    return { url: original.href, canonical: 'https://www.youtube.com/watch?v=' + candidate, platform, platformId: candidate }
  }
  if (platform === 'instagram' && ['p','reel','reels','tv'].includes(parts[0]) && /^[\w-]+$/.test(parts[1] ?? '')) platformId = parts[1]
  if (platform === 'tiktok' && ['video','photo'].includes(parts[1]) && /^\d+$/.test(parts[2] ?? '')) platformId = parts[2]
  if (platform === 'pinterest' && parts[0] === 'pin' && /^\d+$/.test(parts[1] ?? '')) platformId = parts[1]
  if (platform === 'behance' && parts[0] === 'gallery' && /^\d+$/.test(parts[1] ?? '')) platformId = parts[1]
  if (platform === 'dribbble' && parts[0] === 'shots') platformId = /^(\d+)(?:-|$)/.exec(parts[1] ?? '')?.[1]
  if (platform !== 'web') { canonical.hostname = host; canonical.hash = '' }
  canonical.pathname = canonical.pathname.replace(/\/+$/, '') || '/'
  for (const parameter of [...canonical.searchParams.keys()]) {
    if (/^utm_|^(fbclid|gclid|igsh|igshid|si|mc_cid|mc_eid|ref_src)$/i.test(parameter)) canonical.searchParams.delete(parameter)
  }
  canonical.searchParams.sort()
  return { url: original.href, canonical: canonical.href, platform, platformId }
}
