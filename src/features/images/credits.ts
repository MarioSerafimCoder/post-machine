import type { Project } from '../studio/model'
import { creditProvider, imageCreditSchema, licenseName, licenseTerms, type ImageCredit } from './contract'

export function* imageObjects(objects: Record<string, unknown>[]): Generator<Record<string, unknown>> {
  for (const object of objects) {
    if (String(object.type).toLowerCase() === 'image') yield object
    if (Array.isArray(object.objects)) yield* imageObjects(object.objects)
  }
}

export function creditText(credit: ImageCredit) {
  const terms = licenseTerms(credit)
  return [
    credit.title || 'Imagem sem título',
    `Autor: ${credit.creator || 'Não informado'}`,
    credit.creatorUrl,
    `Fonte: ${credit.source || credit.catalogProvider || creditProvider[credit.provider]}`,
    credit.sourcePage || credit.originalUrl,
    `Licença: ${[licenseName(credit.license), credit.licenseVersion].filter(Boolean).join(' ')}`,
    credit.licenseUrl,
    'evidence' in credit && credit.evidence,
    credit.attribution,
    terms.commercial === false && 'Uso comercial restrito pela licença indicada.',
    terms.shareAlike && 'Confira as condições de compartilhamento pela mesma licença.',
    terms.noDerivatives && 'Licença sem permissão para distribuir adaptações. Confira os efeitos do recorte e da edição.',
    !terms.valid && 'Licença incompleta ou desconhecida. Confira na fonte original.',
  ].filter(Boolean).join('\n')
}

export function projectCredits(project: Project, current?: number) {
  const entries = new Map<string, { credit: ImageCredit; slides: number[] }>()
  for (const [index, slide] of project.slides.entries()) {
    if (current !== undefined && current !== index) continue
    for (const object of imageObjects(slide.scene.objects)) {
      if (object.visible === false || object.opacity === 0) continue
      const parsed = imageCreditSchema.safeParse(object.imageCredit)
      if (!parsed.success) continue
      const credit = parsed.data
      const key = JSON.stringify([credit.provider, credit.sourceId, credit.license, credit.licenseVersion, credit.licenseUrl, credit.creator, credit.attribution])
      const entry = entries.get(key) ?? { credit, slides: [] }
      if (!entry.slides.includes(index + 1)) entry.slides.push(index + 1)
      entries.set(key, entry)
    }
  }
  if (!entries.size) return ''
  return [
    `Créditos de imagens — ${project.name}`,
    'Confira as condições da licença e a página original antes de publicar. Registre as modificações que fizer, quando exigido pela licença.',
    ...[...entries.values()].map(entry => `Slides: ${entry.slides.join(', ')}\n${creditText(entry.credit)}`),
  ].join('\n\n') + '\n'
}
