import { useDeferredValue, useMemo } from 'react'
import { reviewImport, roles, type Draft } from './contract'

export function ResponsePreview({ raw, draft, express, hideError = false }: { raw: string; draft?: Draft; express?: boolean; hideError?: boolean }) {
  const deferred = useDeferredValue(raw)
  const result = useMemo(() => {
    if (!deferred.trim() || (express && !/^(?:```(?:json|md|markdown)?\s*)?(?:[[{]|# Campanha\b)/i.test(deferred.trim()))) return
    try { return { review: reviewImport(deferred, draft) } }
    catch (cause) { return { error: cause instanceof Error ? cause.message : 'Confira o formato da resposta.' } }
  }, [deferred, draft, express])
  if (!result || raw !== deferred) return null
  if (result.error) return hideError ? null : <p className="info-strip" role="status">Prévia indisponível. {result.error}</p>
  if (!result.review) return null
  const { content, ignored } = result.review
  return <details open className="campaign-example response-preview">
    <summary>Prévia · {content.slides.length} peça(s) · {content.campaign.title}</summary>
    <ol tabIndex={0} aria-label="Peças da resposta">{content.slides.map(slide => <li key={slide.order}>
      <strong>{roles[slide.role]} · {slide.title}</strong>
      {slide.body && <p>{slide.body}</p>}
      {slide.imageBrief && <p>Imagem sugerida · {slide.imageBrief}</p>}
    </li>)}</ol>
    {ignored.length > 0 && <p>Campos fora do modelo ignorados · {ignored.slice(0, 20).join(', ')}{ignored.length > 20 ? ' e outros.' : '.'}</p>}
    {express && <p>A produção distribui título, texto e direção de imagem nos slides. Objetivo, público, tom e fontes ficam disponíveis na importação por Campanhas.</p>}
  </details>
}
