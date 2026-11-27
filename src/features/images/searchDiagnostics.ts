export type VisualFailure = 'blocked' | 'limited' | 'connection' | 'timeout' | 'download' | 'incompatible' | 'insufficient' | 'contradiction' | 'reference_missing'
export class VisualSearchError extends Error {
  constructor(readonly kind: VisualFailure) { super(kind) }
}
export function failureKind(cause: unknown): VisualFailure {
  if (cause instanceof VisualSearchError) return cause.kind
  return !!cause && typeof cause === 'object' && 'name' in cause && /timeout|abort/i.test(String(cause.name)) ? 'timeout' : 'connection'
}
export const isSearchFailure = (status?: string) => ['error', 'blocked', 'limited', 'connection', 'timeout', 'download', 'incompatible', 'insufficient', 'contradiction', 'reference_missing'].includes(status ?? '')
export const failureText: Record<VisualFailure, string> = {
  blocked: 'A fonte não permite acessar a imagem. Escolha outra fonte ou importe o arquivo.',
  limited: 'Limite de buscas atingido. Tente mais tarde ou escolha uma imagem.',
  connection: 'Não foi possível conectar à fonte. Tente novamente.',
  timeout: 'A busca demorou demais. Tente novamente.',
  download: 'Não foi possível baixar a imagem. Escolha outra ou importe o arquivo.',
  incompatible: 'A imagem não pôde ser aberta. Escolha outra ou importe o arquivo.',
  contradiction: 'A fonte identifica uma imagem incompatível com este slide. As alternativas não resolveram a divergência.',
  reference_missing: 'Os arquivos indicados não foram encontrados nas páginas consultadas. Confira os links ou importe uma imagem.',
  insufficient: 'As imagens encontradas não têm evidência suficiente. Escolha uma imagem ou use somente texto.',
}
