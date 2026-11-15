import { editorialFormat } from './catalog'
import { analysisFields, type Reference } from './contract'
import { identifyUrl, platforms } from './urls'

export function editorialPrompt(ref: Reference) {
  const platform = platforms[identifyUrl(ref.url).platform]
  const format = editorialFormat(ref.format)
  const hasContext = !!(ref.description || ref.analysis.hook || ref.analysis.structure || ref.analysis.mechanism)
  return [
    'Analise esta referência criativa em português e proponha como aplicar seu mecanismo editorial a outro tema.',
    'Use apenas as observações fornecidas. Não presuma que abriu ou assistiu ao link. Separe o que foi observado de hipóteses. Não invente métricas, elementos, cenas ou falas.',
    hasContext ? 'Identifique gancho, estrutura, tom e recursos que podem ser adaptados. Crie uma abordagem original sem copiar texto, roteiro ou imagem.' : 'Há pouca informação sobre o conteúdo. Antes de analisar, solicite ao usuário uma descrição do gancho, da estrutura e de exemplos observados.',
    JSON.stringify({ título: ref.title, plataforma: platform, link: ref.url, formato: format.name, nicho: ref.niche, descrição: ref.description, ...Object.fromEntries(Object.entries(ref.analysis).filter(([, value]) => value).map(([key, value]) => [analysisFields[key as keyof Reference['analysis']], value])) }, null, 2),
  ].join('\n\n')
}
