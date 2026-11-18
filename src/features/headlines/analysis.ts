import type { HeadlineContext, HeadlineSession } from './contract'

const graphemes = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' })
const words = new Intl.Segmenter('pt-BR', { granularity: 'word' })
export const characterCount = (text: string) => [...graphemes.segment(text)].length
const ignore = new Set('a o as os um uma uns umas de da do dos das e ou em no na nos nas para por com que se ao à'.split(' '))
const clichés = ['o segredo para', 'você não vai acreditar', 'tudo que você precisa saber', 'muda tudo', 'revolucione', 'nunca foi tão fácil', 'o guia definitivo']
const generic = /\b(coisas?|incrível|imperdível|inovador[ao]?|transformador[ao]?|novidade|surpreendente)\b/iu
const claims = /\d+(?:[.,]\d+)?\s*%?|garantid[oa]|sempre|nunca|comprovad[oa]|o (?:melhor|maior|primeiro)/giu

export function analyzeHeadline(text: string, limits: Pick<HeadlineSession, 'maxChars' | 'maxWords'>, context: HeadlineContext) {
  const characters = characterCount(text)
  const tokens = [...words.segment(text)].filter(word => word.isWordLike).map(word => word.segment.toLocaleLowerCase('pt-BR'))
  const counts = new Map<string, number>()
  for (const word of tokens) if (!ignore.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1)
  const repeated = [...counts].filter(([, count]) => count > 1).map(([word, count]) => `${word} (${count}×)`)
  const measured: string[] = [], heuristic: string[] = []
  if (limits.maxChars && characters > limits.maxChars) measured.push(`Acima do limite de ${limits.maxChars} caracteres.`)
  if (limits.maxWords && tokens.length > limits.maxWords) measured.push(`Acima do limite de ${limits.maxWords} palavras.`)
  if (repeated.length) measured.push(`Repetições: ${repeated.join(', ')}.`)
  const letters = text.match(/\p{L}/gu)?.length ?? 0
  const upper = text.match(/\p{Lu}/gu)?.length ?? 0
  if (letters >= 8 && upper / letters >= .75) heuristic.push('Muitas maiúsculas. Revise a legibilidade.')
  if (/[!?]{2,}|[!?].*[!?].*[!?]/.test(text)) heuristic.push('Pontuação enfática em excesso. Experimente simplificar.')
  const lower = text.toLocaleLowerCase('pt-BR')
  const detected = clichés.filter(phrase => lower.includes(phrase))
  if (detected.length) heuristic.push(`Possível clichê: ${detected.join(', ')}.`)
  if (generic.test(text)) heuristic.push('Há termos genéricos. Nomeie o assunto, a mudança ou o recorte.')
  if (text.trim() && (tokens.length <= 2 || /^(is?so|isto|aquilo|veja|descubra)\s/i.test(text))) heuristic.push('Confira se o assunto fica claro para quem vê apenas o título.')
  if (/informar|educar/i.test(context.objective ?? '') && (!tokens.length || detected.length || /[!?]{2,}/.test(text))) heuristic.push('Para o objetivo informado, verifique se o título nomeia o conteúdo que será explicado.')
  const candidates = [...lower.matchAll(claims)]
  if (candidates.length) {
    const known = [context.briefing, ...context.slides.map(slide => slide.body), ...context.sources.flatMap(source => [source.title, source.summary])].join(' ').toLocaleLowerCase('pt-BR')
    if (candidates.some(match => !known.includes(match[0].trim()))) heuristic.push('Há um número, superlativo ou promessa que precisa ser conferido nas fontes e no briefing.')
  }
  return { characters, words: tokens.length, measured, heuristic }
}
