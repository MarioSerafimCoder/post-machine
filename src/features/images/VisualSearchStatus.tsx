import type { VisualMatch, VisualStatus } from './automaticSearch'

function visualStatusText(status?: VisualStatus, match?: VisualMatch) {
  if (match) return match.strategy === 'illustration' ? 'Ilustração de apoio aplicada' :
    match.strategy === 'editorial' ? 'Imagem editorial aplicada' : 'Imagem documental encontrada'
  if (status === 'illustration') return 'Buscando ilustração de apoio…'
  if (status === 'editorial') return 'Buscando fotografia de apoio editorial…'
  if (status === 'documental') return 'Buscando imagem documental…'
  if (status === 'error') return 'Busca indisponível. Tente novamente ou escolha uma imagem.'
  if (status === 'empty') return 'Sem sugestão automática confiável.'
  return ''
}

export function VisualSearchStatus({ status, match }: { status?: VisualStatus; match?: VisualMatch }) {
  const text = visualStatusText(status, match)
  return text ? <div className="visual-search-status" role="status">
    <strong>{text}</strong>{match && <p>{match.reason}</p>}
  </div> : null
}
