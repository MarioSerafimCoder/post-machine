import { readFile, rename, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { displayVideo, parseVideoBatch, snapshotSchema, type YouTubeSnapshot } from '../src/features/virals/youtube.ts'
import { youtubeIdPattern } from '../src/features/virals/urls.ts'

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', dateStyle: 'short' })
const refreshInterval = 24 * 60 * 60 * 1000
const endpoint = 'https://www.googleapis.com/youtube/v3/videos'
type Options = { ids: string[]; key?: string; perRun: number; perDay: number; cacheUnavailable?: boolean }
const apiError = (body: unknown) => JSON.stringify(body).includes('quotaExceeded') || JSON.stringify(body).includes('dailyLimitExceeded') || JSON.stringify(body).includes('rateLimitExceeded')

export async function collectVideos(options: Options, previous: YouTubeSnapshot | undefined, now: Date, request = fetch) {
  const day = dayFormat.format(now)
  const ids = [...new Set(options.ids)].filter(value => youtubeIdPattern.test(value)).slice(0, 200)
  const state: YouTubeSnapshot = { schemaVersion: 1, status: 'ready', day, requests: previous?.day === day ? previous.requests : 0, videos: [] }
  if (!options.key) return { ...state, status: 'disconnected' as const }
  if (!ids.length) return { ...state, status: 'no-ids' as const }
  if (options.cacheUnavailable) return { ...state, status: 'error' as const }
  const allowed = new Set(ids)
  const cache = new Map(previous?.videos.filter(video => allowed.has(video.id) && displayVideo(video, +now)).map(video => [video.id, video]))
  const complete = () => snapshotSchema.parse({ ...state, videos: [...cache.values()] })
  if (previous?.retryAt && Date.parse(previous.retryAt) > +now) {
    state.status = 'quota'; state.retryAt = previous.retryAt
    return complete()
  }
  const pending = ids.filter(videoId => {
    const video = cache.get(videoId)
    return !video || +now - Date.parse(video.observedAt) >= refreshInterval
  }).sort((a, b) => (cache.get(a)?.observedAt ?? '').localeCompare(cache.get(b)?.observedAt ?? ''))
  const budget = Math.max(0, Math.min(options.perRun, options.perDay - state.requests))
  if (pending.length && budget === 0) state.status = 'quota'
  for (let batch = 0; batch < budget && batch * 50 < pending.length; batch++) {
    const selected = pending.slice(batch * 50, (batch + 1) * 50)
    const url = new URL(endpoint)
    url.search = new URLSearchParams({
      id: selected.join(','), part: 'snippet,statistics,contentDetails',
      fields: 'items(id,snippet(title,channelTitle,publishedAt,description,thumbnails),statistics(viewCount,likeCount,commentCount),contentDetails(duration))',
    }).toString()
    state.requests++
    try {
      const response = await request(url, { headers: { 'x-goog-api-key': options.key }, redirect: 'error', signal: AbortSignal.timeout(15_000) })
      const body: unknown = await response.json()
      if (!response.ok) {
        if (response.status === 429 || (response.status === 403 && apiError(body))) {
          const retry = response.headers.get('Retry-After')
          const seconds = retry !== null && Number.isFinite(Number(retry)) ? Number(retry) * 1000 : Date.parse(retry ?? '') - +now
          state.status = 'quota'
          state.retryAt = new Date(+now + Math.min(86_400_000, Number.isFinite(seconds) && seconds > 0 ? seconds : 6 * 3_600_000)).toISOString()
        } else state.status = 'error'
        break
      }
      for (const item of parseVideoBatch(body, selected, now.toISOString())) cache.set(item.id, item)
    } catch {
      state.status = 'error'
      break
    }
  }
  return complete()
}

function limit(value: string | undefined, fallback: number, maximum: number) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? Math.min(number, maximum) : fallback
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = new URL('../public/virals-youtube.json', import.meta.url)
  const parsed = await readFile(file, 'utf8').then(value => snapshotSchema.safeParse(JSON.parse(value))).catch(() => undefined)
  const result = await collectVideos({
    ids: (process.env.YOUTUBE_VIDEO_IDS ?? '').split(/[\s,]+/), key: process.env.YOUTUBE_API_KEY?.trim(),
    perRun: limit(process.env.YOUTUBE_REQUESTS_PER_RUN, 2, 4), perDay: limit(process.env.YOUTUBE_REQUESTS_PER_DAY, 6, 20),
    cacheUnavailable: process.env.YOUTUBE_CACHE_FAILED === 'true' || !parsed?.success,
  }, parsed?.success ? parsed.data : undefined, new Date())
  const temp = new URL('../public/virals-youtube.json.tmp', import.meta.url)
  await writeFile(temp, JSON.stringify(result) + '\n')
  await rename(temp, file)
  console.log(JSON.stringify({ status: result.status, videos: result.videos.length, day: result.day, requests: result.requests }))
}
