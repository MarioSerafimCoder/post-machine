import { failureText, type VisualFailure } from './searchDiagnostics'
import type { VisualMatch, VisualStatus } from './automaticSearch'

function visualStatusText(status?: VisualStatus, match?: VisualMatch) {
  if (match) return 'Imagem encontrada'
  if (status === 'provisional') return 'Buscando imagem…'
  if (status === 'illustration' || status === 'editorial' || status === 'documental') return 'Buscando imagem…'
  if (status && status in failureText) return failureText[status as keyof typeof failureText]
  if (status === 'error') return 'Busca indisponível. Tente novamente ou escolha uma imagem.'
  if (status === 'empty') return 'Nenhuma imagem adequada encontrada.'
  return ''
}

export function VisualSearchStatus({ status, match, approved, attempts, failure, persisted }: { status?: VisualStatus; match?: VisualMatch; approved?: boolean; attempts?: string[]; failure?: VisualFailure; persisted?: boolean }) {
  const text = match && persisted === false ? 'Arquivo aplicado · salvamento local pendente' : match?.referenceReview && !approved ? 'Referência importada · conferir correspondência' : visualStatusText(status, match) || (failure ? failureText[failure] : '')
  const classification = match?.classification && {
    confirmed: 'Documental confirmada', related: match.referenceReview ? (approved ? 'Conferida manualmente' : 'Procedência verificada') : 'Documental relacionada', support: 'Apoio editorial',
  }[match.classification]
  return text ? <div className="visual-search-status" role="status">
    <strong>{text}</strong>{match && <details><summary>Sobre a imagem</summary><p>{classification && <><strong>{classification}</strong><br /></>}{match.reason}</p></details>}
    {!match && !!attempts?.length && <details><summary>Fontes e consultas desta busca</summary>
      <ul>{attempts.map(line => <li key={line} style={{ overflowWrap: 'anywhere' }}>{line}</li>)}</ul>
    </details>}
  </div> : null
}
