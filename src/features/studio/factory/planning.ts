import type { CollectionSlide } from '../collections'

export type Treatment = 'balanced' | 'photo' | 'expressive'
type ImageObject = NonNullable<CollectionSlide['image']>
export type Asset = { id: string; name: string; object: ImageObject }
export type Input = CollectionSlide & { imageId?: string | null }
export type PlannedSlide = {
  content: CollectionSlide
  role: NonNullable<CollectionSlide['role']>
  picture?: { name: string; origin: 'manual' | 'linked' | 'automatic' }
  orientation: 'horizontal' | 'vertical' | 'square' | 'none'
  characters: number
  focus?: 'highlight' | 'comparison'
}

export function planSlides(inputs: Input[], assets: Asset[]): PlannedSlide[] {
  const byId = new Map(assets.map(asset => [asset.id,asset]))
  const identity = (image: ImageObject) => typeof image.src === 'string' ? image.src : image
  const reserved = new Set(inputs.flatMap(slide => {
    const linked = byId.get(slide.imageId ?? '')?.object ?? (slide.imageId !== null ? slide.image : undefined)
    return linked ? [identity(linked)] : []
  }))
  const available = assets.filter(asset => !reserved.has(identity(asset.object)))
  const used = new Set(reserved)
  let next = 0

  return inputs.map((slide,index) => {
    const manual = byId.get(slide.imageId ?? '')
    let image = manual?.object ?? (slide.imageId !== null ? slide.image : undefined)
    let picture: PlannedSlide['picture']
    if (manual) picture = { name:manual.name, origin:'manual' }
    else if (image) picture = { name:'Imagem vinculada', origin:'linked' }
    else if (slide.imageId === undefined) {
      while (next < available.length && used.has(identity(available[next].object))) next++
      const asset = available[next++]
      if (asset) {
        image = asset.object
        used.add(identity(image))
        picture = { name:asset.name, origin:'automatic' }
      }
    }
    const role = slide.role ?? (inputs.length === 1 ? 'content' :
      index === 0 ? 'cover' : index === inputs.length - 1 ? 'cta' : 'content')
    const ratio = image ? Number(image.width)/Number(image.height) : 0
    const orientation = !image ? 'none' : ratio > 1.15 ? 'horizontal' : ratio < .87 ? 'vertical' : 'square'
    return {
      content:{ ...slide,image }, role, picture, orientation,
      characters:slide.title.length + slide.body.length + (slide.subtitle?.length ?? 0) + (slide.cta?.length ?? 0),
      focus:slide.intent,
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
