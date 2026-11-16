import type { Treatment } from './planning'

export type Box = [x: number, y: number, width: number, height: number]
export type Composition = { title: Box; body: Box; image: Box; size: number }

export function treatComposition(base: Composition, treatment: Treatment, index: number, ratio: number, dense: boolean): Composition {
  if (treatment === 'balanced') return base
  if (treatment === 'photo' && ratio > 0) {
    const side = ratio < .92 || index === 3
    if (side) {
      const left = index % 2 === 0
      const photoWidth = dense ? .40 : .52
      const textX = left ? photoWidth + .055 : 0
      const textWidth = 1-photoWidth-.055
      return { title:[textX,.15,textWidth,.26], body:[textX,.44,textWidth,.40],
        image:[left ? 0 : 1-photoWidth,.10,photoWidth,.75], size:Math.min(base.size,90) }
    }
    const photoHeight = dense ? .32 : .44
    const top = index % 2 === 0
    return { title:[.03,top ? .12+photoHeight : .10,.94,.17],
      body:[.03,top ? .32+photoHeight : .30,.94,top ? .53-photoHeight : .51-photoHeight],
      image:[0,top ? .09 : .85-photoHeight,1,photoHeight], size:Math.min(base.size,88) }
  }
  if (treatment === 'photo') {
    // A full-width reading column replaces the unused photo area.
    const inset = index % 2 === 0 ? .08 : .15
    return { title:[inset,.14,1-inset,.27], body:[inset,.46,1-inset,.39],
      image:[0,.47,.05,.28], size:Math.min(base.size,98) }
  }
  return { ...base, size:Math.round(base.size*1.16) }
}
