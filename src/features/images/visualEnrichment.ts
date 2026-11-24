import type { AutomaticImage, VisualRelevance, VisualRequest } from './automaticSearch'
import type { DocumentaryAsset } from './documentaryContract'
import { phraseKey } from './visualContext'

type Evaluation = VisualRelevance & { request: VisualRequest; candidate: { credit: { sourceId: string }; document?: DocumentaryAsset } }
export const useSemantics = import.meta.env.VITE_VISUAL_SEMANTIC === 'clip'
export const useOcr = import.meta.env.VITE_VISUAL_OCR === 'true'
const textMedia = /\b(?:poster|cartaz|embalagem|packaging|signage|placa|rotulo|label|logotipo|logotype|logomarca|tipografia|typography)\b/

export async function refineVisualFit<T extends Evaluation>(evaluations: T[], images: Map<string, AutomaticImage>, signal: AbortSignal) {
  const eligible = evaluations.filter(entry => entry.match.classification !== 'confirmed' && images.has(entry.candidate.credit.sourceId))
  const requests = [...new Map(eligible.map(entry => [entry.request.key, entry.request])).values()].slice(0, 8)
  const items = [...images.entries()]
  const scores = new Map<string, number[]>()
  const ocr = new Map<string, string>()
  const prompts = requests.map(({ campaign, copy }) =>
    [copy.visualContext?.visualIntent || copy.imageBrief, copy.title, campaign.subject].filter(Boolean).join('. ').slice(0, 280))
  const semantics = async () => {
    const { compareClip } = await import('./semanticClient')
    const result = await compareClip(items.map(([, image]) => ({ key: image.fileHash, file: image.file })), prompts, signal)
    items.forEach(([id], index) => scores.set(id, result.scores[index]))
  }
  const recognize = async () => {
    const entry = eligible.find(({ candidate, request }) => (request.campaign.campaignName || request.campaign.excluded.length) &&
      textMedia.test(phraseKey([candidate.document?.caption, candidate.document?.section, request.copy.imageBrief,
        request.copy.visualContext?.imageType].filter(Boolean).join(' '))))
    if (!entry) return
    const { readVisualText } = await import('./ocr')
    signal.throwIfAborted()
    const id = entry.candidate.credit.sourceId
    const result = await readVisualText(images.get(id)!.file, entry.request.campaign.language === 'en' ? 'eng' : 'por', signal)
    if (result.confidence >= 78) ocr.set(id, phraseKey(result.text))
  }
  if (eligible.length) await Promise.allSettled([
    useSemantics && items.length > 1 ? semantics() : undefined,
    useOcr ? recognize() : undefined,
  ])
  return evaluations.flatMap(entry => {
    if (entry.match.classification === 'confirmed') return [entry]
    const id = entry.candidate.credit.sourceId
    const text = ' ' + (ocr.get(id) ?? '') + ' '
    const { campaignName, excluded } = entry.request.campaign
    const same = campaignName && text.includes(' ' + phraseKey(campaignName) + ' ')
    if (!same && excluded.some(label => phraseKey(label) && text.includes(' ' + phraseKey(label) + ' '))) return []
    const index = requests.findIndex(request => request.key === entry.request.key)
    const similarity = scores.get(id)?.[index]
    const bonus = similarity === undefined ? 0 : Math.max(-6, Math.min(6, (similarity - .22) * 30))
    return [{ ...entry, score: entry.score + bonus + (same ? 3 : 0) }]
  })
}
