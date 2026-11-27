import { z } from 'zod'
import { slideVisualSchema } from './visualContext'
import { failureText } from './searchDiagnostics'
import type { VisualSlide } from '../studio/model'

export function recoveryPrompt(slide: VisualSlide) {
  return [
    'Pesquise novas referências visuais para este slide no Post Machine. A primeira tentativa não recebeu uma fotografia utilizável.',
    `Slide: ${slide.id}. Direção de arte: ${slide.imageBrief}`,
    `Objeto visível: ${slide.visualContext?.visualIntent ?? 'Confira o briefing e as fontes.'}`,
    `Diagnóstico: ${slide.visualChoice?.reception?.failure ? failureText[slide.visualChoice.reception.failure] : 'Recepção pendente.'}`,
    `Referências anteriores: ${JSON.stringify(slide.visualContext ?? {})}`,
    'Busque alternativas que mostrem o mesmo objeto ou cena. Consulte a página e confira o arquivo quando possível. Não invente URLs nem nomes de arquivos. Não use fotos genéricas ou geradas como documentação da campanha.',
    'Se só conhecer a página, omita imageUrl e informe sourceUrl e description. Se só houver vídeo, use videoUrl e referenceStatus: video_only. Se não encontrar referência utilizável, indique referenceStatus: unavailable e preserve o objeto solicitado.',
    'Retorne somente JSON com este slideId e visualContext. visualContext aceita visualIntent, documentaryRequired, referenceStatus (found, page_only, video_only ou unavailable), videoUrl, preferredSourceUrls (até 8 páginas) e visualCandidates (até 6 objetos {sourceUrl, description, imageUrl opcional}, principal e alternativas em ordem). Cada descrição tem até 240 caracteres. Use apenas URLs HTTPS públicas.',
    'Uma declaração sua de verificado será conferida pelo aplicativo. Descrição e URL não equivalem a arquivo recebido. Não gere base64 nem exija anexos.',
    JSON.stringify({ slideId: slide.id, visualContext: { visualIntent: slide.visualContext?.visualIntent, visualCandidates: [] } }),
  ].join('\n\n')
}

export function parseRecoveredReferences(raw: string, slideId: string) {
  const input = raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1')
  if (input.length > 32_000) throw Error('A resposta excede 32 mil caracteres.')
  const parsed = z.object({ slideId: z.literal(slideId), visualContext: slideVisualSchema }).strict().safeParse(JSON.parse(input))
  if (!parsed.success) throw Error('Confira o identificador do slide e use referências HTTPS públicas no formato solicitado.')
  const visual = parsed.data.visualContext
  if (!visual.visualCandidates?.length && !visual.preferredSourceUrls?.length && !visual.videoUrl && visual.referenceStatus !== 'unavailable')
    throw Error('Informe uma referência ou declare referenceStatus: unavailable.')
  return visual
}
