import { z } from 'zod'
export const visualFailureSchema = z.enum(['blocked', 'limited', 'connection', 'timeout', 'download', 'incompatible', 'insufficient', 'duplicate', 'extraction', 'contradiction', 'reference_missing', 'reference_not_provided', 'not_found', 'image_not_found', 'authorization', 'video_only', 'application', 'persistence', 'cancelled'])
export type VisualFailure = z.infer<typeof visualFailureSchema>
export class VisualSearchError extends Error {
  constructor(readonly kind: VisualFailure) { super(kind) }
}
export function failureKind(cause: unknown): VisualFailure {
  if (cause instanceof VisualSearchError) return cause.kind
  if (cause instanceof Error && cause.name === 'SearchLimit') return 'limited'
  return !!cause && typeof cause === 'object' && 'name' in cause && /timeout|abort/i.test(String(cause.name)) ? 'timeout' : 'connection'
}
export const isSearchFailure = (status?: string) => status === 'error' || Object.hasOwn(failureText, status ?? '')
export const failureText: Record<VisualFailure, string> = {
  cancelled: 'Verificação cancelada. A composição editorial permanece disponível; tente novamente quando quiser.',
  reference_not_provided: 'Nenhuma referência visual foi fornecida para este slide.',
  not_found: 'A página indicada não existe mais (HTTP 404 ou 410). Abra outra fonte ou importe o arquivo.',
  image_not_found: 'O arquivo indicado não existe mais (HTTP 404 ou 410). Escolha uma alternativa ou importe o original.',
  authorization: 'O domínio da fonte ou do arquivo aguarda autorização neste painel.',
  video_only: 'Há referência em vídeo, mas nenhum arquivo de imagem utilizável foi recebido.',
  application: 'O arquivo foi recebido, mas não pôde ser aplicado ao canvas. Tente aplicar novamente.',
  persistence: 'A imagem está no editor, mas o salvamento local falhou. Salve novamente ou baixe um backup.',
  duplicate: 'As imagens pertinentes já foram usadas ou descartadas neste slide.',
  extraction: 'A leitura da página terminou antes que fosse possível extrair as imagens.',
  blocked: 'A fonte não permite acessar a imagem. Escolha outra fonte ou importe o arquivo.',
  limited: 'Limite de buscas atingido. Tente mais tarde ou escolha uma imagem.',
  connection: 'Não foi possível conectar à fonte. Tente novamente.',
  timeout: 'A busca demorou demais. Tente novamente.',
  download: 'Não foi possível baixar a imagem. Escolha outra ou importe o arquivo.',
  incompatible: 'A imagem não pôde ser aberta. Escolha outra ou importe o arquivo.',
  contradiction: 'A fonte identifica uma imagem incompatível com este slide. As alternativas não resolveram a divergência.',
  reference_missing: 'A leitura da fonte terminou, mas o arquivo indicado não foi identificado na extração. Abra a fonte ou importe uma alternativa.',
  insufficient: 'As imagens encontradas não têm evidência suficiente. Escolha uma imagem ou use somente texto.',
}

export type DocumentaryClass = 'confirmed' | 'related' | 'support' | 'insufficient' | 'incompatible'
export type InvestigationEvent = { stage: string; ms: number; slide?: string; url?: string; reason?: string;
  classification?: DocumentaryClass; query?: string; returned?: number; eligible?: number; queries?: string[] }

export function attemptText(event: InvestigationEvent) {
  const channel = { source: 'Página', extract: 'Extração', openverse: 'Openverse', brave_web: 'Brave Web',
    brave_images: 'Brave Images', pool: 'Acervo local' }[event.stage]
  if (!channel) return
  const state = { disabled: 'desativada', unavailable: 'indisponível', blocked: 'acesso bloqueado', timeout: 'prazo esgotado',
    extraction: 'leitura incompleta', limited: 'limite atingido', connection: 'falha de conexão', busy: 'ocupada',
    authorization: 'aguarda autorização', not_found: 'página inexistente' }[event.reason ?? '']
  return [channel, event.query || event.url, state, event.returned !== undefined && `${event.returned} candidato(s)`,
    event.eligible !== undefined && `${event.eligible} elegível(is)`].filter(Boolean).join(' · ')
}
