import { Textbox } from 'fabric'
import type { HeadlineFit } from '../headlines/HeadlinePanel'

export function measureTitle(source: Textbox, title: string, [canvasWidth, canvasHeight]: readonly [number, number]): HeadlineFit {
  const probe = new Textbox(title, {
    width: source.width, minWidth: source.minWidth, splitByGrapheme: source.splitByGrapheme,
    left: source.left, top: source.top, originX: source.originX, originY: source.originY,
    angle: source.angle, scaleX: source.scaleX, scaleY: source.scaleY, skewX: source.skewX, skewY: source.skewY,
    flipX: source.flipX, flipY: source.flipY, strokeWidth: source.strokeWidth,
    fontFamily: source.fontFamily, fontSize: source.fontSize, fontWeight: source.fontWeight, fontStyle: source.fontStyle,
    charSpacing: source.charSpacing, lineHeight: source.lineHeight, textAlign: source.textAlign,
    styles: structuredClone(source.styles),
  })
  probe.setCoords()
  const box = probe.getBoundingRect()
  const wider = probe.width > source.width + 1
  const overHeight = !!source.maxHeight && probe.getScaledHeight() > source.maxHeight + 2
  const clipped = box.left < -1 || box.top < -1 || box.left + box.width > canvasWidth + 1 || box.top + box.height > canvasHeight + 1
  const fits = !wider && !overHeight && !clipped
  return {
    width: Math.round(Math.max(0, ...probe.textLines.map((_, index) => probe.getLineWidth(index))) * Math.abs(source.scaleX)), height: Math.round(probe.getScaledHeight()), fits,
    detail: wider ? 'Texto excede a largura da caixa.' : overHeight ? 'Texto excede a altura prevista.' : clipped ? 'Parte do texto fica fora da arte.' : 'Cabe na arte e nos limites definidos.',
  }
}
