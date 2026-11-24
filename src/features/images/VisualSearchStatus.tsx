import type { VisualMatch, VisualStatus } from './automaticSearch'

function visualStatusText(status?: VisualStatus, match?: VisualMatch) {
  if (match) return 'Imagem encontrada'
  if (status === 'illustration' || status === 'editorial' || status === 'documental') return 'Buscando imagem…'
  if (status === 'error') return 'Busca indisponível. Tente novamente ou escolha uma imagem.'
  if (status === 'empty') return 'Nenhuma imagem adequada encontrada.'
  return ''
}

export function VisualSearchStatus({ status, match }: { status?: VisualStatus; match?: VisualMatch }) {
  const text = visualStatusText(status, match)
  const classification = match?.classification && {
    confirmed: 'Documental confirmada', related: 'Documental relacionada', support: 'Apoio editorial',
  }[match.classification]
  return text ? <div className="visual-search-status" role="status">
    <strong>{text}</strong>{match && <details><summary>Sobre a imagem</summary><p>{classification && <><strong>{classification}</strong><br /></>}{match.reason}</p></details>}
  </div> : null
}
