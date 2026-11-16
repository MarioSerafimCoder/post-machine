import type { CollectionSlide } from './collections'

export function sceneForCollection(slide: CollectionSlide, index: number, count: number) {
  if (slide.composition !== undefined) return slide.composition
  if (slide.role === 'cover' || count === 1 || (!slide.role && index === 0)) return 0
  if (slide.role === 'cta' || (!slide.role && index === count - 1)) return 5
  if (slide.image) return 3
  return index === 1 ? 1 : 2
}
