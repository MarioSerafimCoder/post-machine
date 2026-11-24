import { z } from 'zod'
import { phraseKey, words } from '../src/features/images/visualContext'
import { youtubeIdPattern } from '../src/features/virals/urls'
import type { Extracted } from './extract'
import { readJson } from './security'

const channel = /^UC[A-Za-z0-9_-]{22}$/
const video = z.object({ id: z.string().regex(youtubeIdPattern), snippet: z.object({
  channelId: z.string().regex(channel), title: z.string().max(500), description: z.string().max(6000).optional(),
  publishedAt: z.string().max(50).optional(),
  thumbnails: z.record(z.string(), z.object({ url: z.string(), width: z.number().optional(), height: z.number().optional() })).optional(),
}) })
const media = /\b(?:official|oficial|spot|trailer|commercial|comercial|teaser|campaign|campanha|film|filme|featurette|behind the scenes|bastidores|making of)\b/
const unrelated = /\b(?:reaction|react|fan made|fanmade|parodia|parody|review|analise)\b/
const contains = (text: string, value: string) => !!value && (' ' + text + ' ').includes(' ' + value + ' ')
export function officialChannel(config: string | undefined, anchors: string[]) {
  if (!config || config.length > 6000) return
  const names = new Set(anchors.map(phraseKey).filter(Boolean))
  for (const pair of config.split('\n')) {
    const [brand, id] = pair.split('=').map(part => part.trim())
    if (names.has(phraseKey(brand)) && channel.test(id ?? '')) return id
  }
}

async function youtube(endpoint: 'search' | 'videos', query: URLSearchParams, key: string, signal: AbortSignal) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`)
  url.search = query.toString()
  const response = await fetch(url, { headers: { 'x-goog-api-key': key }, redirect: 'manual', signal })
  if (!response.ok) {
    await response.body?.cancel()
    return { limited: response.status === 403 || response.status === 429, items: [] as unknown[] }
  }
  const body = z.object({ items: z.array(z.unknown()).max(8) }).safeParse(await readJson(response, 48_000))
  return { limited: false, items: body.success ? body.data.items : [] }
}

export async function discoverVideos(input: { query: string; campaign?: string; channelId: string; excluded?: string[]; year?: string },
  key: string, signal: AbortSignal) {
  const { query, channelId, campaign, excluded = [], year } = input
  const found = await youtube('search', new URLSearchParams({ q: query, channelId, type: 'video', part: 'snippet', maxResults: '5',
    fields: 'items(id/videoId)' }), key, signal)
  const itemSchema = z.object({ id: z.object({ videoId: z.string().regex(youtubeIdPattern) }) })
  const ids = found.items.flatMap(item => { const result = itemSchema.safeParse(item); return result.success ? [result.data.id.videoId] : [] })
  if (!ids.length) return { images: [], limited: found.limited }
  const details = await youtube('videos', new URLSearchParams({ id: ids.join(','), part: 'snippet',
    fields: 'items(id,snippet(channelId,title,description,publishedAt,thumbnails))' }), key, signal)
  const terms = words(query).slice(0, 10)
  const images = details.items.flatMap((item): Extracted[] => {
    const parsed = video.safeParse(item)
    if (!parsed.success) return []
    const { id, snippet } = parsed.data
    if (!ids.includes(id) || snippet.channelId !== channelId) return []
    const title = phraseKey(snippet.title)
    const description = phraseKey(snippet.description?.slice(0, 1200))
    const label = phraseKey(campaign).replace(/(\d) (?:percent|por cento)\b/g, '$1')
    const sameTitle = contains(title.replace(/(\d) (?:percent|por cento)\b/g, '$1'), label)
    if ((!media.test(title) && !sameTitle) || unrelated.test(title) ||
        excluded.some(value => contains(title, phraseKey(value))) ||
        (label ? !sameTitle : terms.length < 3 || terms.filter(word => contains(title, word)).length < Math.max(3, Math.ceil(terms.length * .6))) ||
        (year && snippet.publishedAt && Math.abs(Number(year) - Number(snippet.publishedAt.slice(0, 4))) > 1) ||
        (!sameTitle && excluded.some(value => contains(description, phraseKey(value))))) return []
    const thumbnail = ['maxres', 'standard'].flatMap(size => {
      const asset = snippet.thumbnails?.[size]
      if (!asset || (asset.width ?? 0) < 480 || (asset.height ?? 0) < 480) return []
      const url = new URL(`https://i.ytimg.com/vi/${id}/${size === 'maxres' ? 'maxresdefault' : 'sddefault'}.jpg`)
      return asset.url === url.href ? [{ url: url.href, width: asset.width, height: asset.height }] : []
    })[0]
    if (!thumbnail) return []
    return [{ ...thumbnail, page: `https://www.youtube.com/watch?v=${id}`, provider: 'official', evidence: 'poster',
      title: snippet.title, caption: snippet.title, description: snippet.description?.slice(0, 1000), publishedAt: snippet.publishedAt }]
  })
  return { images, limited: details.limited }
}
