import type { AutomaticImage, VisualRelevance, VisualRequest } from './automaticSearch'
import type { DocumentaryAsset } from './documentaryContract'
import { phraseKey } from './visualContext'

type Evaluation = VisualRelevance & { request: VisualRequest; candidate: { credit: { sourceId: string }; document?: DocumentaryAsset } }
export const useSemantics = import.meta.env.VITE_VISUAL_SEMANTIC === 'clip'
export const useOcr = import.meta.env.VITE_VISUAL_OCR === 'true'
export const useSignals = import.meta.env.VITE_VISUAL_SIGNALS === 'true'
const textMedia = /\b(?:poster|cartaz|embalagem|packaging|signage|placa|rotulo|label|logotipo|logotype|logomarca|logo|identidade visual|visual identity|tipografia|typography|fachada|storefront)\b/
const excludedNames = ({ campaign, copy }: VisualRequest) => [...campaign.excluded, ...copy.visualContext?.excludedSubjects ?? []]
export function needsVisualOcr({ candidate, request }: Evaluation) {
  return (request.campaign.campaignName || request.campaign.names.length > 0 || excludedNames(request).length > 0 || request.copy.visualContext?.entities?.length) &&
    textMedia.test(phraseKey([candidate.document?.caption, candidate.document?.section, request.copy.imageBrief,
      request.copy.visualContext?.visualIntent, request.copy.visualContext?.imageType].filter(Boolean).join(' ')))
}

export async function refineVisualFit<T extends Evaluation>(evaluations: T[], images: Map<string, AutomaticImage>, signal: AbortSignal) {
  const eligible = evaluations.filter(entry => images.has(entry.candidate.credit.sourceId))
  const requests = [...new Map(eligible.map(entry => [entry.request.key, entry.request])).values()].slice(0, 8)
  const semanticIds = new Set(eligible.map(entry => entry.candidate.credit.sourceId))
  const items = [...images.entries()].filter(([id]) => semanticIds.has(id))
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
    const targets = [...new Map(eligible.filter(needsVisualOcr).sort((a, b) =>
      Number(excludedNames(b.request).length > 0) - Number(excludedNames(a.request).length > 0))
      .map(entry => [entry.candidate.credit.sourceId, entry])).values()].slice(0, 3)
    if (!targets.length) return
    const { readVisualTexts } = await import('./ocr')
    const language = targets[0].request.campaign.language === 'en' ? 'eng' : 'por'
    const files = new Map(targets.map(({ candidate }) => {
      const image = images.get(candidate.credit.sourceId)!
      return [image.fileHash, { id: candidate.credit.sourceId, key: image.fileHash, file: image.file }]
    }))
    await readVisualTexts([...files.values()], language, signal, (key, result) => {
      if (result.confidence >= 78) ocr.set(files.get(key)!.id, phraseKey(result.text))
    })
  }
  if (eligible.length) await Promise.allSettled([
    useSemantics && items.length > 1 ? semantics() : undefined,
    useOcr ? recognize() : undefined,
  ])
  return evaluations.flatMap(entry => {
    const id = entry.candidate.credit.sourceId
    const text = ' ' + (ocr.get(id) ?? '') + ' '
    const excluded = excludedNames(entry.request)
    const identities = [entry.request.campaign.campaignName, ...entry.request.copy.visualContext?.entities ?? []]
    const same = identities.some(label => label && text.includes(' ' + phraseKey(label) + ' '))
    if (!same && excluded.some(label => phraseKey(label) && text.includes(' ' + phraseKey(label) + ' '))) return []
    const index = requests.findIndex(request => request.key === entry.request.key)
    const similarity = scores.get(id)?.[index]
    const bonus = similarity === undefined ? 0 : Math.max(-6, Math.min(6, (similarity - .22) * 30))
    const image = images.get(id)
    const point = image?.focalPoint
    const ratio = Number(image?.object.width) / Number(image?.object.height)
    const frame = entry.request.ratio
    const displacement = point && (ratio > frame ? Math.abs(.5 - point.x) * (1 - frame / ratio) :
      Math.abs(.5 - point.y) * (1 - ratio / frame))
    return [{ ...entry, score: entry.score + bonus + (same ? 3 : 0) - (useSignals ? (displacement || 0) * 8 : 0) }]
  })
}
