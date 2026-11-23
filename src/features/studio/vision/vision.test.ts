import { describe, expect, it } from 'vitest'
import { contrastFocalPoint, cueFromScores } from './signals'
import { planSlides } from '../factory/planning'
import { imageForFrame } from '../collections'

describe('sugestões de imagem com sinais visuais', () => {
  const photos = [
    { id: 'a', name: 'arquivo-a.png', object: { src: 'a', width: 800, height: 400 } },
    { id: 'b', name: 'arquivo-b.png', object: { src: 'b', width: 800, height: 400 } },
  ]
  const point = { x: .8, y: .5 }
  const visual = new Map([['b', { cue: { label: 'gato', terms: ['gato'] }, focalPoint: point }]])
  const slide = { title: 'A luz no retrato de um gato', body: '' }

  it('mantém a distribuição determinística quando a análise está ausente ou foi ignorada', () => {
    expect(planSlides([slide], photos)[0].picture).toMatchObject({ id: 'a', origin: 'automatic' })
    expect(planSlides([{ ...slide, ignoreVisual: true }], photos, undefined, visual)[0].picture?.id).toBe('a')
  })

  it('sugere pela classe reconhecida e respeita o vínculo e o ponto focal explícitos', () => {
    const result = planSlides([slide], photos, undefined, visual)[0]
    expect(result.picture).toMatchObject({ id: 'b', origin: 'suggested', reason: expect.stringContaining('Análise local') })
    expect(result.content.focalPoint).toEqual(point)
    const manual = planSlides([{ ...slide, imageId: 'a', focalPoint: { x: .2, y: .3 } }], photos, undefined, visual)[0]
    expect(manual.picture).toMatchObject({ id: 'a', origin: 'manual' })
    expect(manual.content.focalPoint).toEqual({ x: .2, y: .3 })
    expect(planSlides([{ ...slide, imageId: null }], photos, undefined, visual)[0].picture).toBeUndefined()
  })

  it('mantém proporções e limita o recorte às bordas', () => {
    const image = photos[0].object
    const cropped = imageForFrame(image, [0, 0, 200, 200], 'cover', .5, point)
    expect(cropped.scaleX).toBe(cropped.scaleY)
    expect(cropped.cropX).toBe(400)
    expect(cropped.cropX + cropped.width).toBe(image.width)
    const uncropped = imageForFrame(image, [0, 0, 200, 200], 'contain', .5, point)
    expect(uncropped.width).toBe(image.width)
    expect(uncropped.cropX).toBe(0)
  })

  it('propõe um ponto focal apenas quando o contraste está concentrado', () => {
    const width = 64, height = 64
    const pixels = new Uint8ClampedArray(width * height * 4)
    expect(contrastFocalPoint(pixels, width, height)).toBeUndefined()
    for (let y = 10; y < 18; y++) for (let x = 50; x < 59; x++) {
      pixels.fill(255, (y * width + x) * 4, (y * width + x + 1) * 4)
    }
    const focal = contrastFocalPoint(pixels, width, height)
    expect(focal?.x).toBeGreaterThan(.75)
    expect(focal?.y).toBeLessThan(.35)
    const scores = new Float32Array(1000)
    expect(cueFromScores(scores)).toBeUndefined()
    scores[281] = 12
    expect(cueFromScores(scores)?.label).toBe('gato')
  })
})
