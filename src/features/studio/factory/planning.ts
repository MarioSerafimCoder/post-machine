import type { CollectionSlide } from '../collections'
import { normalize } from '../../radar/contract'
import type { ImageCredit } from '../../images/contract'
import type { VisualAnalysis } from '../vision/signals'

export type Treatment = 'balanced' | 'photo' | 'expressive'
type ImageObject = NonNullable<CollectionSlide['image']>
export type Asset = { id: string; name: string; object: ImageObject }
export type Input = CollectionSlide & { imageId?: string | null; ignoreVisual?: boolean; visualPlaceholder?: boolean }
export type PlannedSlide = {
  content: CollectionSlide
  role: NonNullable<CollectionSlide['role']>
  picture?: { id?: string; name: string; origin: 'manual' | 'linked' | 'automatic' | 'suggested'; reason?: string }
  orientation: 'horizontal' | 'vertical' | 'square' | 'none'
  characters: number
  focus?: 'highlight' | 'comparison'
  visualPlaceholder?: boolean
}

const word = (value: string) => normalize(value).match(/[\p{L}\p{N}]{4,}/gu) ?? []
const irrelevant = new Set(['imagem', 'foto', 'fotografia', 'slide', 'para', 'como', 'sobre', 'esta', 'este', 'uma', 'composição', 'with', 'from', 'photo', 'image'])

export function planSlides(inputs: Input[], assets: Asset[], geometry?: { width: number; height: number; imageRatio?: number },
  visual?: ReadonlyMap<string, VisualAnalysis>) : PlannedSlide[] {
  const byId = new Map(assets.map(asset => [asset.id,asset]))
  const identity = (image: ImageObject) => typeof image.src === 'string' ? image.src : image
  const reserved = new Set(inputs.flatMap(slide => {
    const linked = byId.get(slide.imageId ?? '')?.object ?? (slide.imageId !== null ? slide.image : undefined)
    return linked ? [identity(linked)] : []
  }))
  const available = assets.filter(asset => !reserved.has(identity(asset.object)))
  const used = new Set(reserved)
  const suggestions = new Map<number, { asset: Asset; reason: string }>()
  const indexed = available.map(asset => {
    const credit = asset.object.imageCredit as ImageCredit | undefined
    const terms = new Set(word([asset.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '), credit?.title].filter(Boolean).join(' ')))
    return { asset, terms }
  })
  const candidates = inputs.flatMap((slide, index) => {
    if (slide.image || slide.imageId !== undefined) return []
    const brief = new Set(word(slide.imageBrief ?? '').filter(term => !irrelevant.has(term)))
    const title = new Set(word(slide.title).filter(term => !irrelevant.has(term)))
    const context = new Set(normalize([slide.imageBrief, slide.title].filter(Boolean).join(' ')).match(/[\p{L}\p{N}]{3,}/gu) ?? [])
    return indexed.flatMap(({ asset, terms }, order) => {
      const matching = [...new Set([...brief, ...title])].filter(term => terms.has(term))
      const cue = slide.ignoreVisual ? undefined : visual?.get(asset.id)?.cue
      const visualMatch = cue?.terms.find(term => context.has(term))
      const metadataMatch = matching.length > 1 || matching.some(term => brief.has(term))
      if (!visualMatch && !metadataMatch) return []
      const w = Number(asset.object.width), h = Number(asset.object.height)
      const preferredRatio = slide.role === 'cover' ? 1.25 : geometry?.imageRatio ?? 1
      const crop = w > 0 && h > 0 ? Math.min(w / h / preferredRatio, preferredRatio / (w / h)) : 0
      const resolution = geometry ? Math.min(1, w / (geometry.width * .5), h / (geometry.height * .4)) : 0
      const score = (metadataMatch ? matching.reduce((sum, term) => sum + (brief.has(term) ? 3 : 1), 0) * 10 : 0) +
        (visualMatch ? 35 : 0) + crop + resolution
      const reasons = [
        ...(visualMatch && cue ? [`Análise local sugere “${cue.label}”, relacionado a “${visualMatch}” no slide.`] : []),
        ...(metadataMatch ? [`Termos em comum no nome do arquivo ou título da fonte: ${matching.slice(0, 4).join(', ')}.`] : []),
      ]
      return [{ asset, index, order, score, reason: reasons.join(' ') }]
    })
  }).sort((a, b) => b.score - a.score || a.index - b.index || a.order - b.order)
  for (const candidate of candidates) {
    const source = identity(candidate.asset.object)
    if (suggestions.has(candidate.index) || used.has(source)) continue
    suggestions.set(candidate.index, candidate)
    used.add(source)
  }
  let next = 0

  return inputs.map((slide,index) => {
    const manual = byId.get(slide.imageId ?? '')
    let image = manual?.object ?? (slide.imageId !== null ? slide.image : undefined)
    let picture: PlannedSlide['picture']
    if (manual) picture = { id:manual.id, name:manual.name, origin:'manual' }
    else if (image) picture = { name:'Imagem vinculada', origin:'linked' }
    else if (slide.imageId === undefined) {
      const suggestion = suggestions.get(index)
      while (!suggestion && next < available.length && used.has(identity(available[next].object))) next++
      const asset = suggestion?.asset ?? available[next++]
      if (asset) {
        image = asset.object
        used.add(identity(image))
        picture = { id:asset.id, name:asset.name, origin:suggestion ? 'suggested' : 'automatic', reason:suggestion?.reason }
      }
    }
    const role = slide.role ?? (inputs.length === 1 ? 'content' :
      index === 0 ? 'cover' : index === inputs.length - 1 ? 'cta' : 'content')
    const ratio = image ? Number(image.width)/Number(image.height) : 0
    const orientation = !image ? 'none' : ratio > 1.15 ? 'horizontal' : ratio < .87 ? 'vertical' : 'square'
    return {
      content:{ ...slide, image, focalPoint: slide.focalPoint ?? (picture?.id && !slide.ignoreVisual ? visual?.get(picture.id)?.focalPoint : undefined) }, role, picture, orientation,
      characters:slide.title.length + slide.body.length + (slide.subtitle?.length ?? 0) + (slide.cta?.length ?? 0),
      focus:slide.intent, visualPlaceholder: slide.visualPlaceholder,
    }
  })
}

export function compositionPreference(slide: PlannedSlide, index: number, composition: number) {
  if (slide.content.composition === composition) return 12
  if (slide.role === 'cover') return composition === 0 ? 10 : composition === 4 ? 4 : 0
  if (slide.role === 'cta' || slide.content.cta) return composition === 5 ? 10 : 0
  if (slide.focus === 'highlight') return composition === 4 ? 11 : 0
  if (slide.focus === 'comparison') return composition === 2 ? 9 : composition === 3 ? 4 : 0
  if (slide.picture) return composition === 3 ? 8 : 0
  return composition === (index === 1 ? 1 : 2) ? 7 : 0
}

// Preserve every code unit, including the original paragraph separator.
export function divideBody(body: string): [string,string] | undefined {
  const boundaries = [...body.matchAll(/\r?\n[ \t]*\r?\n/g)]
    .map(match => match.index + match[0].length).filter(index => body.slice(index).trim() && body.slice(0,index).trim())
  if (!boundaries.length) return undefined
  const middle = boundaries.reduce((best,index) => Math.abs(index - body.length/2) < Math.abs(best - body.length/2) ? index : best)
  return [body.slice(0,middle),body.slice(middle)]
}
