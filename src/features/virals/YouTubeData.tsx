import { useState } from 'react'
import type { VideoObservation, YouTubeSnapshot } from './youtube'
import { platforms, type Platform } from './urls'

const formatter = new Intl.NumberFormat('pt-BR')
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function ReferenceThumbnail({ platform, thumbnail }: { platform: Platform; thumbnail?: string }) {
  const [failed, setFailed] = useState(false)
  if (!thumbnail || failed) return <span className="viral-placeholder">{platforms[platform]}</span>
  return <img src={thumbnail} alt="Miniatura fornecida pelo YouTube" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

export function YouTubeData({ video, status, detailed = false }: { video?: VideoObservation; status?: YouTubeSnapshot['status']; detailed?: boolean }) {
  if (!status) return <p className="muted">Verificando métricas…</p>
  if (status === 'disconnected') return <p className="muted">Métricas não conectadas.</p>
  if (!video) return <p className="muted">{status === 'error' || status === 'quota' ? 'Coleta temporariamente indisponível.' : 'Métricas indisponíveis para este vídeo.'}</p>
  const checked = date.format(new Date(video.observedAt))
  if (video.status === 'unavailable') return <p className="muted">Vídeo indisponível na API do YouTube · verificado em {checked} (Brasília).</p>
  const counts = [
    ['visualizações', video.viewCount], ['curtidas', video.likeCount], ['comentários', video.commentCount],
  ].flatMap(([label, count]) => count === undefined ? [] : [formatter.format(BigInt(count)) + ' ' + label])
  const duration = video.duration?.replace(/^P(T)?/, '').replace('D', 'd ').replace('T', ' ').replace('H', 'h ').replace('M', 'min ').replace('S', 's').trim()
  return <div className="viral-metrics">
    <p>{counts.length ? counts.join(' · ') : 'O YouTube não retornou contagens públicas.'}</p>
    <small>Dados do YouTube · observados em {checked} (Brasília)</small>
    {detailed && <>
      {video.title && <p><strong>Título no YouTube</strong> {video.title}</p>}
      {video.channel && <p><strong>Canal</strong> {video.channel}</p>}
      <p>{video.publishedAt && 'Publicado em ' + date.format(new Date(video.publishedAt))}{video.publishedAt && duration && ' · '}{duration && 'Duração ' + duration}</p>
      {video.summary && <p>{video.summary}</p>}
      <p className="muted">As contagens refletem o momento da consulta. Compare apenas conteúdos do mesmo tipo e com períodos de observação equivalentes.</p>
    </>}
  </div>
}
