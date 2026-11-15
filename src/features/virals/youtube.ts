import { z } from 'zod'
import { youtubeIdPattern } from './urls.ts'

const id = z.string().regex(youtubeIdPattern)
const optionalText = (max: number) => z.string().trim().max(max).optional()
const statistics = z.string().regex(/^\d{1,24}$/)
const thumbnail = z.string().url().max(1000).refine(value => {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return url.origin === 'https://i.ytimg.com' && !url.username && !url.password && /^\/vi(?:_webp)?\/[A-Za-z0-9_-]{11}\//.test(url.pathname)
})
const videoSchema = z.object({
  id, status: z.enum(['available', 'unavailable']), observedAt: z.iso.datetime(),
  title: optionalText(200), channel: optionalText(180), summary: optionalText(240), publishedAt: z.iso.datetime().optional(),
  thumbnail: thumbnail.optional(), duration: z.string().regex(/^P[0-9DTHMS.]+$/).max(40).optional(),
  viewCount: statistics.optional(), likeCount: statistics.optional(), commentCount: statistics.optional(),
})
export type VideoObservation = z.infer<typeof videoSchema>
export const snapshotSchema = z.object({
  schemaVersion: z.literal(1), status: z.enum(['disconnected', 'no-ids', 'ready', 'quota', 'error']),
  videos: z.array(videoSchema).max(200), day: z.string(), requests: z.number().int().nonnegative(),
  retryAt: z.iso.datetime().optional(),
})
export type YouTubeSnapshot = z.infer<typeof snapshotSchema>
export const snapshotLifetime = 7 * 86_400_000
export const displayVideo = (video: VideoObservation, now: number) => {
  const age = now - Date.parse(video.observedAt)
  return age >= -60_000 && age < snapshotLifetime
}
const apiItem = z.object({
  id,
  snippet: z.object({
    title: z.string().optional(), channelTitle: z.string().optional(), description: z.string().optional(),
    publishedAt: z.string().optional(), thumbnails: z.record(z.string(), z.object({ url: z.string().optional() })).optional(),
  }).optional(),
  statistics: z.object({ viewCount: statistics.optional(), likeCount: statistics.optional(), commentCount: statistics.optional() }).optional(),
  contentDetails: z.object({ duration: z.string().optional() }).optional(),
})
const apiResponse = z.object({ items: z.array(apiItem).max(50) })

export function parseVideoBatch(input: unknown, requested: string[], observedAt: string): VideoObservation[] {
  const byId = new Map(apiResponse.parse(input).items.map(item => [item.id, item]))
  return requested.map(videoId => {
    const item = byId.get(videoId)
    if (!item) return { id: videoId, status: 'unavailable', observedAt }
    const snippet = item.snippet
    const images = snippet?.thumbnails
    const preview = [images?.medium?.url, images?.default?.url, images?.high?.url].find(value => thumbnail.safeParse(value).success)
    const date = z.iso.datetime().safeParse(snippet?.publishedAt)
    const duration = item.contentDetails?.duration
    return {
      id: videoId, status: 'available', observedAt, title: snippet?.title?.trim().slice(0, 200),
      channel: snippet?.channelTitle?.trim().slice(0, 180), summary: snippet?.description?.trim().slice(0, 240),
      publishedAt: date.success ? date.data : undefined, thumbnail: preview,
      duration: duration && /^P[0-9DTHMS.]+$/.test(duration) && duration.length <= 40 ? duration : undefined,
      ...item.statistics,
    }
  })
}
